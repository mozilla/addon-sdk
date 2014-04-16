/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "stable"
};

const { Cc, Ci } = require("chrome");
const path = require("./fs/path");
const fs = require("./io/fs");
const prefs = require("./preferences/service");
const jpSelf = require("./self");
const timer = require("./timers");
const unload = require("./system/unload");
const { emit, on, off } = require("./event/core");
const { defer } = require('./core/promise');

const WRITE_PERIOD_PREF = "extensions.addon-sdk.simple-storage.writePeriod";
const WRITE_PERIOD_DEFAULT = 300000; // 5 minutes

const QUOTA_PREF = "extensions.addon-sdk.simple-storage.quota";
const QUOTA_DEFAULT = 5242880; // 5 MiB

const JETPACK_DIR_BASENAME = "jetpack";

Object.defineProperties(exports, {
  storage: {
    enumerable: true,
    get: function() { return manager.root; },
    set: function(value) { manager.root = value; }
  },
  quotaUsage: {
    get: function() { return manager.quotaUsage; }
  }
});

function getHash(data) {
  let { promise, resolve } = defer();

  let crypto = Cc["@mozilla.org/security/hash;1"].createInstance(Ci.nsICryptoHash);
  crypto.init(crypto.MD5);

  let listener = {
    onStartRequest: function() { },

    onDataAvailable: function(request, context, inputStream, offset, count) {
      crypto.updateFromStream(inputStream, count);
    },

    onStopRequest: function(request, context, status) {
      resolve(crypto.finish(false));
    }
  };

  let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].
                  createInstance(Ci.nsIScriptableUnicodeConverter);
  converter.charset = "UTF-8";
  let stream = converter.convertToInputStream(data);
  let pump = Cc["@mozilla.org/network/input-stream-pump;1"].
             createInstance(Ci.nsIInputStreamPump);
  pump.init(stream, -1, -1, 0, 0, true);
  pump.asyncRead(listener, null);

  return promise;
}

// A generic JSON store backed by a file on disk.  This should be isolated
// enough to move to its own module if need be...
function JsonStore(options) {
  this.filename = options.filename;
  this.quota = options.quota;
  this.writePeriod = options.writePeriod;
  this.onOverQuota = options.onOverQuota;
  this.onWrite = options.onWrite;
  this.hash = null;

  unload.ensure(this);

  this.writeTimer = timer.setInterval(this.write.bind(this),
                                      this.writePeriod);
}

JsonStore.prototype = {
  // The store's root.
  get root() {
    return this.isRootInited ? this._root : {};
  },

  // Performs some type checking.
  set root(val) {
    let types = ["array", "boolean", "null", "number", "object", "string"];
    if (types.indexOf(typeof(val)) < 0) {
      throw new Error("storage must be one of the following types: " +
                      types.join(", "));
    }
    this._root = val;
    return val;
  },

  // True if the root has ever been set (either via the root setter or by the
  // backing file's having been read).
  get isRootInited() {
    return this._root !== undefined;
  },

  // Percentage of quota used, as a number [0, Inf).  > 1 implies over quota.
  // Undefined if there is no quota.
  get quotaUsage() {
    return this.quota > 0 ?
           JSON.stringify(this.root).length / this.quota :
           undefined;
  },

  // Removes the backing file and all empty subdirectories.
  purge: function JsonStore_purge() {
    try {
      // This'll throw if the file doesn't exist.
      fs.unlinkSync(this.filename);
      this.hash = null;
      let parentPath = this.filename;
      do {
        parentPath = path.dirname(parentPath);
        // This'll throw if the dir isn't empty.
        fs.rmdirSync(parentPath);
      } while (path.basename(parentPath) !== JETPACK_DIR_BASENAME);
    }
    catch (err) {}
  },

  // Initializes the root by reading the backing file.
  read: function JsonStore_read() {
    try {
      let str = fs.readFileSync(this.filename, "UTF-8");

      this.root = JSON.parse(str);
      getHash(str).then(hash => this.hash = hash);
    }
    catch (err) {
      if (err.code != "ENOENT")
        console.error(err);
      this.root = {};
      this.hash = null;
    }
  },

  // Cleans up on unload.  If unloading because of uninstall, the store is
  // purged; otherwise it's written.
  unload: function JsonStore_unload(reason) {
    timer.clearInterval(this.writeTimer);
    this.writeTimer = null;

    if (reason === "uninstall")
      this.purge();
    else
      this.write();
  },

  // True if the root is an empty object.
  get _isEmpty() {
    if (this.root && typeof(this.root) === "object") {
      let empty = true;
      for (let key in this.root) {
        empty = false;
        break;
      }
      return empty;
    }
    return false;
  },

  // Writes the root to the backing file, notifying write observers when
  // complete.  If the store is over quota or if it's empty and the store has
  // never been written, nothing is written and write observers aren't notified.
  write: function JsonStore_write() {
    // Don't write if the root is uninitialized
    if (!this.isRootInited)
      return;

    fs.exists(this.filename, (err, exists) => {
      // Don't write if if the store is empty and the backing file doesn't exist.
      if (this._isEmpty && !exists)
        return;

      let data = JSON.stringify(this.root);

      // If the store is over quota, don't write.  The current under-quota state
      // should persist.
      if ((this.quota > 0) && (data.length > this.quota)) {
        this.onOverQuota(this);
        return;
      }

      // Hash the data to compare it to any previously written data
      getHash(data).then(hash => {
        if (hash == this.hash)
          return;

        // Finally, write.
        fs.writeFile(this.filename, data, "UTF-8", err => {
          if (err) {
            console.error("Error writing simple storage file: " + this.filename);
            return;
          }

          this.hash = hash;

          if (this.onWrite) {
            try {
              this.onWrite(this);
            }
            catch (e) {
              console.exception(e);
            }
          }
        });
      });
    });
  }
};


// This manages a JsonStore singleton and tailors its use to simple storage.
// The root of the JsonStore is lazy-loaded:  The backing file is only read the
// first time the root's gotten.
let manager = ({
  jsonStore: null,

  // The filename of the store, based on the profile dir and extension ID.
  get filename() {
    let storeFile = Cc["@mozilla.org/file/directory_service;1"].
                    getService(Ci.nsIProperties).
                    get("ProfD", Ci.nsIFile);
    storeFile.append(JETPACK_DIR_BASENAME);
    storeFile.append(jpSelf.id);
    storeFile.append("simple-storage");
    if (!fs.existsSync(storeFile.path))
      fs.mkdirSync(storeFile.path, 0o755);
    storeFile.append("store.json");
    return storeFile.path;
  },

  get quotaUsage() {
    return this.jsonStore.quotaUsage;
  },

  get root() {
    if (!this.jsonStore.isRootInited)
      this.jsonStore.read();
    return this.jsonStore.root;
  },

  set root(val) {
    return this.jsonStore.root = val;
  },

  unload: function manager_unload() {
    off(this);
  },

  new: function manager_constructor() {
    let manager = Object.create(this);
    unload.ensure(manager);

    manager.jsonStore = new JsonStore({
      filename: manager.filename,
      writePeriod: prefs.get(WRITE_PERIOD_PREF, WRITE_PERIOD_DEFAULT),
      quota: prefs.get(QUOTA_PREF, QUOTA_DEFAULT),
      onOverQuota: emit.bind(null, exports, "OverQuota")
    });

    return manager;
  }
}).new();

exports.on = on.bind(null, exports);
exports.removeListener = function(type, listener) {
  off(exports, type, listener);
};
