/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "experimental"
};


const { Cu } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { EventTarget } = require("sdk/event/target");
const { Disposable } = require("sdk/core/disposable");
const { emit, off, setListeners } = require("sdk/event/core");
const { getFrameElement, getOuterId, getByOuterId } = require("sdk/window/utils");
const { contract } = require("sdk/util/contract");
const { id: addonID, data: { url: resolve }} = require("sdk/self");
const { identify } = require("sdk/ui/id");
const { isLocalURL, URL } = require("sdk/url");
const { add, remove, has, iterator } = require("sdk/lang/weak-set");
const { defer } = require("sdk/core/promise");
const { encode } = require("sdk/base64");
const { MessageChannel } = require("sdk/messaging");

const { gDevTools } = Cu.import("resource:///modules/devtools/gDevTools.jsm", {});
const { DebuggerServer } = Cu.import("resource://gre/modules/devtools/dbg-server.jsm", {});
const { DebuggerClient } = Cu.import("resource://gre/modules/devtools/dbg-client.jsm", {});

const OUTER_FRAME_URI = module.uri.replace(/\.js$/, ".html");
const FRAME_SCRIPT = module.uri.replace("/pane.js", "/frame-script.js");
const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const HTML_NS = "http://www.w3.org/1999/xhtml";

const { when: onSystemUnload } = require("sdk/system/unload");

const makeID = name =>
  ("pane-" + addonID + "-" + name).
    split("/").join("-").
    split(".").join("-").
    replace(/[^A-Za-z0-9_\-]/g, "");

const validate = contract({
  name: {
    is: ["string", "undefined"],
    ok: x => /^[a-z][a-z0-9-_]+$/i.test(x),
    msg: "The `option.name` must be a valid alphanumeric string (hyphens and " +
         "underscores are allowed) starting with letter."
  },
  label: {
    is: ["string"],
    msg: "The `option.label` must be a provided"
  },
  tooltip: {
    is: ["string", "undefined"],
    msg: "The `option.tooltip` must be a string"
  },
  icon: {
    is: ["string", "undefined"],
    ok: x => isLocalURL(x),
    msg: "The `options.icon` must be a valid local URI."
  },
  url: {
    map: x => x.toString(),
    is: ["string"],
    ok: x => isLocalURL(x),
    msg: "The `options.url` must be a valid local URI."
  }
});

const panes = new Map();
const sources = new Map();
const managers = new WeakMap();
const ports = new Map();

const portByID = id => {
  for (let port of iterator(ports)) {
    if (id === ports.get(port))
      return port;
  }
};

const onPortMessage = ({data}) => {
  const port = portByID(data.id);
  console.log("port message", port, data.message);
  if (port)
    port.postMessage(data.message);
};

let portID = 0;
const makePortHandle = (messageManager, port) => {
  const id = ++portID;
  // Bind id to the given port
  ports.set(port, id);
  // Obtain a weak reference to a port.
  add(ports, port);

  port.onmessage = event => {
    messageManager.sendAsyncMessage("sdk/port/message", {
      id: id,
      message: event.data
    });
  };

  return id;
};


const Source = function(messageManager) {
  managers.set(this, messageManager);
};
Source.postMessage = (source, data, origin, ports) => {
  const messageManager = managers.get(source);
  messageManager.sendAsyncMessage("sdk/event/*", {
    type: "message",
    bubbles: false,
    cancelable: false,
    data: data,
    origin: origin,
    ports: ports.map(port => makePortHandle(messageManager, port))
  });
};
Source.prototype.postMessage = function(data, origin, ports) {
  Source.postMessage(this, data, origin, ports);
};

function makePort({target}) {
  let { port1: client, port2: host } = new MessageChannel();
  let server = null;
  if (target.isLocalTab) {
    // Since a remote protocol connection will be made, let's start the
    // DebuggerServer here, once and for all tools.
    if (!DebuggerServer.initialized) {
      DebuggerServer.init();
      DebuggerServer.addBrowserActors();
    }

    server = DebuggerServer.connectPipe();
  }
  // TODO: Deal with remote connections somehow.
  else {

  }

  // pipe messages received from the client to the
  // serever transport.
  host.onmessage = event => server.send(event.data);
  // pipe messages received from the server to the
  // client port.
  server.hooks = {
    onPacket: packet => host.postMessage(packet),
    onClosed: () => server.close()
  };

  return client;
}




const Pane = Class({
  extends: EventTarget,
  implements: [Disposable, Source],
  initialize: function(params={}) {
    const options = validate(params);
    const id = makeID(options.name || options.url);

    if (panes.has(id))
      throw Error("Pane with this name / url already exists: " + id);

    const initial = { id: id, url: resolve(options.url) };
    this.id = id;
    this.url = resolve(options.url);
    this.icon = options.icon ? resolve(options.icon) : null;
    this.label = options.label;
    this.tooltip = options.tooltip || null;

    setListeners(this, params);

    panes.set(this.id, this);

    registerPane(this);

    onSystemUnload( _ => this.destroy());
  },
  destroy: function() {
    // TODO: commented until fully check if needed
    // (and its input/output and rector added)
    //send(output, object([this.id, null]));

    // unregister panel on destroy
    gDevTools.unregisterTool(this.id);
    panes.delete(this.id);
    off(this);
  },
  // `JSON.stringify` serializes objects based of the return
  // value of this method. For convinienc we provide this method
  // to serialize actual state data.
  toJSON: function() {
    return {
      id: this.id,
      url: this.url,
      label: this.label,
      tooltip: this.tooltip,
      icon: this.icon
    };
  }
});
identify.define(Pane, pane => pane.id);

exports.Pane = Pane;

function setAttributes(el, attrs) {
  for (var key in attrs) {
    el.setAttribute(key, attrs[key]);
  }
}

function registerPane(pane) {
  gDevTools.registerTool({
    id: pane.id,
    url: "about:blank",
    label: pane.label,
    tooltip: pane.tooltip,
    icon: pane.icon ? resolve(pane.icon) : null,
    isTargetSupported: (target) => target.isLocalTab,
    build: function(window, toolbox) {
      let { promise, resolve } = defer();
      let outerFrame = getFrameElement(window);
      let document = outerFrame.ownerDocument;
      let view = outerFrame.parentNode;

      outerFrame.remove();

      setAttributes(outerFrame, {
        "sandbox": "allow-scripts",
        "src": pane.url,
        "remote": true,
        "data-is-sdk-outer-frame": true,
        "type": "content",
        "transparent": true,
        "seamless": "seamless"
      });

      view.appendChild(outerFrame);
      outerFrame.style.visibility = "hidden";
      const { messageManager } = outerFrame.frameLoader;
      const source = new Source(messageManager);

      const onLoad = event => {
        outerFrame.removeEventListener("DOMContentLoaded", onLoad);
        outerFrame.style.visibility = "visible";



        emit(pane, "attach", {
          type: "DOMContentLoaded",
          source: source,
          target: pane,
          origin: "*",
          ports: [makePort(toolbox)]
        });
        resolve({ destroy: onDestroy });
      };

      const onMessage = event => {
        emit(pane, "message", {
          type: "message",
          data: event.data,
          // TODO: Use real origin
          origin: "*",
          timeStamp: event.timeStamp,
          ports: event.ports,
          source: source
        });
      };

      const onDestroy = () => {
        messageManager.removeDelayedFrameScript(FRAME_SCRIPT);
        messageManager.removeMessageListener("sdk/event/message", onMessage);
        messageManager.removeMessageListener("sdk/event/DOMContentLoaded", onLoad);
      };


      messageManager.addMessageListener("sdk/event/DOMContentLoaded", onLoad);
      messageManager.addMessageListener("sdk/port/message", onPortMessage);
      messageManager.loadFrameScript(FRAME_SCRIPT, false);

      return promise;
    }
  });
}
