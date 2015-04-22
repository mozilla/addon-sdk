/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Cc, Ci } = require("chrome");
const { OS: {File}} = require("resource://gre/modules/osfile.jsm");
const { Task } = require("resource://gre/modules/Task.jsm");
const { Conversion, Status } = require("dev/gcli");
const { fromFilename: toFileURI } = require("sdk/url");
const { ZipWriter } = require("./zip");
const { readManifest } = require("./rdf");
const { writeBootstrap } = require("./util");
const { read, remove, isDirectory, exists, list, listTree, uriToPath } = require("./io");
const { TextDecoder } = require("sdk/io/buffer");
const { tmpdir } = require("node/os");
const { uninstall, install, disable, enable } = require("sdk/addon/installer");
const { set, get } = require("sdk/preferences/service");
const { AddonManager } = require("resource://gre/modules/AddonManager.jsm");
const readID = require("jetpack-id/index");
const path = require("sdk/fs/path");

function getAllAddons() {
  return new Promise((resolve, reject) => {
    AddonManager.getAllAddons(resolve);
  });
};

const Addon = {
  name: "Addon",
  parent: "selection",
  stringifyProperty: "name",
  cacheable: true,
  onInstalled(addon) {
    this.clearCache();
  },
  onUninstalled(addon) {
    this.clearCache();
  },
  constructor() {
    // Tell GCLI to clear the cache of addons when one is added or removed
    AddonManager.addAddonListener(this);
  },
  lookup() {
    return getAllAddons().then(addons => {
      return addons.map(addon => {
        let name = addon.name + " " + addon.version;
        name = name.trim().replace(/\s/g, "_");
        return {name: name,
                id: addon.id,
                value: addon};
      });
    });
  }
};
exports.Addon = Addon;

const ExistingDirectoryPath = {
  name: "ExistingDirectoryPath",
  parent: "string",
  parse(arg) {
    const {text:input} = arg;
    return Task.spawn(function*() {
      if ((yield exists(input)) &&
          (yield isDirectory(input)))
      {

        let predictions = []
        let entries = yield list(input)
        for (let entry of entries) {
          if (yield isDirectory(entry)) {
            predictions.push({name: entry,
                              incomplete: true})
          }
        }
        return new Conversion(input, arg,
                              Status.VALID,
                              "",
                              predictions)
      } else {
        let base = path.dirname(input)
        if (!(yield exists(base)) ||
            !(yield isDirectory(base)))
        {
          return new Conversion(base, arg,
                                Status.ERROR,
                                "There is no directory matching typed path")
        } else {
          let predictions = []
          let entries = yield list(base)
          for (let entry of entries) {
            if (entry.startsWith(input) &&
                (yield isDirectory(entry)))
            {
              predictions.push({name: entry,
                                incomplete: true})
            }
          }

          if (predictions.length > 0) {
            return new Conversion(void(0), arg,
                                  Status.INCOMPLETE,
                                  "",
                                  predictions)
          } else {
            return new Conversion(input, arg,
                                  Status.ERROR,
                                  "There is no directories that match typed path",
                                  predictions)
          }
        }
      }
    });
  },
  stringify(value) {
    return value
  }
}
exports.ExistingDirectoryPath = ExistingDirectoryPath


const installAddon = {
  name: "addon install",
  description: "Install add-on xpi",
  params: [{name: "addon_xpi",
            type: "string",
            description: "Add-on to install by add-on xpi"}],
  exec: ({addon_xpi}) => {
    return install(addon_xpi)
  }
};
exports.installAddon = installAddon;

const uninstallAddon = {
  name: "addon uninstall",
  description: "Install add-on",
  params: [{name: "addon",
            type: "Addon",
            description: "Add-on to uninstall by add-on id"}],
  exec: ({addon}) => {
    return uninstall(addon.id);
  }
};
exports.uninstallAddon = uninstallAddon;

const mountAddon = {
  name: "addon mount",
  description: "Load folder as an add-on",
  params: [{name: "path",
            type: "ExistingDirectoryPath",
            description: "Path to an add-on directory"}],
  exec: ({path: root}, context) => {
    let mountURI = toFileURI(root)
    return Task.spawn(function*() {
      const manifestData = yield read(path.join(root, "package.json"));
      const decoder = new TextDecoder();
      const manifest = JSON.parse(decoder.decode(manifestData));
      const id = readID(manifest);
      const rdf = readManifest(manifest);
      const bootstrap = writeBootstrap(mountURI, manifest);
      const xpiPath = `${tmpdir()}/${manifest.name}.xpi`
      const zip = new ZipWriter({
        "bootstrap.js": new ZipWriter.StringDataEntry(bootstrap),
        "install.rdf": new ZipWriter.StringDataEntry(rdf)
      });
      yield zip.write(xpiPath);
      yield install(xpiPath);
      yield remove(xpiPath);

      set(`extensions.${id}.mountURI`, mountURI);

      return id;
    });
  }
};
exports.mountAddon = mountAddon;

const reloadAddon = {
  name: "addon reload",
  description: "Reload add-on",
  params: [{name: "addon",
            type: "Addon",
            description: "Add-on to reloaded by addon id"}],
  exec: ({addon}) => {
    return disable(addon.id).then(_ => {
      Cc["@mozilla.org/observer-service;1"].
        getService(Ci.nsIObserverService).
        notifyObservers({}, "startupcache-invalidate", null);

      return enable(addon.id);
    });
  }
};
exports.reloadAddon = reloadAddon;

const exportAddon = {
  name: "addon export",
  description: "Export an add-on as an xpi",
  params: [{name: "addon",
            type: "Addon",
            description: "Mounted add-on to export"},
           {name: "path",
            type: "ExistingDirectoryPath",
            description: "Path to export add-on to"}],
  exec({addon, path: targetPath}) {
    return Task.spawn(function*() {
      const mountURI = get(`extensions.${addon.id}.mountURI`)
      if (mountURI) {
        const root = uriToPath(mountURI);
        const manifestData = yield read(path.join(root, "package.json"));
        const decoder = new TextDecoder();
        const manifest = JSON.parse(decoder.decode(manifestData));
        const rdf = readManifest(manifest);
        const bootstrap = writeBootstrap(null, manifest);
        const xpiPath = `${targetPath}/${manifest.name}.xpi`

        const content = {
          "bootstrap.js": new ZipWriter.StringDataEntry(bootstrap),
          "install.rdf": new ZipWriter.StringDataEntry(rdf)
        };

        const entries = yield listTree(root, {includeDirectories: false});
        for (let entry of entries) {
          content[`src/${path.relative(root, entry)}`] = new ZipWriter.FileEntry(entry);
        }

        const zip = new ZipWriter(content);
        yield zip.write(xpiPath);
      } else {
        throw Error("Only mounted add-ons can be exported");
      }
    });
  }
};
exports.exportAddon = exportAddon;
