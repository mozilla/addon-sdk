# Director

## Overview

DevTools Addons should be able to support remote targets (e.g. Firefox OS Devices/Simulators, 
Firefox for Android) and local targets without changes in their own addon code, the Director
helps addons developers to inject their instrumentation code to the target tab, local or remote.

Using the Director API an addon developer can install/uninstall instrumentation code modules.

The instrumentation code modules live in a **Content Script** running on the remote target side:

- can be activated (instrumenter.setup) and deactivated (instrumenter.finalize)
- will be automatically attached/detached on tab navigation 
- has direct access to target tab window and document objects
- evaluate javascript in the target tab javascript context (using the `evalInWindow` function)
- send and receive custom events with the devtool addon using a MessagePort

### Examples

#### PROPOSED: Install a new Instrumenter

**myaddon/lib/main.js**:

``` js
const { Panel } = require("dev/panel");
const { Tool } = require("dev/toolbox");
const { ContentScriptInstrumenter } = require("devtools/director");

const customInstrumenter = ContentScriptInstrumenter({
  id: "customInstrumenter",
  contentScriptFile: self.data.url("instrumenter-script.js"),
  contentScriptOptions: {
    inPageScript: "...",
    enabledFeatureX: false
  }
});

const CustomPanel = ...

const myCustomDevTools = new Tool({
  instrumenters: [customInstrumenter],
  panels: { custom: CustomPanel }
});
```

**myaddon/data/instrumenter-script.js**:

```
// NOTE: temporary solution to give a MessagePort to the instrumenter content script
self.on("connectPort", function (port) {
  port.onmessage = function (evt) {
    ... // react to the evt, use evt.data
    evt.source.postMessage(reply); // reply using evt.source
  }
  // and/or send a message immediately
  port.postMessage("your instrumenter is ready");
});
```

#### Use an installed Instrumenter (in the devtool panel using volcan)

```js
...
var root = yield volcan.connect(dbgPort);
var list = yield root.listTabs();
var selectedTab = list.tabs[list.selected];

var instrumenter = selectedTab.directorActor.getInstrumenter("customInstrumenter");

instrumenter.on("attach", function ({innerId, url, port) {
  // handle message from the received messageport client
  var handleMessage = function (evt) {
    console.log("RECEIVED EVT", evt.data);
    evt.source.postMessage({"attr": "reply"});
  }
  
  // remove event handler from messageport client on detach
  instrumenter.once("detach", () => port.off("meesage", handleMessage));
  // add event handler on messageport client event  
  port.on("message", handleMessage);
  
  // start queue messages
  port.start();
});
```

### PROPOSED: Configure support for remote target on Devtool Panels

```js
...

MyDevtoolPanel = Class({
  extends: Panel,
  name: "my-devtool-panel",
  label: "MyDevtoolPanel",
  tooltip: "My Devtool Panel",
  icon: "./img/webstore-icon.png",
  url: "./panel.html",
  // NOTE: this panel supports local and remote tabs and apps
  // and does not support addons at all
  supportedTarget: {
    local: true,
    remote: true,
    tab: true,
    app: true,
    addon: false
  },
  setup: function({debuggee, toolboxTarget}) {
    this.debuggee = debuggee;
    this.toolboxTarget = toolboxTarget;
  },
  dispose: function() {
    delete this.debuggee;
  },
  onReady: function() {
    this.debuggee.start();
    this.postMessage({
      type: "RDP",
      // NOTE: we should pass to volcan enough info to be able to detect the
      // toolbox target on the debugee connection (which currently is not the toolbox connection)
      toolboxTarget: this.toolboxTarget
    }, [this.debuggee]);
  }
});
```

### Possible New Features

- expose volcan to the instrumenter content script
- expose CallWatcher features to the instrumenter content script (it could help in a lot of common
  instrumentation use cases)

## References

- Related issues on Bugzilla:
  - [Bug 980481 - Debuggee instrumentation a.k.a. director](https://bugzilla.mozilla.org/show_bug.cgi?id=980481)
  - [Bug 1024577 - Hookup sdk devtools with director actor](https://bugzilla.mozilla.org/show_bug.cgi?id=1024577)
  - [Bug 980421 - Enable toolbox pane for remote tabs](https://bugzilla.mozilla.org/show_bug.cgi?id=980421)
