/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
"use strict";

module.metadata = {
  "stability": "experimental"
};


const { Cc, Ci, CC } = require("chrome");

const { DuplexStream, InputStream, OutputStream } = require("./stream");
const { emit, off } = require("../event/core");
const { EventTarget } = require("../event/target");
const { Buffer } = require("./buffer");
const { Class } = require("../core/heritage");

const threadManager = Cc["@mozilla.org/thread-manager;1"].
                      getService(Ci.nsIThreadManager);
const { createTransport } = Cc["@mozilla.org/network/socket-transport-service;1"].
                            getService(Ci.nsISocketTransportService);
const makeServerSocket = CC("@mozilla.org/network/server-socket;1",
                            "nsIServerSocket");
const StreamPump = CC("@mozilla.org/network/input-stream-pump;1",
                      "nsIInputStreamPump", "init");
const StreamCopier = CC("@mozilla.org/network/async-stream-copier;1",
                        "nsIAsyncStreamCopier", "init");
const BinaryInputStream = CC("@mozilla.org/binaryinputstream;1",
                             "nsIBinaryInputStream", "setInputStream");
const BinaryOutputStream = CC("@mozilla.org/binaryoutputstream;1",
                              "nsIBinaryOutputStream", "setOutputStream");

const {
  STATUS_RESOLVING, STATUS_CONNECTING_TO,
  STATUS_CONNECTED_TO, STATUS_SENDING_TO,
  STATUS_WAITING_FOR, STATUS_RECEIVING_FROM,

  TIMEOUT_CONNECT, TIMEOUT_READ_WRITE
} = Ci.nsISocketTransport;

const BACKLOG = -1;
const CONNECTING = "opening";
const OPEN  = "open";
const CLOSED = "closed";
const READ = "readOnly";
const WRITE = "writeOnly";
const ENCODING_UTF8 = "utf-8";
const ENCODING_BINARY = "binary";

const STATE_EVENTS = {
  open: "connect",
  writeOnly: "end",
  closed: "close"
};

let isPort = (x) => parseInt(x) >= 0

let accessor = () => {
  let map = new WeakMap();
  return (fd, value) => {
    if (value === null) map.delete(fd);
    if (value !== undefined) map.set(fd, value);
    return map.get(fd);
  }
}

let onStatus = (socket) => {
  let state = socket.readyState;
  //if (previous !== state) {
    switch (state) {
      case CONNECTING:
        break;
      case OPEN:
        emit(socket, "connect");
        break;
      case WRITE:
        emit(socket, "end");
        break;
      case READ:
        break;
      case CLOSED:
        emit(socket, "close");
        break;
    }
  //}
}

let nsITransport = accessor();
let isConnecting = accessor();

const Socket = Class({
  extends: DuplexStream,
  initialize: function(options) {
    options = options || {};

    if ("server" in options)
      this.server = options.server;

    // This is client connected to your server.
    if ("transport" in options) {
      let transport = nsITransport(this, options.transport);

      let asyncInputStream = transport.openInputStream(null, 0, 0);
      let asyncOutputStream = transport.openOutputStream(null, 0, 0);

      let binaryInputStream = BinaryInputStream(asyncInputStream);
      let binaryOutputStream = BinaryOutputStream(asyncOutputStream);

      let pump = StreamPump(asyncInputStream, -1, -1, 0, 0, false);


      transport.setEventSink({
        onTransportStatus: (transport, status, progress, total) => {
          let state = this.readyState;
          switch (status) {
            case STATUS_RESOLVING:
              isConnecting(this, true);
              break;
            case STATUS_CONNECTING_TO:
              isConnecting(this, true);
              break;
            case STATUS_CONNECTED_TO:
              isConnecting(this, false);
              this.readable = true;
              this.writable = true;
              break;
            case STATUS_SENDING_TO:
              return;
            case STATUS_WAITING_FOR:
              return;
            case STATUS_RECEIVING_FROM:
              return;
          }

          emit(this, "readyState", state);
          onStatus(this);
        }
      }, threadManager.currentThread);

      OutputStream.prototype.initialize.call(this, {
        asyncOutputStream: asyncOutputStream,
        output: binaryOutputStream
      });


      InputStream.prototype.initialize.call(this, {
        input: binaryInputStream,
        pump: pump
      });

      this.read();
    }
  },
  bufferSize: 0,
  fd: null,
  type: null,
  resolving: false,
  get readyState() {
    if (isConnecting(this)) return CONNECTING;
    else if (this.readable && this.writable) return OPEN;
    else if (this.readable && !this.writable) return READ;
    else if (!this.readable && this.writable) return WRITE;
    else return CLOSED;
  },
  get remoteAddress() isConnecting(this) ? null : nsITransport(this).host,
  get remotePort() isConnecting(this) ? null : nsITransport(this).port,
  address: function address() {
  },
  setNoDelay: function setNoDelay() {
  },
  setKeepAlive: function setKeepAlive() {
  },
  setSecure: function setSecure() {
  },
  setTimeout: function setTimeout(time, callback) {
    if (callback) this.once("timeout", callback);

    nsITransport(this).setTimeout(time, TIMEOUT_READ_WRITE);
  },
  open: function open(fd, type) {
    throw Error("Not implemented");
  },
  connect: function connect(port, host) {
    try {
      this.initialize({
        transport: createTransport(null, 0, host, port, null)
      });
    } catch(error) {
      emit(this, "error", error);
    }
  },
  setEncoding: function setEncoding(encoding) {
  },
  end: function end(data, encoding) {
     try {
      this.readable = false;
      this.writable = false;

      nsITransport(this).close(0);
      onStatus(this);
    } catch(error) {
      emit(this, "error", error);
    }
  }
});
exports.Socket = Socket;

let nsIServerSocket = accessor();

const Server = Class({
  extends: EventTarget,
  initialize: function(options, listener) {
    options = options || {};
    if ("loopbackOnly" in options)
      this.loopbackOnly = !!options.loopbackOnly;
    if ("maxConnections" in options)
      this.maxConnections = options.maxConnections;
    if ("connections" in options)
      this.connections = options.connections;

    nsIServerSocket(this, makeServerSocket());

    if (listener) this.on("connection", listener);

  },
  type: null,
  get port() (nsIServerSocket(this) || 0).port,
  host: null,
  /**
   * The number of concurrent connections on the server.
   */
  connections: 0,
  /**
   * Set this property to reject connections when the server's connection
   * count gets high.
   */
  maxConnections: -1,
  /**
   * Returns the bound address of the server as seen by the operating system.
   * Useful to find which port was assigned when giving getting an OS-assigned
   * address.
   */
  address: function() this.host + ':' + this.port,
  listenFD: function listenFD(fd, type) {
    throw Error('Not implemented');
  },
  listen: function listen(port, host, callback) {
    let server = this;
    let connections = 0;

    if (this.fd) throw Error("Server already opened");

    if (!callback) {
      callback = host
      host = "localhost"
    }

    if (callback) this.on("listening", callback)

    if (isPort(port)) {
      this.type = "tcp"
      this.host = host;

      let rawServer = nsIServerSocket(this);
      rawServer.init(port, this.loopbackOnly, this.maxConnections);
      rawServer.asyncListen({
        onSocketAccepted: function onConnect(rawServer, transport) {
          try {
            let socket = new Socket({
              transport: transport,
              server: server
            });
            server.connections = server.connections + 1;
            emit(server, "connection", socket);
          } catch (error) {
            emit(server, "error", error);
          }
        },
        onStopListening: function onDisconnect(rawServer, status) {
          try {
            emit(server, "close");
          } catch (error) {
            emit(server, "error", error);
          }
        }
      });

      emit(this, "listening");
    }
  },
  pause: function pause(time) {
    throw Error("Not implemented");
  },
  /**
   * Stops the server from accepting new connections. This function is
   * asynchronous, the server is finally closed when the server emits a
   * `'close'` event.
   */
  close: function close() {
    off(this);
    nsIServerSocket(this).close();
  },
  destroy: function destroy(error) {
    this.close();
    if (error) emit(this, "error", error);
    nsIServerSocket(this, null);
  }
});
exports.Server = Server;

let createServer = (options, listener) => Server(options, listener)
exports.createServer = createServer;

let createConnection = (port, host) => {
  let socket = Socket();
  socket.connect(port, host);

  return socket;
};
exports.createConnection = createConnection;