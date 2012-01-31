/* vim:set ts=2 sw=2 sts=2 expandtab */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { messageManager } = require("chrome");
const { channel } = require("./channel");

module.exports = function load(module) {
  return {
    require: function require(id) {
      // Load required module on the chrome process.
      channel(messageManager, messageManager, 'require!').sync({
        requirer: module,
        id: id
      });
      return channel(messageManager, messageManager, id);
    }
  };
};
