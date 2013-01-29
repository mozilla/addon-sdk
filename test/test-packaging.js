/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var url = require("sdk/url");
var file = require("sdk/io/file");
var {Cm,Ci} = require("chrome");
var options = require("@loader/options");

exports.testPackaging = function(test) {
  test.assertEqual(options.metadata.description,
                   "Add-on development made easy.",
                   "packaging metadata should be available");
  options.metadata.description = 'new description';
  test.assertEqual(options.metadata.description,
                   "Add-on development made easy.",
                   "packaging metadata should be frozen");

  test.assertEqual(options.metadata['private-browsing'], false,
                   "private browsing metadata should be available");
  test.assertEqual(options['private-browsing'], undefined,
                   "private browsing metadata should be be frozen");

  options['private-browsing'] = true;
  options.metadata['private-browsing'] = true;
  test.assertEqual(options.metadata['private-browsing'], false,
                   "private browsing metadata should be be frozen");
};
