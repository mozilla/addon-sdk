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
 *   Irakli Gozalishvili <gozala@mozilla.com>
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

const { jetpackID } = require('@packaging');

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
        if (false === next(raw ? message : message.json))
          messageManager.removeMessageListener(address, listener);
      });
      messageManager.addMessageListener(address, listener);
    },
    output: function output(data) {
      messageManager.sendAsyncMessage(address, data);
    },
    sync: !messageManager.sendSyncMessage ? null : function sync(data) {
      messageManager.sendSyncMessage(address, data);
    }
  };
};

