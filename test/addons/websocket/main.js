/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

let { Cc, Ci } = require("chrome");
let { WebSocket } = require("sdk/web-socket");

let iOService = Cc["@mozilla.org/network/io-service;1"].
                getService(Ci.nsIIOService);

exports.testWebSocket = function(assert, done) {
  if (iOService.offline) {
    assert.pass("can't test if we're offline");
    return done();
  }

  let socket = new WebSocket("ws://echo.websocket.org/");

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
    assert.fail(Error("error event occured"))
  }
};

require("sdk/test/runner").runTestsFromModule(module);
