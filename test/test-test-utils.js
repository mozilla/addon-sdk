/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict'

const { cleanUI } = require('sdk/test/utils');
const tabs = require('sdk/tabs');

exports.testCleanUIWithExtraTabAndWindow = function(assert, done) {
  tabs.open({
    url: "about:blank",
    inNewWindow: true,
    onOpen: () => {
      cleanUI().then(() => {
        assert.pass("the ui was cleaned");
        assert.equal(tabs.length, 1, 'there is only one tab open');
      }).then(done).catch(assert.fail);
    }
  });
}

exports.testCleanUIWithOnlyExtraTab = function(assert, done) {
  tabs.open({
    url: "about:blank",
    onOpen: () => {
      cleanUI().then(() => {
        assert.pass("the ui was cleaned");
        assert.equal(tabs.length, 1, 'there is only one tab open');
      }).then(done).catch(assert.fail);
    }
  });
}

require('sdk/test').run(exports);
