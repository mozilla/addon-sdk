'use strict';

const { isPrivate } = require('sdk/private-browsing');
const { isWindowPBSupported } = require('sdk/private-browsing/utils');
const { onFocus, open: openWindow, close, getMostRecentWindow, windows } = require('sdk/window/utils');
const { browserWindows } = require("sdk/windows");
const winUtils = require("sdk/deprecated/window-utils");

// test that it is not possible to find a private window in
// windows module's iterator
exports.testWindowIteratorPrivateDefault = function(assert, done) {
  assert.equal(browserWindows.length, 1, 'only one window open');

  let window = openWindow('chrome://browser/content/browser.xul', {
    features: {
      private: true,
      chrome: true
    }
  });
  window.addEventListener('load', function onLoad() {
    window.removeEventListener('load', onLoad, false);

    // test that there is a private window opened
    assert.equal(isPrivate(window), isWindowPBSupported, 'there is a private window open');
    assert.equal(isPrivate(winUtils.activeWindow), isWindowPBSupported);
    assert.equal(isPrivate(getMostRecentWindow()), isWindowPBSupported);
    assert.equal(isPrivate(browserWindows.activeWindow), isWindowPBSupported);

    assert.equal(browserWindows.length, 2, '2 windows open');
    assert.equal(windows().length, 2);
    assert.equal(windows().length, 2);

    close(window).then(function() done());
  }, false);
};
