/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * vim:set ts=2 sw=2 sts=2 et filetype=javascript
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "experimental"
};

const {Cc,Ci,Cu,components} = require("chrome");
const { Class } = require("../core/heritage");
const { ns } = require("../core/namespace");
const { streamMixin, StreamManager } = require("./utils");
var NetUtil = {};
Cu.import("resource://gre/modules/NetUtil.jsm", NetUtil);
NetUtil = NetUtil.NetUtil;

// NetUtil.asyncCopy() uses this buffer length, and since we call it, for best
// performance we use it, too.
const BUFFER_BYTE_LEN = 0x8000;
const PR_UINT32_MAX = 0xffffffff;
const DEFAULT_CHARSET = "UTF-8";
const streamNS = ns();

/**
 * An input stream that reads text from a backing stream using a given text
 * encoding.
 *
 * @param inputStream
 *        The stream is backed by this nsIInputStream.  It must already be
 *        opened.
 * @param charset
 *        Text in inputStream is expected to be in this character encoding.  If
 *        not given, "UTF-8" is assumed.  See nsICharsetConverterManager.idl for
 *        documentation on how to determine other valid values for this.
 */
const TextReader = Class({
  implements: [streamMixin((stream) => streamNS(stream).manager)],
  initialize: function (inputStream, charset) {
    charset = checkCharset(charset);
    let stream = Cc["@mozilla.org/intl/converter-input-stream;1"].
      createInstance(Ci.nsIConverterInputStream);
    stream.init(inputStream, charset, BUFFER_BYTE_LEN,
      Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);

    streamNS(this).stream = stream;
    streamNS(this).manager = new StreamManager(this, stream);
  },
  /**
   * Reads a string from the stream.  If the stream is closed, an exception is
   * thrown.
   *
   * @param  numChars
   *         The number of characters to read.  If not given, the remainder of
   *         the stream is read.
   * @return The string read.  If the stream is already at EOS, returns the
   *         empty string.
   */
  read: function TextReader_read (numChars) {
    let { manager, stream } = streamNS(this);
    manager.ensureOpened();

    let readAll = false;
    if (typeof(numChars) === "number")
      numChars = Math.max(numChars, 0);
    else
      readAll = true;

    let str = "";
    let totalRead = 0;
    let chunkRead = 1;

    // Read in numChars or until EOS, whichever comes first.  Note that the
    // units here are characters, not bytes.
    while (true) {
      let chunk = {};
      let toRead = readAll ?
                   PR_UINT32_MAX :
                   Math.min(numChars - totalRead, PR_UINT32_MAX);
      if (toRead <= 0 || chunkRead <= 0)
        break;

      // The converter stream reads in at most BUFFER_BYTE_LEN bytes in a call
      // to readString, enough to fill its byte buffer.  chunkRead will be the
      // number of characters encoded by the bytes in that buffer.
      chunkRead = stream.readString(toRead, chunk);
      str += chunk.value;
      totalRead += chunkRead;
    }

    return str;
  }
});

/**
 * A buffered output stream that writes text to a backing stream using a given
 * text encoding.
 *
 * @param outputStream
 *        The stream is backed by this nsIOutputStream.  It must already be
 *        opened.
 * @param charset
 *        Text will be written to outputStream using this character encoding.
 *        If not given, "UTF-8" is assumed.  See nsICharsetConverterManager.idl
 *        for documentation on how to determine other valid values for this.
 */
const TextWriter = Class({
  implements: [streamMixin(stream => streamNS(stream).manager)],
  initialize: function TextWriter(outputStream, charset) {
    charset = checkCharset(charset);

    let stream = outputStream;

    // Buffer outputStream if it's not already.
    let ioUtils = Cc["@mozilla.org/io-util;1"].getService(Ci.nsIIOUtil);
    if (!ioUtils.outputStreamIsBuffered(outputStream)) {
      stream = Cc["@mozilla.org/network/buffered-output-stream;1"].
        createInstance(Ci.nsIBufferedOutputStream);
      stream.init(outputStream, BUFFER_BYTE_LEN);
    }

    // I'd like to use nsIConverterOutputStream.  But NetUtil.asyncCopy(), which
    // we use below in writeAsync(), naturally expects its sink to be an instance
    // of nsIOutputStream, which nsIConverterOutputStream's only implementation is
    // not.  So we use uconv and manually convert all strings before writing to
    // outputStream.
    let uconv = Cc["@mozilla.org/intl/scriptableunicodeconverter"].
      createInstance(Ci.nsIScriptableUnicodeConverter);
    uconv.charset = charset;

    streamNS(this).stream = stream;
    streamNS(this).uconv = uconv;
    streamNS(this).manager = new StreamManager(this, stream);
  },

  /**
   * Flushes the backing stream's buffer.
   */
  flush: function TextWriter_flush() {
    let { manager, stream } = streamNS(this);
    manager.ensureOpened();
    stream.flush();
  },

  /**
   * Writes a string to the stream.  If the stream is closed, an exception is
   * thrown.
   *
   * @param str
   *        The string to write.
   */
  write: function TextWriter_write(str) {
    let { manager, stream, uconv } = streamNS(this);
    manager.ensureOpened();
    let istream = uconv.convertToInputStream(str);
    let len = istream.available();
    while (len > 0) {
      stream.writeFrom(istream, len);
      len = istream.available();
    }
    istream.close();
  },

  /**
   * Writes a string on a background thread.  After the write completes, the
   * backing stream's buffer is flushed, and both the stream and the backing
   * stream are closed, also on the background thread.  If the stream is already
   * closed, an exception is thrown immediately.
   *
   * @param str
   *        The string to write.
   * @param callback
   *        An optional function.  If given, it's called as callback(error) when
   *        the write completes.  error is an Error object or undefined if there
   *        was no error.  Inside callback, |this| is the stream object.
   */
  writeAsync: function TextWriter_writeAsync(str, callback) {
    let self = this;
    let { manager, stream, uconv } = streamNS(this);

    manager.ensureOpened();
    let istream = uconv.convertToInputStream(str);
    NetUtil.asyncCopy(istream, stream, function (result) {
      let err = components.isSuccessCode(result) ? undefined :
        new Error("An error occured while writing to the stream: " + result);
      if (err)
        console.error(err);

      // asyncCopy() closes its output (and input) stream.
      manager.opened = false;

      if (typeof(callback) === "function") {
        try {
          callback.call(self, err);
        }
        catch (exc) {
          console.exception(exc);
        }
      }
    });
  }
});

function checkCharset(charset) {
  return typeof(charset) === "string" ? charset : DEFAULT_CHARSET;
}

exports.TextReader = TextReader;
exports.TextWriter = TextWriter;
