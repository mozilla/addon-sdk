/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const tmp = require("sdk/test/tmp-file");
const file = require("sdk/io/file");

const testFolderURL = module.uri.split('test-tmp-file.js')[0];

exports.testCreateFromString = function (test) {
  let expectedContent = "foo";
  let path = tmp.createFromString(expectedContent);
  let content = file.read(path);
  test.assertEqual(content, expectedContent,
                   "Temporary file contains the expected content");
}

exports.testCreateFromURL = function (test) {
  let url = testFolderURL + "test-tmp-file.txt";
  let path = tmp.createFromURL(url);
  let content = file.read(path);
  test.assertEqual(content, "foo",
                   "Temporary file contains the expected content");
}

exports.testCreateDirectory = function (test) {
  let path = tmp.createDirectory("directory");
  test.assert(!file.isFile(path), "Temporary directory isn't a file");
  test.assertEqual(file.list(path).length, 0,
                   "Temporary directory can be listed");
}
