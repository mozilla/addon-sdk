/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
"use strict";

module.metadata = {
  "stability": "experimental"
};


// This manages the lifetime of stream, a ByteReader, ByteWriter, TextReader,
// or TextWriter.  It registers an unload listener that closes
// rawStream if it's still opened.  It also provides ensureOpened(), which
// throws an exception if the stream is closed.
function StreamManager (stream, rawStream) {
  const self = this;
  this.rawStream = rawStream;
  this.opened = true;
  require("../system/unload").ensure(this);
}

StreamManager.prototype = {
  ensureOpened: function StreamManager_ensureOpened() {
    if (!this.opened)
      throw new Error("The stream is closed and cannot be used.");
  },
  unload: function StreamManager_unload() {
    // TextWriter.writeAsync() causes rawStream to close and therefore sets
    // opened to false, so check that we're still opened.
    if (this.opened) {
      // Calling close() on both an nsIUnicharInputStream and
      // nsIBufferedOutputStream closes their backing streams. It also
      // forces nsIOutputStreams to flush first.
      this.rawStream.close();
      this.opened = false;
    }
  }
};
exports.StreamManager = StreamManager;

function streamMixin (managerGetter) {
  return {
    /**
     * True iff the stream is closed
     */
    get closed() !managerGetter(this).opened,
    /**
     * Closes both the stream and its backing stream. If the stream is 
     * already closed, an exception is thrown. For TextWriters, this flushes
     * the backing stream's buffer.
     */
    close: function stream_close () {
      let manager = managerGetter(this);
      manager.ensureOpened();
      manager.unload();
    }
  };
}

exports.streamMixin = streamMixin;
