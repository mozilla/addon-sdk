/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Cc,Ci,Cm,Cr,Cu} = require("chrome");

var jsm = {};
Cu.import("resource://gre/modules/XPCOMUtils.jsm", jsm);
var utils = exports.utils = jsm.XPCOMUtils;

Cm.QueryInterface(Ci.nsIComponentRegistrar);

var factories = [];

function Factory(options) {
  memory.track(this);

  this.wrappedJSObject = this;
  this.create = options.create;
  this.uuid = options.uuid;
  this.name = options.name;
  this.contractID = options.contractID;

  Cm.registerFactory(this.uuid,
                     this.name,
                     this.contractID,
                     this);

  var self = this;

  factories.push(this);
}

Factory.prototype = {
  createInstance: function(outer, iid) {
    try {
      if (outer)
        throw Cr.NS_ERROR_NO_AGGREGATION;
      return (new this.create()).QueryInterface(iid);
    } catch (e) {
      console.exception(e);
      if (e instanceof Ci.nsIException)
        throw e;
      else
        throw Cr.NS_ERROR_FAILURE;
    }
  },
  unregister: function() {
    var index = factories.indexOf(this);
    if (index == -1)
      throw new Error("factory already unregistered");

    var self = this;

    factories.splice(index, 1);
    Cm.unregisterFactory(this.uuid, this);
  },
  QueryInterface: utils.generateQI([Ci.nsIFactory])
};

var makeUuid = exports.makeUuid = function makeUuid() {
  var uuidGenerator = Cc["@mozilla.org/uuid-generator;1"]
                      .getService(Ci.nsIUUIDGenerator);
  var uuid = uuidGenerator.generateUUID();
  return uuid;
};

var autoRegister = exports.autoRegister = function autoRegister(path) {
  // TODO: This assumes that the url points to a directory
  // that contains subdirectories corresponding to OS/ABI and then
  // further subdirectories corresponding to Gecko platform version.
  // we should probably either behave intelligently here or allow
  // the caller to pass-in more options if e.g. there aren't
  // Gecko-specific binaries for a component (which will be the case
  // if only frozen interfaces are used).

  var runtime = require("./runtime");
  var osDirName = runtime.OS + "_" + runtime.XPCOMABI;
  var platformVersion = require("./xul-app").platformVersion.substring(0, 5);

  var file = Cc['@mozilla.org/file/local;1']
             .createInstance(Ci.nsILocalFile);
  file.initWithPath(path);
  file.append(osDirName);
  file.append(platformVersion);

  if (!(file.exists() && file.isDirectory()))
    throw new Error("component not available for OS/ABI " +
                    osDirName + " and platform " + platformVersion);

  Cm.QueryInterface(Ci.nsIComponentRegistrar);
  Cm.autoRegister(file);
};

var register = exports.register = function register(options) {
  options = {__proto__: options};
  if (!options.uuid)
    options.uuid = makeUuid();
  return new Factory(options);
};

var getClass = exports.getClass = function getClass(contractID, iid) {
  if (!iid)
    iid = Ci.nsISupports;
  return Cm.getClassObjectByContractID(contractID, iid);
};

require("./unload").when(
  function() {
    var copy = factories.slice();
    copy.reverse();
    copy.forEach(function(factory) { factory.unregister(); });
  });
