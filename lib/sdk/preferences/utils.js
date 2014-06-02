/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const tabs = require("sdk/tabs");
const { defer, all } = require("sdk/core/promise");
const { on, off } = require("sdk/system/events");
const { setTimeout } = require("sdk/timers");

function open({ id }) {
  let showing = defer();
  let loaded = defer();
  let result = { id: id };

  tabs.open({
    url: 'about:addons',
    onReady: tab => {
      on("addon-options-displayed", function onPrefDisplayed({ subject: doc, data }) {
        if (data === id) {
          off("addon-options-displayed", onPrefDisplayed);
          result.tab = tab;
          result.document = doc;
          loaded.resolve();
        }
      }, true);

      let worker = tab.attach({
        contentScriptWhen: 'end',
        contentScript: 'function onLoad() {\n' +
                         'unsafeWindow.removeEventListener("load", onLoad, false);\n' +
                         'AddonManager.getAddonByID("' + id + '", (aAddon) => {\n' +
                           'unsafeWindow.gViewController.viewObjects.detail.node.addEventListener("ViewChanged", function whenViewChanges() {\n' +
                             'unsafeWindow.gViewController.viewObjects.detail.node.removeEventListener("ViewChanged", whenViewChanges, false);\n' +
                             'setTimeout(_ => self.postMessage("show"))\n' +
                           '}, false);\n' +
                           'unsafeWindow.gViewController.commands.cmd_showItemDetails.doCommand(aAddon, true);\n' +
                         '});\n' +
                       '}\n' +
                       // Wait for the load event ?
                       'if (document.readyState == "complete") {\n' +
                         'onLoad()\n' +
                       '} else {\n' +
                         'unsafeWindow.addEventListener("load", onLoad, false);\n' +
                       '}\n',
        onMessage: _ => {
          showing.resolve()
        }
      });
    }
  });

  return all([ showing.promise, loaded.promise ]).then(_ => result);
}
exports.open = open;
