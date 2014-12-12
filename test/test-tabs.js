/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

module.metadata = {
  'engines': {
    'Firefox': '*',
    'Fennec': '*'
  }
};

const app = require('sdk/system/xul-app');
const packaging = require("@loader/options");

if (packaging.isNative) {
  module.exports = {
    "test skip on jpm": (assert) => assert.pass("skipping this file with jpm")
  };
  require("sdk/test").run(exports);
}
else if (app.is('Fennec')) {
  module.exports = require('./tabs/test-fennec-tabs');
}
else {
  module.exports = require('./tabs/test-firefox-tabs');
}
