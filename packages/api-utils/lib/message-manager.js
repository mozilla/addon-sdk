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
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Matteo Ferretti <zer0@mozilla.com>
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

const BAD_LISTENER = "The event listener must be a function.";

const { Cc, Ci, Cu, CC } = require("chrome");
const { setTimeout } = require("./timer");

const { ns } = require("./namespace");

const { curry, invoke } = require("./utils/function");

const Sandbox = require("./sandbox");

// JSON.stringify is buggy with cross-sandbox values,
// it may return "{}" on functions. Use a replacer to match them correctly.
const jsonFixer = function (k, v) typeof v === "function" ? undefined : v;

/**
 * Defers invoking the function until the current call stack has cleared.
 *
 * @param {Function} fn
 *    The function to defer.
 *
 * @returns {Function}
 *    The deferred function
 */
const defer =  function(fn) function() {
  setTimeout(invoke, 0, fn, arguments, this)
};

/**
 * Adds a message listener.
 * This listener will receive messages sent from the remote frame.
 *
 * @param {String} name
 *    The name of the message for which to add a listener.
 * @param {Function} listener
 *    The listener function called when the message is received.
 */
function addMessageListener(name, listener) {
  if (typeof listener !== "function")
    throw new Error(BAD_LISTENER);

  let listeners = frame(this).listeners;

  if (name in listeners) {
    if (~listeners[name].indexOf(listener))
      return;
  } else {
    listeners[name] = [];
  }

  listeners[name].push(listener);
}

/**
 * Removes a message listener previously added by calling addMessageListener.
 *
 * @param {String} name
 *    The name of the message for which to remove a listener.
 * @param {Function} listener
 *    The listener function has to be removed.
 */
function removeMessageListener(name, listener) {
  if (typeof listener !== "function")
    throw new Error(BAD_LISTENER);

  let listeners = frame(this).listeners;

  if (!(name in listeners))
    return;

  let index = listeners[name].indexOf(listener);

  if (~index) {
    listeners[name].splice(index, 1);
  }
}

/**
 * Sends a message to the listeners.
 *
 * @param {Boolean} sync
 *    Indicates if the call is synchronous or asynchronous
 * @param {String} name
 *    The name of the message to send to the listeners.
 * @param {Object} [data=null]
 *    A JSON object containing data to be delivered to the listeners.
 *
 * @returns {Array|undefined}
 *    An array with the return values of the listeners if `sync` is `true`,
 *    otherwise `undefined`.
 */
function sendMessage(sync, name, data) {
  typeof data === "undefined" && (data = null);

  let listeners = frame(frame(this).receiver).listeners;

  let responses = [];

  let returnValue = sync ? responses : undefined;

  if (!(name in listeners))
    return returnValue;

  let json = JSON.parse(JSON.stringify(data, jsonFixer));

  for each(let listener in listeners[name]) {
    try {
      let response = listener.call(null, {
        sync : sync,
        name : name,
        json : json,
        target : null
      });

      if (sync) {
        if (typeof response === "undefined")
          responses.push(response);
        else
          responses.push(JSON.parse(JSON.stringify(response, jsonFixer)));
      }

    } catch (e) {
      console.exception(e);
    }
  }
  return returnValue;
};

let sendSyncMessage = curry(sendMessage, true);
let sendAsyncMessage = curry(defer(sendMessage), false);

let frame = ns({receiver: null, listeners: null});

/**
 * The MessageManager object emulates the Message Manager API, without creating
 * new processes. It useful in mono process context, like Fennec.
 *
 * @see
 *    https://developer.mozilla.org/en/The_message_manager
 */
function MessageManager() {

  let sandbox = Sandbox.sandbox(null, { wantXrays : false });

  Object.defineProperties(sandbox, {
    addMessageListener: {value: addMessageListener.bind(sandbox)},

    removeMessageListener: { value: removeMessageListener.bind(sandbox)},

    sendAsyncMessage: {value: sendAsyncMessage.bind(sandbox)},

    sendSyncMessage: { value: sendSyncMessage.bind(sandbox) }
  });

  frame(this).receiver = sandbox;
  frame(sandbox).receiver = this;

  frame(this).listeners = {};
  frame(sandbox).listeners = {};
}

MessageManager.prototype = {
  constructor: MessageManager,

  addMessageListener : addMessageListener,

  removeMessageListener : removeMessageListener,

  sendAsyncMessage : sendAsyncMessage,

  /**
   * Loads a script into the remote frame.
   *
   * @param {String} uri
   *    The URL of the script to load into the frame; this must be an absolute
   *    local URL, but data: URLs are supported.
   * @param {Boolean} allowDelayedLoad
   *    Not used.
   */
  loadFrameScript: function loadFrameScript(uri, async) {
    if (arguments.length < loadFrameScript.length)
      throw new Error("Not enough arguments");

    let sandbox = frame(this).receiver;

    try {
      Sandbox.load(sandbox, uri);
    } catch (e) {
      console.exception(e)
    }
  }
}

Object.freeze(MessageManager);
Object.freeze(MessageManager.prototype);

exports.MessageManager = MessageManager;
