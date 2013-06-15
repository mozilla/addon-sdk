/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
"use strict";

let net = require("sdk/io/net");

function pingPongTest(port, host) {
  return function(assert, end) {
    let n = 1000;
    let count = 0;
    let sentPongs = 0;
    let last = false;

    let server = net.createServer({ allowHalfOpen: true }, function(socket) {

      assert.equal(server, socket.server, "socket.server is server");
      assert.equal(server.connections, 1, "has one connection");
      assert.equal(true, socket.remoteAddress !== null);
      assert.equal(true, socket.remoteAddress !== undefined);

      if (host === "127.0.0.1" || host === "localhost" || !host) {
        assert.equal(socket.remoteAddress, "127.0.0.1", "remote address");
      } else {
        assert.equal(socket.remoteAddress, "::1");
      }

      socket.setEncoding("utf8");
      socket.setNoDelay();
      socket.timeout = 0;

      socket.on("data", function(data) {
        assert.equal("open", socket.readyState, "is open state");
        assert.equal(true, socket.writable, "socket is writable");
        assert.equal(true, socket.readable, "socket is readable");
        assert.equal(true, count <= n);
        if (/PING/.exec(data)) {
          socket.write("PONG")
          sentPongs++;
        }
      });

      socket.on("end", function() {
        assert.equal("writeOnly", socket.readyState, "once ended socket is write only");
        assert.equal(true, socket.writable);
        assert.equal(false, socket.readable);
        socket.end();
      });

      socket.on("close", function(error) {
        assert.ok(!error, "closed without error");
        assert.equal("closed", socket.readyState, "state is closed");
        socket.server.close();
      });

      socket.on("error", function(error) {
        assert.fail(error);
      });
    });

    server.listen(port, host, function() {
      let client = net.createConnection(port, host);

      client.setEncoding("utf8");
      client.on("connect", function() {
        assert.equal("open", client.readyState, "client is open");
        assert.equal(true, client.readable, "client readable");
        assert.equal(true, client.writable, "client writable");
        client.write("PING");
      });

      client.on("data", function(data) {
        assert.equal("PONG", data, "got pong");
        count += 1;

        if (last) {
          assert.equal("readOnly", client.readyState);
          assert.equal(false, client.writable, "no longer writable");
          assert.equal(true, client.readable, "still readable though");
          return;
        } else {
          assert.equal("open", client.readyState);
          assert.equal(true, client.writable, "writable");
          assert.equal(true, client.readable, "readable");
        }

        if (count < n) client.write("PING");
        else {
          last = true;
          client.write("PING");
          client.end();
        }
      });

      client.on("close", function() {
        assert.equal(n, count);
        assert.equal(n, sentPongs);
        assert.equal(true, last);
        end();
      });

      client.on("error", function(error) {
        assert.fail(error)
      });
    });
  }
}

exports["test ping pong"] = pingPongTest(8099, "localhost");

require("test").run(exports);