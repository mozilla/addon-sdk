/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var EXPORTED_SYMBOLS = ["Jetpack"];

const { utils: Cu, interfaces: Ci, classes: Cc, Constructor: CC } = Components;
const { Services } = Cu.import("resource://gre/modules/Services.jsm", {});

const ioService = Cc['@mozilla.org/network/io-service;1'].
                  getService(Ci.nsIIOService);
const resourceHandler = ioService.getProtocolHandler('resource').
                        QueryInterface(Ci.nsIResProtocolHandler);
const systemPrincipal = CC('@mozilla.org/systemprincipal;1', 'nsIPrincipal')();
const scriptLoader = Cc['@mozilla.org/moz/jssubscript-loader;1'].
                     getService(Ci.mozIJSSubScriptLoader);
const prefService = Cc['@mozilla.org/preferences-service;1'].
                    getService(Ci.nsIPrefService).
                    QueryInterface(Ci.nsIPrefBranch);
const { get, exists } = Cc['@mozilla.org/process/environment;1'].
                        getService(Ci.nsIEnvironment);

const prefSvc = Cc["@mozilla.org/preferences-service;1"].
                getService(Ci.nsIPrefService).getBranch(null);

const { NetUtil } = Cu.import("resource://gre/modules/NetUtil.jsm", {});
const { Promise: { defer } } = Cu.import("resource://gre/modules/Promise.jsm", {});
const { Task: { spawn } } = Cu.import("resource://gre/modules/Task.jsm", {});

// load below now, so that it can be used by sdk/addon/runner
// see bug https://bugzilla.mozilla.org/show_bug.cgi?id=1042239
const Startup = Cu.import("resource://gre/modules/sdk/system/Startup.js", {}).exports;

const REASON = [ 'unknown', 'startup', 'shutdown', 'enable', 'disable',
                 'install', 'uninstall', 'upgrade', 'downgrade' ];

const bind = Function.call.bind(Function.bind);

function getPref(name, defaultValue) {
  defaultValue = defaultValue || null;

  switch (prefSvc.getPrefType(name)) {
  case Ci.nsIPrefBranch.PREF_STRING:
    return prefSvc.getComplexValue(name, Ci.nsISupportsString).data;

  case Ci.nsIPrefBranch.PREF_INT:
    return prefSvc.getIntPref(name);

  case Ci.nsIPrefBranch.PREF_BOOL:
    return prefSvc.getBoolPref(name);

  default:
    return defaultValue;
  }
}

// Utility function reads URI async. Returns promise for the read
// content.
const readURI = (uri, charset="utf-8") => {
  const channel = NetUtil.newChannel(uri, charset, null);
  const { promise, resolve, reject } = defer();

  try {
    NetUtil.asyncFetch(channel, (stream, result) => {
      if (Components.isSuccessCode(result)) {
        const count = stream.available();
        const data = NetUtil.readInputStreamToString(stream, count, {charset : charset});

        resolve(data);
      } else {
        reject(Error("Failed to read: '" + uri + "' (Error Code: " + result + ")"));
      }
    });
  }
  catch ({message}) {
    reject(Error("Failed to read: '" + uri + "' (Error: " + message + ")"));
  }

  return promise;
}


// Reads run configuration asynchronously, returns promise
// for the config JSON.
const readConfig = (rootURI) => {
  const { resolve, reject, promise } = defer();
  spawn(function () {
    let config = null;
    try {
      const options = JSON.parse(yield (readURI(rootURI + "./harness-options.json")));
      config = {
        options: options,
        metadata: options.metadata[options.name],
        isNative: false
      };
    }
    catch (_) {
      try {
        config = {
          isNative: true,
          options: {},
          metadata: JSON.parse(yield readURI(rootURI + './package.json'))
        };
      }
      catch(_) {}
    }
    resolve(config);
  });

  return promise;
}

const UUID_PATTERN = /^\{([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\}$/;
// Takes add-on ID and normalizes it to a domain name so that add-on
// can be mapped to resource://domain/
const readDomain = id =>
  // If only `@` character is the first one, than just substract it,
  // otherwise fallback to legacy normalization code path. Note: `.`
  // is valid character for resource substitutaiton & we intend to
  // make add-on URIs intuitive, so it's best to just stick to an
  // add-on author typed input.
  id.lastIndexOf("@") === 0 ? id.substr(1).toLowerCase() :
  id.toLowerCase().
     replace(/@/g, "-at-").
     replace(/\./g, "-dot-").
     replace(UUID_PATTERN, "$1");

const readPaths = (options, id, name, domain, baseURI, isNative=false) => {
  let paths = {
    "": "resource://gre/modules/commonjs/",
    "./": isNative ? baseURI : baseURI + name + '/lib/',
    "./tests/": (isNative ? baseURI : baseURI + name + '/') + 'tests/'
  };

  Object.keys(options.manifest || {}).reduce((paths, prefix) => {
    paths[prefix + "/"] = baseURI + prefix + "/lib/";
    paths[prefix + "tests/"] = baseURI + prefix + "/tests/";
    return paths;
  }, paths);

  if (name == "addon-sdk")
    paths["tests/"] = baseURI + "addon-sdk/tests/";


  // If SDK is bundled and it is required to use bundled version
  // of the SDK setup paths to do so.
  const isSDKBundled = options["is-sdk-bundled"];
  const useBundledSDK = options["force-use-bundled-sdk"] ||
                        getPref("extensions.addon-sdk.useBundledSDK");

  if (isSDKBundled && useBundledSDK) {
    paths[""] = baseURI + "addon-sdk/lib/";
    paths["test"] = baseURI + "addon-sdk/lib/sdk/test.js";
  }

  const branch = prefService.getBranch("extensions.modules." + id + ".path");
  branch.getChildList("", {}).reduce((paths, name) => {
    const path = name.substr(1).split(".").join("/");
    const prefix = path.length ? path + "/" : path;
    const value = branch.getCharPref(name);
    const fileURI = value[value.length - 1] === "/" ? value :
                    value + "/";
    const key = "extensions.modules." + domain + ".commonjs.path" + name;
    const uri = ioService.newURI(fileURI, null, null);
    resourceHandler.setSubstitution(key, uri);

    paths[prefix] = "resource://" + key + "/";
    return paths;
  }, paths);

  return paths;
}

// Takes JSON `options` and sets prefs for each key under
// the given `root`. Given `options` may contain nested
// objects.
const setPrefs = (root, options) =>
  void Object.keys(options).forEach(id => {
    const key = root + "." + id;
    const value = options[id]
    const type = typeof(value);

    value === null ? void(0) :
    value === undefined ? void(0) :
    type === "boolean" ? prefService.setBoolPref(key, value) :
    type === "string" ? prefService.setCharPref(key, value) :
    type === "number" ? prefService.setIntPref(key, parseInt(value)) :
    type === "object" ? setPrefs(key, value) :
    void(0);
  });


const loadSandbox = (uri) => {
  let proto = {
    sandboxPrototype: {
      loadSandbox: loadSandbox,
      ChromeWorker: ChromeWorker
    }
  };
  let sandbox = Cu.Sandbox(systemPrincipal, proto);
  // Create a fake commonjs environnement just to enable loading loader.js
  // correctly
  sandbox.exports = {};
  sandbox.module = { uri: uri, exports: sandbox.exports };
  sandbox.require = function (id) {
    if (id !== "chrome")
      throw new Error("Bootstrap sandbox `require` method isn't implemented.");

    return Object.freeze({ Cc: Cc, Ci: Ci, Cu: Cu, Cr: Cr, Cm: Cm,
      CC: bind(CC, Components), components: Components,
      ChromeWorker: ChromeWorker });
  };
  scriptLoader.loadSubScript(uri, sandbox, 'UTF-8');
  return sandbox;
}

const unloadSandbox = sandbox =>
  Cu.nukeSandbox && sandbox && Cu.nukeSandbox(sandbox);

const setTimeout = (callback, delay=0) => {
  const timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
  timer.initWithCallback({ notify: callback },
                         delay,
                         Ci.nsITimer.TYPE_ONE_SHOT);
  return timer;
}

function Jetpack(scope) {
  let loader = null;
  let unload = null;
  let loaderSandbox = null;
  let nukeTimer = null;

  function nukeModules() {
    nukeTimer = null;
    // module objects store `exports` which comes from sandboxes
    // We should avoid keeping link to these object to avoid leaking sandboxes
    for (let id in loader.modules) {
      delete loader.modules[id];
    }

    // Direct links to sandboxes should be removed too
    for (let id in loader.sandboxes) {
      let sandbox = loader.sandboxes[id];
      delete loader.sandboxes[id];
      // Bug 775067: From FF17 we can kill all CCW from a given sandbox
      unloadSandbox(sandbox);
    }
    loader = null;

    // both `toolkit/loader` and `system/xul-app` are loaded as JSM's via
    // `cuddlefish.js`, and needs to be unloaded to avoid memory leaks, when
    // the addon is unload.

    unloadSandbox(loaderSandbox.loaderSandbox);
    unloadSandbox(loaderSandbox.xulappSandbox);

    // Bug 764840: We need to unload cuddlefish otherwise it will stay alive
    // and keep a reference to this compartment.
    unloadSandbox(loaderSandbox);
    loaderSandbox = null;
  }

  scope["install"] = (data, reason) => {}

  scope["startup"] = (addon, reasonCode) => {
    const reason = REASON[reasonCode];
    const { id, version, resourceURI: { spec: rootURI } } = addon;
    const loadCommand = exists("CFX_COMMAND") ?
                          get("CFX_COMMAND") :
                          getPref("extensions." + id + ".sdk.load.command", undefined);

    spawn(function() {
      try {
        const config = readConfig(rootURI);
        const { metadata, options, isNative } = (yield config);
        const permissions = Object.freeze(metadata.permissions || {});
        const domain = readDomain(id);
        const name = metadata.name;

        const baseURI = "resource://" + domain + "/";

        const prefsURI = baseURI + "defaults/preferences/prefs.js";

        const mappedURI = isNative ? rootURI + '/' : rootURI + '/resources/';
        resourceHandler.setSubstitution(domain, ioService.newURI(mappedURI, null, null));

        const paths = readPaths(options, id, name, domain, baseURI, isNative);

        const loaderID = isNative ? "toolkit/loader" : "sdk/loader/cuddlefish";
        const loaderURI = paths[""] + loaderID + ".js";

        loaderSandbox = loadSandbox(loaderURI);

        const loaderModule = loaderSandbox.exports;

        unload = loaderModule.unload;

        setPrefs("extensions." + id + ".sdk", {
          id: id,
          version: version,
          domain: domain,
          mainPath: options.mainPath,
          baseURI: baseURI,
          rootURI: rootURI,
          load: {
            reason: reason,
            command: loadCommand
          },
          input: {
            staticArgs: JSON.stringify(options.staticArgs)
          },
          output: {
            resultFile: options.resultFile,
            style: options.parseable ? "tbpl" : null,
            logLevel: options.verbose ? "verbose" : null,
          },
          test: {
            stop: options.stopOnError ? 1 : null,
            filter: options.filter,
            iterations: options.iterations,
          },
          profile: {
            memory: options.profileMemory,
            leaks: options.check_memory ? "refcount" : null
          }
        });

        const modules = {};

        // Manually set the loader's module cache to include itself;
        // which otherwise fails due to lack of `Components`.
        modules[loaderID] = loaderModule;
        modules["@test/options"] = Object.freeze({});

        loader = loaderModule.Loader({
          id: id,
          isNative: isNative,
          prefixURI: baseURI,
          rootURI: baseURI,
          name: name,
          paths: paths,
          manifest: options.manifest || metadata,
          metadata: metadata,
          modules: modules,
          noQuit: getPref("extensions." + id + ".sdk.test.no-quit", false)
        });

        const module = loaderModule.Module(loaderID, loaderURI);
        const require = loaderModule.Require(loader, module);
        const mainPath = (loadCommand == "test") ? "sdk/test/runner" : options.mainPath;

        require("sdk/addon/runner").startup(reason, {
          loader: loader,
          prefsURI: prefsURI,
          main: mainPath
        });
      }
      catch (error) {
        console.error("Failed to bootstrap addon: ", id, error);
        throw error;
      }
    });
  };

  scope["shutdown"] = (data, reasonCode) => {
    let reason = REASON[reasonCode];
    if (loader) {
      unload(loader, reason);
      unload = null;

      // Don't waste time cleaning up if the application is shutting down
      if (reason != "shutdown") {
        // Avoid leaking all modules when something goes wrong with one particular
        // module. Do not clean it up immediatly in order to allow executing some
        // actions on addon disabling.
        // We need to keep a reference to the timer, otherwise it is collected
        // and won't ever fire.
        nukeTimer = setTimeout(nukeModules, 1000);
      }
    }
  }

  scope["uninstall"] = (data, reason) => {}
}
