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
require(FRAMESCRIPT_MANAGER).enableTabEvents();

const ppmm = Cc["@mozilla.org/parentprocessmessagemanager;1"].
             getService(Ci.nsIMessageBroadcaster);

const { setTimeout } = require('sdk/timers');

// abstracts the raw platform Sandbox using a promises-based api
const Sandbox = Class({

  // create a sandbox that inherits target's principals
  initialize: function(target, options) {
    if (!options.sandboxPrototype) {
      let { promise, resolve, reject } = defer();
      this.then = promise.then.bind(promise);
      setTimeout(_ => resolve(sandbox(target, options)), 1);
    }
    else {
      let { promise, resolve, reject } = defer();
      this.then = promise.then.bind(promise);

      options = options || {};
      options.metadata = options.metadata ? options.metadata : {};
      options.metadata.addonID = options.metadata.addonID ?
        options.metadata.addonID : self.id;

      let id = this;
      ppmm.addMessageListener('sdk/sandbox/result', function ssr({ objects }) {
        if (objects.id !== id)
          return;
        ppmm.removeMessageListener('sdk/sandbox/result', ssr);
        if (!objects.error) {
          resolve(objects.sandbox);
        }
        else {
          // console.exception('sandbox reject', objects.error);
          reject(objects.error);
        }
      })
      ppmm.broadcastAsyncMessage('sdk/sandbox/init', null,
                                 { target: target, options: options, id: id });
    }
  },

  // loads the code from given uri into sandbox
  load: function(uri) {
    // return this.then(sandbox => load(sandbox, uri));
    let { promise, resolve, reject } = defer();
    let id = this;
    ppmm.addMessageListener('sdk/sandbox/lresult', function ssl({ data, objects }) {
      if (objects.id !== id)
        return;
      ppmm.removeMessageListener('sdk/sandbox/lresult', ssl);
      if (!objects.error) {
        // console.log('load', data, objects.result, objects.result.inject, !!objects.result.inject, 
        //   !!Cu.waiveXrays(objects.result).inject, Cu.waiveXrays(objects.result).inject);
        resolve(objects.result);
      }
      else {
        console.exception('load reject', objects.error);
        reject(objects.error);
      }
      
    })
    this.then(sandbox => ppmm.broadcastAsyncMessage('sdk/sandbox/load', null,
                               { sandbox: sandbox, uri: uri, id: id }));
    return promise;
  },

  // evaluates code in the sandbox, returned promise resolves with result
  evaluate: function(code, uri, line, version) {
    // return this.then(sandbox => evaluate(sandbox, code, uri, line, version));
    let { promise, resolve, reject } = defer();
    let id = this;
    ppmm.addMessageListener('sdk/sandbox/eresult', function sse({ data, objects }) {
      if (objects.id !== id)
        return;
      ppmm.removeMessageListener('sdk/sandbox/eresult', sse);
      if (!objects.error) {
        // console.log('eval', objects.result);
        resolve(objects.result);
      }
      else {
        console.exception('eval reject', objects.error);
        reject(objects.error);
      }
      
    })
    this.then(sandbox => ppmm.broadcastAsyncMessage('sdk/sandbox/eval', null,
                               { sandbox: sandbox, code: code, uri: uri, line: line, version: version, id: id }));
    return promise;
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

  options = {};
  let t = Cu.waiveXrays(target);
  console.log(''+target, ''+t);
  let sandbox = Cu.Sandbox(t, options);
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
