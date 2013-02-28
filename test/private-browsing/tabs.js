'use strict';

const { Ci } = require('chrome');
const { pb, pbUtils, loader: pbLoader, getOwnerWindow } = require('./helper');

exports.testIsPrivateOnTab = function(assert) {
  const { openTab, closeTab } = pbLoader.require('sdk/tabs/utils');

  let window = pbLoader.require('sdk/windows').browserWindows.activeWindow;
  let chromeWindow = pbLoader.require('sdk/private-browsing/window/utils').getOwnerWindow(window);

  assert.ok(chromeWindow instanceof Ci.nsIDOMWindow, 'associated window is found');
  assert.ok(!pb.isPrivate(chromeWindow), 'the top level window is not private');

  let rawTab = openTab(chromeWindow, 'data:text/html;charset=utf-8,<h1>Hi!</h1>', {
  	isPrivate: true
  });

  // test that the tab is private
  assert.ok(rawTab.browser.docShell.QueryInterface(Ci.nsILoadContext).usePrivateBrowsing);
  assert.ok(pb.isPrivate(rawTab.browser.contentWindow));
  assert.ok(pb.isPrivate(rawTab.browser));

  closeTab(rawTab);
}

exports.testTabPrivateBrowsingExit = function(assert, done) {
  const { openTab, closeTab } = pbLoader.require('sdk/tabs/utils');

  let closed = 0;

  pb.once('exit', function onExit() {
    assert.equal(closed, rawTabs.length, "'exit' event is emitted when all private windows are closed");
    done();
  })

  let window = pbLoader.require('sdk/windows').browserWindows.activeWindow;
  let chromeWindow = pbLoader.require('sdk/private-browsing/window/utils').getOwnerWindow(window);

  let rawTabs = [
    openTab(chromeWindow, 'data:text/html;charset=utf-8,<h1>Hi!</h1>', {
      isPrivate: true
    }),
    openTab(chromeWindow, 'data:text/html;charset=utf-8,<h1>Hi!</h1>', {
      isPrivate: true
    })
  ];

  rawTabs.forEach(function(rawTab) {
    rawTab.browser.parentNode.addEventListener("TabClose", function onClose() {
      this.removeEventListener("TabClose", onClose);
      closed++;
    });
  })

  rawTabs.forEach(closeTab);
}

require("test").run(exports);
