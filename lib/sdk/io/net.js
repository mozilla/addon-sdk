/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
"use strict";

module.metadata = {
  "stability": "experimental"
};


const { Cc, Ci, CC, Cr } = require("chrome");

const { DuplexStream, InputStream, OutputStream } = require("./stream");
const { emit, off } = require("../event/core");
const { EventTarget } = require("../event/target");
const { Buffer } = require("./buffer");
const { Class } = require("../core/heritage");
const { setTimeout, clearTimeout } = require("sdk/timers");

const threadManager = Cc["@mozilla.org/thread-manager;1"].
                      getService(Ci.nsIThreadManager);
const { createTransport: SocketTransport } = Cc["@mozilla.org/network/socket-transport-service;1"].
                                             getService(Ci.nsISocketTransportService);
const ServerSocket = CC("@mozilla.org/network/server-socket;1",
                        "nsIServerSocket");

const dnsService = Cc["@mozilla.org/network/dns-service;1"].
                   createInstance(Ci.nsIDNSService);

const {
  STATUS_RESOLVING, STATUS_CONNECTING_TO,
  STATUS_CONNECTED_TO, STATUS_SENDING_TO,
  STATUS_WAITING_FOR, STATUS_RECEIVING_FROM,

  TIMEOUT_CONNECT, TIMEOUT_READ_WRITE
} = Ci.nsISocketTransport;

var STATUS = {};
STATUS[STATUS_RESOLVING] = "resolving";
STATUS[STATUS_CONNECTING_TO] = "connecting";
STATUS[STATUS_CONNECTED_TO] = "connected";
STATUS[STATUS_SENDING_TO] = "sending";
STATUS[STATUS_RECEIVING_FROM] = "receiving";
STATUS[TIMEOUT_CONNECT] = "timeout connect";
STATUS[TIMEOUT_READ_WRITE] = "timeout read-write";

const { OPEN_UNBUFFERED } = Ci.nsITransport;

const BACKLOG = -1;
const CONNECTING = "opening";
const OPEN  = "open";
const CLOSED = "closed";
const READ = "readOnly";
const WRITE = "writeOnly";

let accessor = () => {
  let map = new WeakMap();
  return (target, value) => {
    if (value)
      map.set(target, value);
    return map.get(target);
  }
}

let transports = accessor();
let observers = accessor();


let triggerTimer = socket => emit(socket, "timeout")
let resetTimer = socket => {
  if (socket.timerID)
    clearTimeout(socket.timerID);

  socket.timerID = socket.timeout > 0 &&
                   setTimeout(triggerTimer, socket.timeout, socket);
}

const SocketObserver = Class({
  initialize: function(socket) {
    this.socket = socket;
  },
  // Method is a part of `nsITransportEventSink` interface registered
  // via `nsITransport.setEventSink`. It's invoked whenever transport
  // status is chages. We only use it find when underlying socket is
  // connected.
  onTransportStatus: function(transport, status, progress, max) {
    resetTimer(this.socket)

    if (status === STATUS_CONNECTED_TO) {
      let socket = this.socket;
      socket.connecting = false;
      emit(socket, "connect", socket);
      socket.read();
    }
  },
  // Method implemnets `nsIInputStreamCallback` intreface and that is
  // invoked by `nsIAsyncInputStream.asyncWait`. Observer is registered
  // with `WAIT_CLOSURE_ONLY` flag that overrides the default behavior,
  // causing notification to be suppressed until the stream becomes closed.
  // This handler is only to detect connection refusals.
  onInputStreamReady: function(asyncInputStream) {
    try {
      asyncInputStream.available();
    } catch (error) {
      // NS_ERROR_CONNECTION_REFUSED
      this.socket.destroy();
      emit(this.socket, "error", new Error("Connection was refused"));
    }
  }
});

const Socket = Class({
  extends: DuplexStream,
  initialize: function(options) {
    let { server, transport, allowHalfOpen } = options || {};
    if (allowHalfOpen === false)
      this.allowHalfOpen = false;

    this.server = server || null;

    // This is client connected to your server.
    if (transport) {
      this.connecting = true;

      transports(this, transport);

      let observer = SocketObserver(this);

      transport.setEventSink(observer, threadManager.currentThread);

      let asyncInputStream = transport.openInputStream(0, 0, 0);

      // Use it just to find out if weather connection was rejected.
      asyncInputStream.asyncWait(observer,
                                 asyncInputStream.WAIT_CLOSURE_ONLY,
                                 0,
                                 threadManager.currentThread);

      DuplexStream.prototype.initialize.call(this, {
        asyncInputStream: asyncInputStream,
        asyncOutputStream: transport.openOutputStream(OPEN_UNBUFFERED, 0, 0),
        allowHalfOpen: allowHalfOpen
      });

      let onClose = () => {
        if (!this.readable && !this.writable) {
          transport.close(Cr.NS_OK);
          emit(this, "close");
        }
      }

      this.once("finish", onClose);
      this.once("end", onClose);
    }
  },
  fd: null,
  type: null,
  resolving: false,
  connecting: false,
  timeout: 0,
  get readyState() {
    let { connecting, readable, writable } = this;
    if (connecting)
      return CONNECTING;
    else if (readable && writable)
      return OPEN;
    else if (readable && !writable)
      return READ;
    else if (!readable && writable)
      return WRITE;
    else
      return CLOSED;
  },
  get remoteAddress() transports(this) && transports(this).host,
  get remotePort() transports(this) && transports(this).port,
  address: function() console.warn("server.address() not supported"),
  setNoDelay: function() console.warn("server.setNoDelay() not supported"),
  setKeepAlive: function() console.warn("server.setKeepAlive() not supported"),
  setSecure: function() console.warn("server.setSecure() not supported"),
  setTimeout: function(time, callback) {
    if (callback)
      this.once("timeout", callback);
    this.timeout = time;
    resetTimer(this);
  },
  open: function open(fd, type) {
    throw Error("Only listening on ports is supported");
  },
  connect: function connect(port, host) {
    this.initialize({
      transport: SocketTransport(null, 0, host, port, null)
    });
  },
  setEncoding: function(encoding) this.encoding = encoding,
});
exports.Socket = Socket;



let nsIServerSocket = accessor();

const ServerListener = Class({
  initialize: function(server) {
    this.server = server;
  },
  onSocketAccepted: function(_, socketTransport) {
    let server = this.server;

    // Refuse connection if already reached maxConnections limit on the server.
    if (server.maxConnections !== -1 &&
        server.connections >= server.maxConnections)
      return socketTransport.close(Cr.NS_ERROR_CONNECTION_REFUSED);

    // Add a client socket to a set of live server connnections.
    transports(server).add(socketTransport);
    let socket = new Socket({ transport: socketTransport,
                              server: server,
                              allowHalfOpen: server.allowHalfOpen });
    socket.connecting = false;
    emit(server, "connection", socket);
    socket.read();
  },
  onStopListening: function(_, reason) {
    let server = this.server;
    // `reason` is NS_BINDING_ABORTED if socket was manually closed by user.
    if (reason !== Cr.NS_BINDING_ABORTED)
      emit(server, "error", reason);

    observers(this);
    nsIServerSocket(this);
    transports(this);
    // The server socket is effectively dead after this notification.
    emit(server, "close");
  }
});

function onDisconnect() {
  let server = this.server;
  let transport = transports(this);
  transports(server).delete(transport);

  if (server.connections === 0 && server.maxConnections === 0)
    server.destroy();
}
function onConnect(socket) {
  socket.once("close", onDisconnect)
}

const Server = Class({
  extends: EventTarget,
  allowHalfOpen: true,
  initialize: function(options, listener) {
    if (typeof(options) == "function")
      ([listener, options]) = [options, {}];

    let { loopbackOnly, allowHalfOpen } = options;
    if (allowHalfOpen === false)
      allowHalfOpen = false;
    this.loopbackOnly = !!loopbackOnly;

    this.on("connection", onConnect);

    if (listener)
      this.on("connection", listener);

    let serverSocket = new ServerSocket();
    nsIServerSocket(this, serverSocket);
  },
  /**
   * The number of concurrent connections on the server.
   */
  get connections() transports(this) ? transports(this).size : 0,
  // Not really useful in this implementation but still have
  // it for nodejs compatibiltiy.
  getConnections: function(callback) callback(null, this.connections),
  /**
   * Set this property to reject connections when the server's connection
   * count gets high.
   */
  maxConnections: -1,
  unref: function() console.warn("server.unref() is not supported"),
  ref: function() console.warn("server.ref() is not supported"),
  address: function() {
    return {
      host: dnsService.myHostName,
      port: nsIServerSocket(this).port,
    }
  },
  listenFD: function listenFD(fd, type) {
    throw Error("Listening on file descriptors is not supported");
  },
  listen: function listen(port, host, backlog, callback) {
    if (transports(this))
      throw Error("Server is already listening");
    if (typeof(port) !== "number")
      throw Error("Only listening on ports is supported");

    if (typeof(host) === "number")
      ([host, backlog]) = ["localhost", host];

    if (typeof(backlog) !== "number")
      ([backlog, callback]) = [-1, backlog];

    if (typeof(callback) === "function")
      this.once("listening", callback);

    let serverSocket = nsIServerSocket(this);
    let clients = transports(this, new Set());

    serverSocket.init(port, this.loopbackOnly, this.maxConnections);
    serverSocket.asyncListen(new ServerListener(this));

    emit(this, "listening");
  },
  // Stops the server from accepting new connections and keeps existing
  // connections.
  close: function(callback) {
    if (callback)
      this.on("close", callback);

    this.maxConnections = 0;

    if (this.connections === 0)
      this.destroy();
  },
  // Can be used to close server and drop all connections.
  destroy: function() {
    nsIServerSocket(this).close();
  }
});
exports.Server = Server;

let createServer = (options, listener) => new Server(options, listener)
exports.createServer = createServer;

let connect = (port, host, listener) => {
  // Connect supports (port, [host], [connectListener]) and
  // ({port, host}, [connectionListener]) signatures.
  let options = {};
  if (typeof(port) == "object") {
    options = port;
    ([{port, host}, listener]) = [options, host];
  }

  let socket = new Socket(options);
  socket.connect(port, host || "localhost");
  if (listener)
    socket.on("connect", listener);

  return socket;
};
exports.createConnection = connect;
exports.connect = connect;
