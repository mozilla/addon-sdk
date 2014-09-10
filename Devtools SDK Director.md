# Director

## Overview

DevTools Add-ons should be able to support remote targets (e.g. Firefox OS Devices/Simulators, 
Firefox for Android) and local targets without changes in their own add-on code, the Director
helps add-ons developers to inject their instrumentation code to the target tab, local or remote.

Using the Director API an add-on developer can install/uninstall instrumentation code modules.

The instrumentation javascript code lives in a **Debug Script** running on the remote target side:

- will be automatically attached/detached on tab navigation 
- has a one way access the target tab window
- communicate with a devtool add-on via MessagePort instance
- can be activated (instrumenter.setup) and deactivated (instrumenter.finalize)

### Examples

#### PROPOSED: Install a new Instrumenter

**Debug Scripts** will be defined using the DebugScript class from the "dev/debug-script"
module, and added to a **Tool** definition.

The **Tool** internals will ensure (using the **Director** class from the "dev/debug-script"
module) that the requested **Debug Scripts** are automatically installed and activated on the 
debugging target.

**myaddon/lib/main.js**:

``` js
const { Panel } = require("dev/panel");
const { Tool } = require("dev/toolbox");
const { DebugScript } = require("dev/debug-script");

const myInstrumenter = DebugScript({
  id: "customInstrumenter",
  reload: true, // defaults to false
  contentScriptFile: self.data.url("instrumenter-script.js"),
  contentScriptOptions: {
    inPageScript: "...",
    enabledFeatureX: false
  }
});

const CustomPanel = ...

const myCustomDevTools = new Tool({
  debugScripts: [customInstrumenter],
  panels: { custom: CustomPanel }
});
```

In the **Debug Script**, the javascript code has one way access to the target *window* object
and to the messageport connected to the devtools add-on client as *port*.

**myaddon/data/instrumenter-script.js**:

```
console.log("LOADING debug script on: ", window.location);

port.onmessage = function (evt) {
  ... // react to the evt, use evt.data
  evt.source.postMessage(reply); // reply using evt.source
}

// and/or send a message immediately
port.postMessage("your instrumenter is ready");
```

#### PROPOSED: Use an installed debug-script (in the add-on and send it as a messageport to the devtool panel)

The add-on devtool **Panel** will receive a *Director* instance in the *setup* method, 
and it should handle its *attach/detach* events, to be able to receive and invalidate
the messageport connected to the *Debug Scripts*, previously requested in the *Tool*  definition.

The add-on devtool **Panel** is responsible to send the needed messageport object to the
its related iframe.

**myaddon/lib/main.js**:
```js
MyDevtoolPanel = Class({
  extends: Panel,
  name: "my-devtool-panel",
  ...
  setup: function({director}) {
    this.director = director;
    this.onDirectorAttach = this.onDirectorAttach.bind();
    this.onDirectorDetach = this.onDirectorDetach.bind();
    
    on(director, 'attach', this.onDirectorAttach);
    on(director, 'detach', this.onDirectorDetach);
  },
  dispose: function() {
    off(this.director);
    delete this.director;
  },
  onDirectorAttach: function({url, innerId, debugScripts) {
    var port = debugScripts["customInstrumenter"];
    port.start();
    this.postMessage("customInstrumenter-port", [port]);
  }
  onDirectorDetach: function({ innerId }) {
    this.postMessage("customInstrumenter-port-detach", []);
  }
});  
```

In the devtool **Panel** iframe, the port will be used to directly exchange json messages 
between the iframe embedded in the devtool toolbox and the target debug script.

**myaddon/data/devtool-panel.js**
```js
var myInstrumenterPort;
    
window.addEventListener("message", function(evt) {
  if (evt.data === "customInstrumenter-port") {
    // setup port message handler
    var port = myInstrumenterPort = evt.ports[0];
    port.onmessage = function(evt) {
      console.log("ON MESSAGE PORT MESSAGE", evt)
    }
    post.postMessage({ k1: "v1" });
  } else if (evt.data === "customInstrumenter-port-detach") {
    // cleanup port message handler
    myInstrumenterPort.onmessage = null;
    myInstrumenterPort = null;
  }
}, false);

```

### PROPOSED: Configure support for remote target on Devtool Panels

A devtool **Panel** should be able to declare its supported targets and 
detect the target shared by the other panels embedded in the devtool toolbox.

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
  // and does not support add-ons at all
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
