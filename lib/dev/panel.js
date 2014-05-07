/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "experimental"
};


const { Cu } = require("chrome");
const { Class } = require("../sdk/core/heritage");
const { curry } = require("../sdk/lang/functional");
const { EventTarget } = require("../sdk/event/target");
const { Disposable, setup, dispose } = require("../sdk/core/disposable");
const { emit, off, setListeners } = require("../sdk/event/core");
const { getFrameElement } = require("../sdk/window/utils");
const { contract, validate } = require("../sdk/util/contract");
const { data: { url: resolve }} = require("../sdk/self");
const { identify } = require("../sdk/ui/id");
const { isLocalURL, URL } = require("../sdk/url");
const { defer } = require("../sdk/core/promise");
const { encode } = require("../sdk/base64");
const { build } = require("./toolbox");
const { marshal, demarshal } = require("./ports");
const { fromTarget } = require("./debuggee");
const { removed } = require("../sdk/dom/when");
const { id: addonID } = require("../sdk/self");

const OUTER_FRAME_URI = module.uri.replace(/\.js$/, ".html");
const FRAME_SCRIPT = module.uri.replace("/panel.js", "/frame-script.js");
const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const HTML_NS = "http://www.w3.org/1999/xhtml";

const makeID = name =>
  ("pane-" + addonID + "-" + name).
  split("/").join("-").
  split(".").join("-").
  split(" ").join("-").
  replace(/[^A-Za-z0-9_\-]/g, "");


// Weak mapping between `Panel` instances and their frame's
// `nsIMessageManager`.
const managers = new WeakMap();
// Return `nsIMessageManager` for the given `Panel` instance.
const managerFor = x => managers.get(x);

// Weak mappinging between iframe's and their owner
// `Panel` instances.
const panels = new WeakMap();
const panelFor = frame => panels.get(frame);

// Weak mapping between panels and debugees they're targeting.
const debuggees = new WeakMap();
const debuggeeFor = panel => debuggees.get(panel);

const setAttributes = (node, attributes) => {
  for (var key in attributes)
    node.setAttribute(key, attributes[key]);
};


// emit event of given `type` for on the panel
// of the given `event.target`.
const dispatch = curry((type, event) =>
  emit(panelFor(event.target), type, event.data));

// emit `ready` \ `load` event on the panel
// for the given `event.target`. Used as message listeners
// on the iframe message manager.
const onReady = dispatch("ready");
const onLoad = dispatch("load");
const onInited = ({target}) => target.style.visibility = "visible";

// port event listener on the message manager that demarshalls
// and forwards to the actual receiver. This is a workaround
// until Bug 914974 is fixed.
const onPortMessage = ({data, target}) => {
  const port = demarshal(target, data.port);
  if (port)
    port.postMessage(data.message);
};

// When frame is removed from the toolbox destroy panel
// associated with it to release all the resources.
const onFrameRemove = frame => {
  panelFor(frame).destroy();
};

const Panel = Class({
  extends: Disposable,
  implements: [EventTarget],
  get id() {
    return makeID(this.name || this.label);
  },
  postMessage: function(data, ports) {
    const manager = managerFor(this);
    manager.sendAsyncMessage("sdk/event/message", {
      type: "message",
      bubbles: false,
      cancelable: false,
      data: data,
      origin: this.url,
      ports: ports.map(marshal(manager))
    });
  }
});
exports.Panel = Panel;

validate.define(Panel, contract({
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
    map: x => x && resolve(x),
    ok: x => isLocalURL(x),
    msg: "The `options.icon` must be a valid local URI."
  },
  url: {
    map: x => resolve(x.toString()),
    is: ["string"],
    ok: x => isLocalURL(x),
    msg: "The `options.url` must be a valid local URI."
  }
}));

setup.define(Panel, (panel, params) => {
  setListeners(panel, params);
  panel.setup(params);
});

dispose.define(Panel, function(panel) {
  debuggeeFor(panel).stop();

  debuggees.delete(panel);
  managers.delete(panel);
  panel.dispose();
});


build.define(Panel, (proto, window, toolbox, url) => {
  const panel = Object.create(proto);
  const { promise, resolve } = defer();
  const original = getFrameElement(window);
  const frame = original.cloneNode(true);

  panels.set(frame, panel);

  setAttributes(frame, {
    "src": url,
    "sandbox": "allow-scripts",
    "remote": true,
    "type": "content",
    "transparent": true,
    "seamless": "seamless"
  });

  original.parentNode.replaceChild(frame, original);
  frame.style.visibility = "hidden";

  const debuggee = fromTarget(toolbox.target);
  debuggees.set(panel, debuggee);

  const { messageManager } = frame.frameLoader;
  managers.set(panel, messageManager);
  messageManager.addMessageListener("sdk/event/DOMContentLoaded", onInited);
  messageManager.addMessageListener("sdk/event/DOMContentLoaded", onReady);
  messageManager.addMessageListener("sdk/event/load", onLoad);
  messageManager.addMessageListener("sdk/port/message", onPortMessage);
  messageManager.loadFrameScript(FRAME_SCRIPT, false);

  removed(frame).then(onFrameRemove);


  setup(panel, { debuggee: debuggee,
                 onReady: panel.onReady,
                 onLoad: panel.onLoad });

  return panel;
});

