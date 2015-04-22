# Add-on Developer Tool Pane

### Mockup

![addon-pane][addon-pane]

### Use cases

There are growing number addons that extend devtools capabilities one way or another. This clearly indicates there is a need for a APIs to make this task easier.

Toolbar panels in the developer toolbox represent primary UI estate for a built-in developer tools. It would make sense to let add-on's add their own toolbox panels for extending devtools.

#### Goals

- Simple API should allow add-on to add a new toolbar panel into which it could render add-on specific UI.

- Toolbar panel should let users load a bundled HTML document, and setup a two way communication with an add-on using web standard APIs.

- API should provide a communication channel with debuggee via standard web APIs.


### API

```js
const { Panel } = require("devtools/panel");
const { Tool } = require("devtools/toolbox");

const { MessageChannel } = require("sdk/messaging");

const MyPane = Class({
  extends: Pane,
  title: "Addon pad",
  icon: "./icon.png",
  url: "./index.html",
  tooltip: "My superb addon",
  setup: function({debuggee}) {
    this.debuggee = debugee;
  },
  onAttach: ({source}) => {
    console.log("pane document was attached");
    // Create a two way communication channel to exchange messages
    // with a toolbar panel document.
    const { port1, port2 } = new MessageChannel();
    // Keep reference to one port on and send the other to the
    // panel document.
    this.port = port1;
    this.postMessage({ hi: "there" }, [port2]);
  },
  dispose: function() {
    delete this.debugee;
    delete this.port;
  }
});
exports.MyPane = MyPane;

const tool = new Tool({
  panes: { "addon-panel": MyPane }
});

tool.destroy()
```

Constructor takes mandatory `options.title` that will be displayed over the panel tab (which users can use to toogle it).

Mandatory `options.url` is an add-on relative uri, to a bundled html document, which is loaded whenever panel is toggled.

All other options are optional.

Optional event handler methods can be defined `onAttach`, `onReady`, `onLoad`, `onMessage`. More details on them will be covered in the events
section of the document.

#### Methods

- Pane instances implement `EventTarget` interface there for `on`, `once`, `off` methods can be used to add / remove event handlers.

- Panel instanes implement `postMessage` method that can be used to send messages to a panel window. Unlike `window.postMessage` though panel window won't have a way to communicate back. Two way communication can easily be established by sending a port of a `MessageChannel` to a panel window (see examples for more details).

- Panel optionally may implement `setup` method that will be invoked with an `options` argument when panel is created. Given `options.debuggee` will be an instance of `MessagePort` representing a connection to a [firefox remote debugging][] protocol (see debuggee section of this document for details).

- Panel optionally may implement `dispose` method that will be invoked just before given panel is destroyed. This method can be used to do any cleanup work associated with a panel instance.


#### Events

- Event "attach" is dispatched whenever panel is toggled first time and `pane.url` is started to load. Note that by the time event is received document may already be loaded. Event object given an to a handler has a `source` field, which can be used to send a message to window loaded in the panel. Although sending message on "attach" event is not guaranteed to be received on the other end as JS in the receiver document may not be loaded yet.

- Event "ready" is dispatched after document in the toolbar panel becomes interactive (`document.readyState === "interactive"`).

- Event "load" is dispatched after document in the toolbar panel is fully loaded (`document.readySate === "complete"`).


#### Fields

- Panel instances have a read-only `url` field representing `url` of the document that is loaded into a toolbar panel.
- Panel instances have a read-only `title` field displayed as a toolbar panel tab title.
- Panel instances have a read-only `tooltip` that is dysplayde in a tootip when hovering a toolbar pane tab.
- Panel instances have a read-only `id` field that represents unique identifier of that panel instance.
- Panel instances have a read-only `icon` field representing url of the icon that is desplayed in the toolbar panle tab.

### Example


#### Panel Document

Toolbar panels load an HTML document with expanded principal. Expanded principals allow it to overcome some cross-domain limitations (by providing list of domains document can interact with in `package.json`)
Note: This specific feature is a part of another bigger goal for an add-on sdk and is being worked on sperately, which means it may not be available for toolbar panels initially).

Panel document has no access to any privileged code including add-on APIs. Neither it has access to a debuggee as it may even be on a differrent machine. Only thing panel documents could do is to receive messages from the add-on and communicate back if add-on decides to expose a communication channel.

```html
<html>
	<button id="mybutton">click me</button>
  <script>
    const channel = new MessageChannel();
    const output = channel.port1;
    const input = channel.port2;

		window.addEventListener("click", function(event) {
      if (event.target.id === "mybutton") {
        // Send a message to an add-on when mybutton is pressed.
        outgoing.postMessage({
          id: 1,
          text: "hello world"
        });
      }
		});

		// Pane document will receive a messages from the add-on providing it
    // with a communication port to it.
		window.addEventListener("message", function(event) {
      const port = event.ports[0];
      // connect ports to establish connection between document and an
      // addo-on.
      port.onmessage = input.postMessage.bind(input);
      input.onmessage = port.postMessage.bind(port);
      port.start();
      input.start();
      console.log("connected to an add-on");
	  });
  </script>
</html>
```

Now add-on code needs to register panel and setup a twe way communication channel with it.

```js
const { Panel } = require("dev/pane");
const { Tool } = require("dev/toolbox");
const { Class } = require("sdk/core/heritage");
const { MessageChannel } = require("../sdk/messaging");

const MyPane = Class({
  extends: Panel,
  title: "Addon panel",
  url: "./index.html",
  onReady: function() {
    console.log("Panel is loaded");

    // setup two way communication with a channel.
    const { port1, port2 } = new MessageChannel();
    port1.onmessage = this.emit.bind(this, "message");
    this.postMessage("connect", [port2]);
  },
  onMessage: function(event) => {
    console.log("Button was clicked");
  }
});

const myTool = new Tool({
  name: "my tool",
  panels: {
    myPanel: MyPanel
  }
});
```

### Debuggee

Developer toolbar is bound to a specefic debuggee - target (usually a tab) that is being inspected. Toolbar panels are given a `debuggee` at creation in form of a `[MessagePort][]` instance that represents a connection to a [remote debugging protocol][]. Messages posted to a debugge represent JSON packets of the [remote debugging protocol][]. Messages received on the `debuggee` are also JSON packets send from the debugger protocol server. Given such a `debuggee` add-ons are able to do anything that built-in developer tools can do (as they use same debugger protocol) and even beyond.

```js
const { Panel } = require("dev/pane");
const { Tool } = require("dev/toolbox");
const { Class } = require("sdk/core/heritage");

const REPLPanel = Class({
  extends: Panel,
  label: "Actor REPL",
  tooltip: "Firefox debugging protocol REPL",
  icon: "./robot.png",
  url: "./index.html",
  setup: function({debuggee}) {
    this.debuggee = debuggee;
  },
  dispose: function() {
    delete this.debuggee;
  },
  onReady: function() {
    console.log("READY");
    this.debuggee.start();
    this.postMessage("RDP", [this.debuggee]);
  }
});

const replTool = new Tool({
  name: "repl",
  panels: { repl: REPLPanel }
});
```

Since `debuggee` is just a `MessageChannel` port it can be send over to a panel document to enable direct communication with a remote debugging protocol server. In this example we do not illustrate panel document code but it can be found in the add-on sdk examples.

### RDP Client

Now communication with a debuggee through a raw [remote debugging protocol][] maybe a very tedious. There for SDK is exposing a client code that can be included into a panel document to interact with a debuggee via high level OOP API. Although community could always innovate and build even better clients or provide some sugar on it's own.

```html
<html>
  <head>
      <script src="resource://sdk/dev/volcan.js"></script>
      <script src="./task.js"></script>
  </head>
  <body>
  </body>
  <script>
    const wait = (target, type, capture) => new Promise((resolve, reject) => {
      const listener = event => {
        target.removeEventListener(type, listener, capture);
        resolve(event);
      };
      target.addEventListener(type, listener, capture);
    });

    const display = message =>
      document.body.innerHTML += message + "<br/>";

    Task.spawn(function*() {
      var event = yield wait(window, "message");
      var port = event.ports[0];

      display("Port received");
      var root = yield volcan.connect(port);

      display("Connected to a debugger");

      var message = yield root.echo("hello")

      display("Received echo for: " + message);

      var list = yield root.listTabs();

      display("You have " + list.tabs.length + " open tabs");

      var activeTab = list.tabs[list.selected];

      display("Your active tab url is: " + activeTab.url);

      var sheets = yield activeTab.styleSheetsActor.getStyleSheets();

      display("Page in active tab has " + sheets.length + " stylesheets");

    });
  </script>
</html>
```

Example above includes SDK provided Remote debugging protocol client from `resource://sdk/dev/volcan.js` url that is used to connect to debuggee port send to a panel document. After client is connected high level API is used to interact with a debuggee (to disable it's stylesheet). Rest of the code can be found in the SDK examples.


### Debuggee instrumentation

While firefox debugging protocol provides tons of build-in instrumentation facilities via actors, add-on still may wish to accomplish something that isn't exposed via existing protocol. There for add-on should be able to define custom instrumentation code for a debuggee. In other browsers this is usually accomplished via code evaluation in the debuggee context, but that's pretty limited. In our case we could leverage more powerful foundation used to build firefox developer tools  itself. Add-on should be able to provide custom actor definition in form of a JS (with limited capabilities, no access to other add-on modules for example to so we won't have to send all of the add-on modules to debuggee which maybe on a mobile phone) file. Add-on actors can be loaded alond with a developer toolbox & there for they could provide additional APIs to instrument debuggee through a remote debugging protocol.

This would also allow community to develop actors providing API they wish for example they could polifill APIs exposed by other browsers.

**API to define custom actors is to be determined**



[addon-pane]:http://f.cl.ly/items/162M1P2I100y1M0y0R22/Screen%20Shot%202013-11-18%20at%2010.23.33%20.png
[MessageChannel]:http://www.w3.org/TR/webmessaging/
[MessageChannel-intro]:http://dev.opera.com/articles/view/window-postmessage-messagechannel/
[iframe]:https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe
[Web Messaging]:http://www.w3.org/TR/webmessaging/
[posting messages]:http://www.w3.org/TR/webmessaging/#posting-messages
[Event definition]:http://www.w3.org/TR/webmessaging/#event-definitions
[Remote Debugging Protocol]:https://wiki.mozilla.org/Remote_Debugging_Protocol
[MessagePort]:http://www.w3.org/TR/webmessaging/#messageport
[Bug 983928]:https://bugzilla.mozilla.org/show_bug.cgi?id=983928
