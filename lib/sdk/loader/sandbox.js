/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

module.metadata = {
  "stability": "experimental"
};

const { Cc, Ci, CC, Cu } = require('chrome');
const systemPrincipal = CC('@mozilla.org/systemprincipal;1', 'nsIPrincipal')();
const scriptLoader = Cc['@mozilla.org/moz/jssubscript-loader;1'].
                     getService(Ci.mozIJSSubScriptLoader);
const self = require('sdk/self');
const { getTabId, getTabForContentWindow } = require('../tabs/utils');
const { getInnerId } = require('../window/utils');

const { devtools } = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const { require: devtoolsRequire } = devtools;
const { addContentGlobal, removeContentGlobal } = devtoolsRequire("devtools/server/content-globals");

const { Class } = require('sdk/core/heritage');
const { promised, defer } = require('../core/promise');
const { getFrameElement } = require("../window/utils");

const FRAMESCRIPT_MANAGER = '../../framescript/FrameScriptManager.jsm';
const { loadSandboxHelper } = require(FRAMESCRIPT_MANAGER);

// abstracts the raw platform Sandbox using a promises-based api
const Sandbox = Class({

  // create a sandbox that inherits target's principals
  initialize: function(target, options) {
    if (!options.sandboxPrototype) {
      let init = promised(sandbox)(target, options);
      this.then = init.then.bind(init);
    }
    else {
      let { promise, resolve } = defer();
      this.then = promise.then.bind(promise);
      let id = {};

      options = options || {};
      options.metadata = options.metadata ? options.metadata : {};
      options.metadata.addonID = options.metadata.addonID ?
        options.metadata.addonID : self.id;

      loadSandboxHelper(options.sandboxPrototype).then(mm => {
        mm.addMessageListener('sdk/sandbox/result', function ssr({ objects }) {
          if (objects.id === id) {
            mm.removeMessageListener('sdk/sandbox/result', ssr);
            resolve(objects.sandbox);
          }
        });
        mm.sendAsyncMessage('sdk/sandbox/create', null, { id: id, target: target, options: options });
      });
    }
  },

  // loads the code from given uri into sandbox
  load: function(uri) {
    return this.then(sandbox => load(sandbox, uri));
  },

  // evaluates code in the sandbox, returned promise resolves with result
  evaluate: function(code, uri, line, version) {
    return this.then(sandbox => evaluate(sandbox, code, uri, line, version));
  },

  // forces the sandbox to be freed immediately
  nuke: function() {
    return this.then(sandbox => nuke(sandbox));
  }
})

exports.Sandbox = Sandbox;


function sandbox(target, options) {
  options = options || {};
  options.metadata = options.metadata ? options.metadata : {};
  options.metadata.addonID = options.metadata.addonID ?
    options.metadata.addonID : self.id;

  let sandbox = Cu.Sandbox(target || systemPrincipal, options);
  Cu.setSandboxMetadata(sandbox, options.metadata);
  let innerWindowID = options.metadata['inner-window-id']
  if (innerWindowID) {
    addContentGlobal({
      global: sandbox,
      'inner-window-id': innerWindowID
    });
  }
  return sandbox;
}
exports.sandbox = sandbox;

function evaluate(sandbox, code, uri, line, version) {
  return Cu.evalInSandbox(code, sandbox, version || '1.8', uri || '', line || 1);
}
exports.evaluate = evaluate;

function load(sandbox, uri) {
  if (uri.indexOf('data:') === 0) {
    let source = uri.substr(uri.indexOf(',') + 1);

    return evaluate(sandbox, decodeURIComponent(source), '1.8', uri, 0);
  } else {
    return scriptLoader.loadSubScript(uri, sandbox, 'UTF-8');
  }
}
exports.load = load;

function nuke(sandbox) {
  Cu.nukeSandbox(sandbox);
}
exports.nuke = nuke;
