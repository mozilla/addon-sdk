/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

let { Cc, Ci } = require("chrome");
let { WebSocket } = require("sdk/web-socket");
let { createServer } = require("sdk/io/net");

exports.testWebSocket = function(assert, done) {
  let server = createServer({ allowHalfOpen: true }, function(socket) {
    assert.equal(server.connections, 1, "got one connection");
    socket.on("data", function(data) {
      assert.ok(data.toString().indexOf("Upgrade: websocket") >= 0,
                "got websocket client handshake");
      socket.end();
      server.close();
    });
  });

  server.listen(8099, "localhost", function() {
    let socket = new WebSocket("ws://localhost:8099/");

    socket.onopen = function(event) {
      assert.equal(event.type, "open", "open event recieved");
      socket.send("hello socket");
    }
    socket.onmessage = function(event) {
      assert.equal(event.type, "message", "recieved message");
      assert.equal(event.data, "hello socket", "message recieved back");
      socket.close();
    }
    socket.onclose = function(event) {
      assert.equal(event.type, "close", "socket was closed");
      done();
    }
    socket.onerror = function(event) {
      assert.pass("connection will fail because of no handshake");
    }
  });
}

require("sdk/test/runner").runTestsFromModule(module);
