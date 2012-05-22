/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var url = require("url");
var file = require("file");
var {Cm,Ci} = require("chrome");
var options = require("@loader/options");

exports.testPackaging = function(test) {

  test.assertEqual(options.metadata.author,
                   'Atul Varma (http://toolness.com/)',
                   "packaging metadata should be available");
};
