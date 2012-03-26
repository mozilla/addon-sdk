/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { Cc, Ci, btoa } = require("chrome");

const imageTools = Cc["@mozilla.org/image/tools;1"].
                    getService(Ci.imgITools);

const io = Cc["@mozilla.org/network/io-service;1"].
                    getService(Ci.nsIIOService);

// Test the typical use case, setting & getting with no flavors specified
exports.testWithNoFlavor = function(test) {
  var contents = "hello there";
  var flavor = "text";
  var fullFlavor = "text/unicode";
  var clip = require("clipboard");
  // Confirm we set the clipboard
  test.assert(clip.set(contents));
  // Confirm flavor is set
  test.assertEqual(clip.currentFlavors[0], flavor);
  // Confirm we set the clipboard
  test.assertEqual(clip.get(), contents);
  // Confirm we can get the clipboard using the flavor
  test.assertEqual(clip.get(flavor), contents);
  // Confirm we can still get the clipboard using the full flavor
  test.assertEqual(clip.get(fullFlavor), contents);
};

// Test the slightly less common case where we specify the flavor
exports.testWithFlavor = function(test) {
  var contents = "<b>hello there</b>";
  var contentsText = "hello there";
  var flavor = "html";
  var fullFlavor = "text/html";
  var unicodeFlavor = "text";
  var unicodeFullFlavor = "text/unicode";
  var clip = require("clipboard");
  test.assert(clip.set(contents, flavor));
  test.assertEqual(clip.currentFlavors[0], unicodeFlavor);
  test.assertEqual(clip.currentFlavors[1], flavor);
  test.assertEqual(clip.get(), contentsText);
  test.assertEqual(clip.get(flavor), contents);
  test.assertEqual(clip.get(fullFlavor), contents);
  test.assertEqual(clip.get(unicodeFlavor), contentsText);
  test.assertEqual(clip.get(unicodeFullFlavor), contentsText);
};

// Test that the typical case still works when we specify the flavor to set
exports.testWithRedundantFlavor = function(test) {
  var contents = "<b>hello there</b>";
  var flavor = "text";
  var fullFlavor = "text/unicode";
  var clip = require("clipboard");
  test.assert(clip.set(contents, flavor));
  test.assertEqual(clip.currentFlavors[0], flavor);
  test.assertEqual(clip.get(), contents);
  test.assertEqual(clip.get(flavor), contents);
  test.assertEqual(clip.get(fullFlavor), contents);
};

exports.testNotInFlavor = function(test) {
  var contents = "hello there";
  var flavor = "html";
  var clip = require("clipboard");
  test.assert(clip.set(contents));
  // If there's nothing on the clipboard with this flavor, should return null
  test.assertEqual(clip.get(flavor), null);
};

exports.testSetImage = function(test) {
  var clip = require("clipboard");
  var flavor = "image";
  var fullFlavor = "image/png";

  var base64Data = "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAQ0lEQVRYhe3OwQkAIBTD0Oyqg7idbqUr9B9EhBRyLY8F+0akEyBAgIBvAI1eCuaIEiBAgAABzwH50sNqAgQIEPAYcABJQw5EXdmcNgAAAABJRU5ErkJggg==";
  var contents = "data:image/png;base64," + encodeURIComponent(base64Data);
  test.assert(clip.set(contents, flavor), "clipboard set");
  test.assertEqual(clip.currentFlavors[0], flavor, "flavor is set");

  test.assertEqual(clip.get(), contents, "image data equals");
};

/*
exports.testSetImageTypeNotSupported = function(test) {
  var clip = require("clipboard");
  var flavor = "image";

  var base64Data = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAAgACADAREAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD5Kr8kP9CwoA5f4m/8iRqX/bH/ANHJXr5F/wAjCn8//SWfnnir/wAkji/+4f8A6dgeD1+iH8bn1BX5If6FmFqWpXtveyQwzbUXGBtB7D2r9l4U4UyjMsoo4rFUeacua75pLaUktFJLZH5NxNxNmmX5pVw2Gq8sI8tlyxe8U3q03uzD8S3dxqOi3NneSeZDJs3LgDOHBHI56gV+kcG+H/DmJzuhSq4e8XzfbqfyS/vH5rx1xTm2MyDEUa1W8XyXXLFbTi+kThv7B0r/AJ9f/H2/xr90/wCIVcI/9An/AJUq/wDyZ/O/16v/ADfgv8j0r/hZvgj/AKDf/ktN/wDEV/nr/YWYf8+/xj/mf3R/xFXhH/oL/wDKdX/5AzrvxLouo3D3lne+ZDJja3luM4GDwRnqDX9LeH/Bud4nhzD1aVC8Xz/ah/z8l/ePx/injrIMZm1WtRxF4vls+Sa2jFdYlDUdRsp7OSKKbc7YwNpHce1fqfCvCub5bm9HFYqjywjzXfNF7xklopN7s+C4l4lyvMMrq4fD1bzfLZcsltJPqktkYlfsZ+UnBV/nufVnXaD/AMgqD/gX/oRr+xvCr/kkcJ/3E/8ATsz5/Hfx5fL8kX6/QjkCgD//2Q==";
  var contents = "data:image/jpeg;base64," + encodeURIComponent(base64Data);

  test.assert(clip.set(contents, flavor), "clipboard set");

};

exports.AtestSetImageTypeWrongData = function(test) {
  let base64Data = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAAgACADAREAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD5Kr8kP9CwoA5f4m/8iRqX/bH/ANHJXr5F/wAjCn8//SWfnnir/wAkji/+4f8A6dgeD1+iH8bn1BX5If6FmFqWpXtveyQwzbUXGBtB7D2r9l4U4UyjMsoo4rFUeacua75pLaUktFJLZH5NxNxNmmX5pVw2Gq8sI8tlyxe8U3q03uzD8S3dxqOi3NneSeZDJs3LgDOHBHI56gV+kcG+H/DmJzuhSq4e8XzfbqfyS/vH5rx1xTm2MyDEUa1W8XyXXLFbTi+kThv7B0r/AJ9f/H2/xr90/wCIVcI/9An/AJUq/wDyZ/O/16v/ADfgv8j0r/hZvgj/AKDf/ktN/wDEV/nr/YWYf8+/xj/mf3R/xFXhH/oL/wDKdX/5AzrvxLouo3D3lne+ZDJja3luM4GDwRnqDX9LeH/Bud4nhzD1aVC8Xz/ah/z8l/ePx/injrIMZm1WtRxF4vls+Sa2jFdYlDUdRsp7OSKKbc7YwNpHce1fqfCvCub5bm9HFYqjywjzXfNF7xklopN7s+C4l4lyvMMrq4fD1bzfLZcsltJPqktkYlfsZ+UnBV/nufVnXaD/AMgqD/gX/oRr+xvCr/kkcJ/3E/8ATsz5/Hfx5fL8kX6/QjkCgD//2Q==";

  var contents = "data:image/png;base64," + encodeURIComponent(base64Data);

};

exports.AtestGetImage = function(test) {

};

*/

// TODO: Test error cases.
