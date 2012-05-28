# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

#Template used by test-main.js
TEST_MAIN_JS = '''\
var main = require("main");

exports.test_run = function(test) {
  test.pass("Unit test running!");
};

'''

#Template used by package.json
PACKAGE_JSON = '''\
{
  "name": "%(name)s",
  "fullName": "%(fullName)s",
  "description": "a basic add-on",
  "author": "",
  "license": "MPL 2.0",
  "version": "0.1"
}
'''
