/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "experimental"
};

const { Cu } = require("chrome");
const { Class } = require("../sdk/core/heritage");
const { MessagePort, MessageChannel } = require("../sdk/messaging");
const { DebuggerServer } = Cu.import("resource://gre/modules/devtools/dbg-server.jsm", {});

const outputs = new WeakMap();
const inputs = new WeakMap();
const targets = new WeakMap();
const transports = new WeakMap();

const input = port => inputs.get(port);
const output = port => outputs.get(port);
const transport = port => transports.get(port);


const fromTarget = target => {
  const debuggee = new Debuggee();
  const { port1, port2 } = new MessageChannel();
  inputs.set(debuggee, port1);
  outputs.set(debuggee, port2);
  targets.set(debuggee, target);

  return debuggee;
};
exports.fromTarget = fromTarget;

const Debuggee = Class({
  extends: MessagePort.prototype,
  close: function() {
    const server = transport(this);
    if (server) {
      transports.delete(this);
      server.close();
    }
    output(this).close();
  },
  start: function() {
    const target = targets.get(this);
    if (target.isLocalTab) {
      // Since a remote protocol connection will be made, let's start the
      // DebuggerServer here, once and for all tools.
      if (!DebuggerServer.initialized) {
        DebuggerServer.init();
        DebuggerServer.addBrowserActors();
      }

      transports.set(this, DebuggerServer.connectPipe());
    }
    // TODO: Deal with remote connections somehow although
    // for now we do not support remote tabs.
    else {
      throw Error("Remote targets are not yet supported");
    }

    // pipe messages send to the debuggee to an actual
    // server via remote debugging protocol transport.
    input(this).addEventListener("message", event =>
      transport(this).send(event.data));

    // pipe messages received from the remote debugging
    // server transport onto the this debuggee.
    transport(this).hooks = {
      onPacket: packet => input(this).postMessage(packet),
      onClosed: () => input(this).close()
    };

    input(this).start();
    output(this).start();
  },
  postMessage: function(data) {
    return output(this).postMessage(data);
  },
  get onmessage() {
    return output(this).onmessage;
  },
  set onmessage(onmessage) {
    output(this).onmessage = onmessage;
  },
  addEventListener: function(...args) {
    return output(this).addEventListener(...args);
  },
  removeEventListener: function(...args) {
    return output(this).removeEventListener(...args);
  }
});
exports.Debuggee = Debuggee;
