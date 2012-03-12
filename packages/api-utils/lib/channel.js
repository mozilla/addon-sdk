/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { jetpackID } = require('@packaging');
const { when } = require('./unload');

// TODO: Create a bug report and remove this workaround once it's fixed.
// Only function needs defined in the context of the message manager window
// can be registered via `addMessageListener`.
function listener(callee) {
  return function listener() { return callee.apply(this, arguments); };
}
function messageListener(scope, callee) {
  return scope ? scope.eval('(' + listener + ')')(callee) : callee
}

exports.channel = function channel(scope, messageManager, address, raw) {
  address = jetpackID + ':' + address
  return {
    input: function input(next, stop) {
      let listener = messageListener(scope, function onMessage(message) {
        if (false === next(raw ? message : message.json) && listener) {
          messageManager.removeMessageListener(address, listener);
          listener = null;
        }
      });
      messageManager.addMessageListener(address, listener);

      // Bug 724433: do not leak `listener` on addon disabling
      when(function () {
        if (listener) {
          messageManager.removeMessageListener(address, listener);
          listener = null;
        }
      });
    },
    output: function output(data) {
      messageManager.sendAsyncMessage(address, data);
    },
    sync: !messageManager.sendSyncMessage ? null : function sync(data) {
      messageManager.sendSyncMessage(address, data);
    }
  };
};

