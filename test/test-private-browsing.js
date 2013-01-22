/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { pb, pbUtils } = require('./private-browsing/helper');
const { merge } = require('sdk/util/object');

// is global pb is enabled?
if (pbUtils.isGlobalPBSupported) {
  merge(module.exports, require('./private-browsing/global'));
}
else if (pbUtils.isWindowPBSupported) {
  merge(module.exports, require('./private-browsing/windows'));
}

exports.testIsPrivateDefaults = function() {
  test.assertEqual(pb.isPrivate(), false, 'undefined is not private');
  test.assertEqual(pb.isPrivate('test'), false, 'strings are not private');
  test.assertEqual(pb.isPrivate({}), false, 'random objects are not private');
  test.assertEqual(pb.isPrivate(4), false, 'numbers are not private');
  test.assertEqual(pb.isPrivate(/abc/), false, 'regex are not private');
  test.assertEqual(pb.isPrivate(function() {}), false, 'functions are not private');
};

// tests for the case where private browsing doesn't exist
exports.testDefault = function(test) {
  test.assertEqual(pb.isActive, false,
                   'pb.isActive returns false when private browsing isn\'t supported');
};
