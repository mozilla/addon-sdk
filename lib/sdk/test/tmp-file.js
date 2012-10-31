/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Cc, Ci } = require("chrome");

const system = require("sdk/system");
const file = require("sdk/io/file");
const unload = require("sdk/system/unload");

// Retrieve the path to the OS temporary directory:
const tmpDir = require("sdk/system").pathFor("TmpD");

// List of all tmp file created (files or directories)
let files = [];

// Remove all tmp files on addon disabling
unload.when(function () {
  files.forEach(function (file){
    // Catch exception in order to avoid leaking following files
    try {
      if (file.exists()) {
        // Remove recursively for directories
        file.remove(true);
      }
    }
    catch(e) {
      console.exception(e);
    }
  });
});

// Utility function that synchronously reads local resource from the given
// `uri` and returns content string. Read in binary mode.
function readBinaryURI(uri) {
  let ioservice = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
  let channel = ioservice.newChannel(uri, "UTF-8", null);
  let stream = Cc["@mozilla.org/binaryinputstream;1"].
               createInstance(Ci.nsIBinaryInputStream);
  stream.setInputStream(channel.open());

  let data = "";
  while (true) {
    let available = stream.available();
    if (available <= 0)
      break;
    data += stream.readBytes(available);
  }
  stream.close();

  return data;
}

const { NORMAL_FILE_TYPE, DIRECTORY_TYPE } = Ci.nsIFile;

function createFile(type, name) {
  let file = tmpDir.clone();
  file.append(name ? name : "tmp-file");
  file.createUnique(type, parseInt(666, 8));
  files.push(file);
  return file.path;
}

// Create a temporary file from a given string and returns its path
exports.createFromString = function createFromString(data, tmpName) {  
  let path = createFile(NORMAL_FILE_TYPE, tmpName);

  let tmpFile = file.open(path, "wb");
  tmpFile.write(data);
  tmpFile.close();

  return path;
}

// Create a temporary file from a given URL and returns its path
exports.createFromURL = function createFromURL(url, tmpName) {
  let data = readBinaryURI(url);
  return exports.createFromString(data, tmpName);
}

// Returns a temporary directory path
exports.createDirectory = function createDirectory(tmpName) {
  return createFile(DIRECTORY_TYPE, tmpName);
}
