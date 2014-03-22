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
const { defer } = require("sdk/core/promise");
const { encode } = require("sdk/base64");


const { gDevTools } = Cu.import("resource:///modules/devtools/gDevTools.jsm", {});
const { DebuggerServer } = Cu.import("resource://gre/modules/devtools/dbg-server.jsm", {});
const { DebuggerClient } = Cu.import("resource://gre/modules/devtools/dbg-client.jsm", {});

const OUTER_FRAME_URI = module.uri.replace(/\.js$/, ".html");
const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const HTML_NS = "http://www.w3.org/1999/xhtml";

const { when: onSystemUnload } = require("sdk/system/unload");


// Hack: This is temporary hack to enable message channels on nightly.
require("sdk/preferences/service").set("dom.messageChannel.enabled", true);


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

const Source = function(id) {
  this.id = id;
  this.location = { origin: "*" };
};
Source.postMessage = ({id}, data, origin, ports) => {
  const window = getByOuterId(id)
  const event = new window.MessageEvent("message", {
    bubbles: true,
    cancelable: false,
    data: JSON.parse(JSON.stringify(data)),
    origin: origin,
    source: window.top,
    target: window,
    ports: Array.slice(ports)
  });

  window.dispatchEvent(event);
};
Source.prototype.postMessage = function(data, origin, ports) {
  Source.postMessage(this, data, origin, ports);
};

function makePort({target}, {MessageChannel}) {
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

      let innerFrame = document.createElementNS(HTML_NS, "iframe");
      setAttributes(innerFrame, {
        "id": pane.id,
        "src": pane.url,
        "seamless": "seamless",
        "sandbox": "allow-scripts",
        "data-is-sdk-inner-frame": true,
        "style": [ "border:none",
                   "position:absolute",
                   "width:100%",
                   "height: 100%",
                   "top: 0",
                   "left: 0",
                   "overflow: hidden"].join(";")
      });

      setAttributes(outerFrame, {
        "src": OUTER_FRAME_URI + "#" +
               encode(innerFrame.outerHTML),
        "data-is-sdk-outer-frame": true,
        "type": "content",
        "transparent": true,
        "seamless": "seamless"
      });

      view.appendChild(outerFrame);
      outerFrame.style.visibility = "hidden";

      const onLoad = event => {
        const outerDocument = outerFrame.contentDocument;
        const innerFrame = outerDocument.querySelector("iframe");
        const innerDocument = innerFrame && innerFrame.contentDocument;
        if (event.target === innerDocument) {

          outerFrame.removeEventListener("DOMContentLoaded", onLoad);
          outerFrame.style.visibility = "visible";



          emit(pane, "attach", {
            type: "DOMContentLoaded",
            source: new Source(getOuterId(event.target.defaultView)),
            target: pane,
            origin: "*",
            ports: [makePort(toolbox, event.target.defaultView)]
          });
          outerFrame.contentWindow.addEventListener("message", onMessage);
          resolve({ destroy: onDestroy });
        }
      };

      const onMessage = event => {
        emit(pane, "message", {
          type: "message",
          data: event.data,
          // TODO: Use real origin
          origin: "*",
          timeStamp: event.timeStamp,
          ports: event.ports,
          source: new Source(getOuterId(event.source))
        });
      };

      const onDestroy = () => {
        outerFrame.contentWindow.removeEventListener("message", onMessage);
        outerFrame.removeEventListener("DOMContentLoaded", onLoad);
      }

      outerFrame.addEventListener("DOMContentLoaded", onLoad);

      return promise;
    }
  });
}
