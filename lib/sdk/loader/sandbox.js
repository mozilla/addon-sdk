/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

module.metadata = {
  "stability": "experimental"
};

const self = require('sdk/self');
const { Cc, Ci, Cu } = require('chrome');

const { devtools } = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const { addContentGlobal } = devtools['require']("devtools/server/content-globals");

const { uuid } = require('../util/uuid');
const { defer } = require('../core/promise');
const { Class } = require('../core/heritage');

const SANDBOX_HELPER = '../../framescript/SandboxHelper.jsm';
const { sandbox, load, evaluate, nuke } = require(SANDBOX_HELPER);

const FRAMESCRIPT_MANAGER = '../../framescript/FrameScriptManager.jsm';
require(FRAMESCRIPT_MANAGER).enableTabEvents();

const ppmm = Cc["@mozilla.org/parentprocessmessagemanager;1"].
             getService(Ci.nsIMessageBroadcaster);

// abstracts the raw platform Sandbox using a promises-based api
const Sandbox = Class({

  // create a sandbox that inherits target's principals
  initialize: function(target, options) {
    let options = metadata(options);
    let init = remotePromiseCall('sdk/sandbox/init', {
      target, options, sandbox: options.sandboxPrototype || {}
    });
    this.then = init.then.bind(promise);
  },

  // loads the code from given uri into sandbox
  load: function(uri) {
    return this.then(sandbox => remotePromiseCall('sdk/sandbox/load', {
      sandbox, uri
    }));
  },

  // evaluates code in the sandbox, returned promise resolves with result
  evaluate: function(code, uri, line, version) {
    return this.then(sandbox => remotePromiseCall('sdk/sandbox/evaluate', {
      sandbox, code, uri, line, version
    }));
  },

  // forces the sandbox to be freed immediately
  nuke: function() {
    return this.then(sandbox => remotePromiseCall('sdk/sandbox/nuke', {
      sandbox
    }));
  }
})

exports.Sandbox = Sandbox;

function remotePromiseCall(name, args) {
  let { promise, resolve, reject } = defer();

  // unique id for this promise call
  args._id = uuid();

  ppmm.addMessageListener(name + '/response', listener);
  ppmm.broadcastAsyncMessage(name, null, args);

  function listener({ objects: { id, result, error }}) {
    if (id != args.id)
      return;
    if (!error) {
      resolve(result);
    }
    else {
      reject(error);
      console.error(name, error);
    }
    ppmm.removeMessageListener(name + '/response', listener);
  }

  return promise;
}

function metadata(options) {
  options = options || {};
  options.metadata = options.metadata || {};
  options.metadata.addonID = options.metadata.addonID || self.id;
  return options;
}

exports.sandbox = (target, options) => sandbox(target, metadata(options));

exports.evaluate = evaluate;

exports.load = load;

exports.nuke = nuke;
