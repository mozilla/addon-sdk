/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Jetpack.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Atul Varma <atul@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

"use strict";

(function(global) {

   const Cc = Components.classes;
   const Ci = Components.interfaces;
   const Cu = Components.utils;
   const Cr = Components.results;

   var exports = {};

   // Load the SecurableModule prerequisite.
   var securableModule;
   var myURI = Components.stack.filename.split(" -> ").slice(-1)[0];

   if (global.require) {
     // We're being loaded in a SecurableModule. This call also tells the
     // manifest-scanner that it ought to scan securable-module.js
     securableModule = require("api-utils/securable-module");
   } else {
     var ios = Cc['@mozilla.org/network/io-service;1']
               .getService(Ci.nsIIOService);
     var securableModuleURI = ios.newURI("securable-module.js", null,
                                         ios.newURI(myURI, null, null));
     if (securableModuleURI.scheme == "chrome") {
       // The securable-module module is at a chrome URI, so we can't
       // simply load it via Cu.import(). Let's assume we're in a
       // chrome-privileged document and use mozIJSSubScriptLoader.
       var loader = Cc["@mozilla.org/moz/jssubscript-loader;1"]
                    .getService(Ci.mozIJSSubScriptLoader);

       // Import the script, don't pollute the global scope.
       securableModule = {__proto__: global};
       loader.loadSubScript(securableModuleURI.spec, securableModule);
       securableModule = securableModule.SecurableModule;
     } else {
       securableModule = {};
       try {
         Cu.import(securableModuleURI.spec, securableModule);
       } catch (e if e.result == Cr.NS_ERROR_ILLEGAL_VALUE) {
         Cu.reportError("Failed to load " + securableModuleURI.spec);
       }
     }
   }

   if (false) // force the manifest-scanner to copy shims.js into the XPI
     require("api-utils/shims");
   var localFS = new securableModule.LocalFileSystem(myURI);
   var shimsPath = localFS.resolveModule(null, "shims");
   var shims = exports.shims = localFS.getFile(shimsPath);

   shims.filename = shimsPath;

   function makeGetModuleExports(delegate) {
     return function getModuleExports(basePath, module) {
       switch (module) {
       case "chrome":
         var chrome = { Cc: Components.classes,
                        Ci: Components.interfaces,
                        Cu: Components.utils,
                        Cr: Components.results,
                        Cm: Components.manager,
                        components: Components };
         return chrome;
       default:
         return (delegate ? delegate.call(this, basePath, module) : null);
       }
     };
   }

   function modifyModuleSandbox(sandbox, options) {
     sandbox.evaluate(shims);
     var filename = options.filename ? options.filename : null;
     sandbox.defineProperty("__url__", filename);
   }

   var Loader = exports.Loader = function Loader(options) {
     var globals = {};

     if (options.globals)
       for (let name in options.globals)
         globals[name] = options.globals[name];

     if (options.console)
       globals.console = options.console;
     if (options.memory)
       globals.memory = options.memory;

     if ('modules' in options)
       throw new Error('options.modules is no longer supported');

     var getModuleExports = makeGetModuleExports(options.getModuleExports);

     var manifest = {};
     if ("packaging" in options)
       manifest = options.packaging.options.manifest;
     var loaderOptions = {rootPath: options.rootPath,
                          rootPaths: options.rootPaths,
                          metadata: options.metadata,
                          uriPrefix: options.uriPrefix,
                          name: options.name,
                          fs: options.fs,
                          defaultPrincipal: "system",
                          globals: globals,
                          modifyModuleSandbox: modifyModuleSandbox,
                          basePath: options.basePath,
                          manifest: manifest,
                          getModuleExports: getModuleExports};

     var loader = new securableModule.Loader(loaderOptions);

     // we need to supply the new loader with several helper modules
     function load_helper_module(name) {
       dump("load_helper_module("+name+")\n");
       dump(" manifest is "+manifest+" with "+
            Object.keys(manifest).length+" entries\n");
       // loaderURI always points at this file, cuddlefish.js . It comes from
       // harness-options.json
       if (!"packaging" in options) {
         dump("HEY, no packaging in options\n");
         throw new Error("no packaging in options, can't get loaderURI");
       }
       const loaderURI = options.packaging.options.loader;
       dump(" loaderURI is "+loaderURI+"\n");
       const reqs = Object.keys(manifest[loaderURI].requirements);
       dump(" manifest[loaderURI] has "+reqs.length+" requirements\n");
       reqs.forEach(function(v){dump("  "+v+"\n");});

       // all helper module imports "come from" cuddlefish.js, even if the
       // Loader we just built is for someone else's benefit (and thus their
       // require() calls perform manifest checks relative to their own URI).
       // So we manually look up the desired helper-module URI first in the
       // manifest, then use the new Loader's explicit requireURI() method to
       // obtain the code.
       const helperURI = manifest[loaderURI].requirements[name].uri;
       dump(" helperURI is "+helperURI+"\n");
       return loader.requireURI(helperURI);
     }

     if (!globals.console) {
       if (false) // force the manifest-scanner to copy this into the XPI
         require("api-utils/plain-text-console");
       var console = load_helper_module("api-utils/plain-text-console");
       globals.console = new console.PlainTextConsole(options.print);
     }
     if (!globals.memory) {
       dump("HERE1\n");
       globals.memory = load_helper_module("api-utils/memory");
       if (false) // force the manifest-scanner to copy this into the XPI
         require("api-utils/memory");
       dump("HERE2\n");
     }

     loader.console = globals.console;
     loader.memory = globals.memory;
     var unloader = load_helper_module("api-utils/unload");
       if (false) // force the manifest-scanner to copy this into the XPI
         require("api-utils/unload");
     loader.unload = function(reason, onError) {
             unloader.send(reason, onError);
     };
     return loader;
   };

   if (global.window) {
     // We're being loaded in a chrome window, or a web page with
     // UniversalXPConnect privileges.
     global.Cuddlefish = exports;
   } else if (global.exports) {
     // We're being loaded in a SecurableModule.
     for (let name in exports) {
       global.exports[name] = exports[name];
     }
   } else {
     // We're being loaded in a JS module.
     global.EXPORTED_SYMBOLS = [];
     for (let name in exports) {
       global.EXPORTED_SYMBOLS.push(name);
       global[name] = exports[name];
     }
   }
 })(this);
