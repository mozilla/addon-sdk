/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "experimental"
};

const {Cc, Ci} = require("chrome");
const { Class } = require("../core/heritage");
const { ns } = require("../core/namespace");
const { streamMixin, StreamManager } = require("./utils");

// This just controls the maximum number of bytes we read in at one time.
const BUFFER_BYTE_LEN = 0x8000;

const streamNS = ns();

const ByteReader = Class({
  implements: [streamMixin(stream => streamNS(stream).manager)],
  initialize: function (inputStream) {
    let stream = Cc["@mozilla.org/binaryinputstream;1"].
                 createInstance(Ci.nsIBinaryInputStream);
    stream.setInputStream(inputStream);

    streamNS(this).manager = new StreamManager(this, stream);
    streamNS(this).stream = stream;
  },
  read: function ByteReader_read(numBytes) {
    let { stream, manager } = streamNS(this);
    manager.ensureOpened();
    if (typeof(numBytes) !== "number")
      numBytes = Infinity;

    let data = "";
    let read = 0;
    try {
      while (true) {
        let avail = stream.available();
        let toRead = Math.min(numBytes - read, avail, BUFFER_BYTE_LEN);
        if (toRead <= 0)
          break;
        data += stream.readBytes(toRead);
        read += toRead;
      }
    }
    catch (err) {
      throw new Error("Error reading from stream: " + err);
    }

    return data;
  }
});

const ByteWriter = Class({
  implements: [streamMixin(stream => streamNS(stream).manager)],
  initialize: function (outputStream) {
    let stream = Cc["@mozilla.org/binaryoutputstream;1"].
               createInstance(Ci.nsIBinaryOutputStream);
    stream.setOutputStream(outputStream);

    streamNS(this).manager = new StreamManager(this, stream);
    streamNS(this).stream = stream;
  },
  write: function ByteWriter_write(str) {
    let { stream, manager } = streamNS(this);
    manager.ensureOpened();
      try {
        stream.writeBytes(str, str.length);
      }
      catch (err) {
        throw new Error("Error writing to stream: " + err);
      }
  }
});

exports.ByteReader = ByteReader;
exports.ByteWriter = ByteWriter;
