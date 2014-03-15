# Add-on Developer Tool Pane

### Mockup

![addon-pane][addon-pane]

### Use cases

There are growing number addons that extend devtools capabilities
one way or another. This clearly indicates there is a need for a
APIs to make this task easier.

Panes in the developer tools are the primary UI estate for built-in
tools. Add-on's can be provided an API to add their own panes.

#### Goals

- Simple API should allow add-on to add a new pane into which
  it can render add-on specific UI.

- Pane API should let users load a bundled HTML document,
  that would have two way communication with an add-on in
  a an API that ressables how iframes of different origin
  can communicate with each other.

- API should not be constrained with 1 to 1 relation, meaning
  that same pane may actually be loaded multiple times (pane
  maybe activated on several tabs).

- API should allow communication with an individual viewports
  or all of them at the same time.

### Non goals

- API is not supposed to completely emulate iframe API more
  specifically `pane.contentWindow` & `pane.contentDocument`
  are out of scope.

### Future maybe goals

- Once `MessageChannel` API is available it should be possible
  send message ports to the viewports to enable more direct
  and standard communication.

- Once E10S compatible `WindowProxy` is implemented as defined
  by [HTML WebMessaging][] it may be exposed directly.


### API


```js
const { Pane } = require("dev/tool")
const pane = new Pane({
  name: "addon-pane",
  title: "Addon pad",
  icon: "./icon.png",
  url: "./index.html",
  tooltip: "My superb addon"
  onAttach: ({source, target}) => {
    console.log("pane was attached to new developer toolbox");
  },
  onReady: ({source, origin}) => {
    console.log("pane document is interactive");
    source.postMessage({ hi: "there" }, origin);
  },
  onLoad: ({source}) => {
    console.log("pane document load is complete");
  },
  onMessage: ({source, data, origin}) => {
    console.log("Received ping from pane document");
    source.postMessage("pong!", origin);
  }
});
```

Constructor takes mandatory `options.title` that will be displayed
over the pane (which users can use to toogle it).

Mandatory `options.url` is relative uri, to an add-on bundled html
document (which will be loaded into every pane viewport).

All other options are optional. Add-on can multiple Panes but creating
multiple panes with same `url` will fail. In order to create multiple
panes with same `url` optional `options.name` can be provided that must
be unique.

Optional event handlers `onAttach`, `onReady`, `onLoad`, `onMessage`
may be provided. More details on them will be covered in the events
section of the document.

#### Methods

- Pane instances implement `EventTarget` interface there for
  `on`, `once`, `off` method that can be used to register / unregister
  event handlers.

- Pane instances implement `postMessage` function that implements
  interface defined by HTML [posting messages][] specification. (Initially
  `targetOrigin` and `transfer` arguments will be ignored. This method
  can be used to post a message to all of the pane documents that are
  loaded in all viewports at the moment of the call.

- Pane instances implement `Disposable` interface there for they can be
  destroyed by calling `destroy`. This will remove all pane views from
  firefox user interface. Panes are automatically destroyed once add-on
  is unloaded.

#### Events

Most event handlers are passed an event `source` argument representing a window
proxy from which event came. Event `source` implements `source.postMessage`
method defined by HTML [posting messages][] specification, which can be used
to send messages back to a `window` from which event occured. Event `target`
is a pane viewport that implements same API as pane, but is bound to a specific
viewport.

- Event "attach" is dispatched whenever new underlaying view port is created and
  `pane.url` is started to load into it. Note that by the time event is received
  document may already be loaded. Event handler is given event `source` object.
  Message send from attach event handler is not guaranteed to be received on
  the other end as JS in the receiver document may not be loaded yet.

- Event "ready" is dispatched whenever document in any of the viewports
  becomes `interactive` (`document.readyState === "interactive"`).
  Event handler is passed an event `source` object.

- Event "load" is dispatched whenever document in any of the viewport
  is fully loaded (`document.readySate === "complete"`). Event handler is passed
  an event `source` object.

- Event "message" is dispatched whenever document in any of the viewport
  sends a message to a parent (`window.parent.postMessage(data, "*"))`). Event
  handler is passed object implementing interface from HTML [event definition][]
  specification. Which includes `event.data`, `event.origin`, `event.source`
  (event `source` object).

#### Fields

- Pane instances have a read-only `url` field representing `url` provided
  to a constructor.
- Pane instances have a read-only `title` field representing it's title.
- Pane instances have a read-only `tooltip` field representing a text displayed
  in a tootip when hovering a pane title.
- Pane instances have a read-only `id` field representing unique identifier
  for the instance.

### Example


#### Pane Document

Document in the pane is an HTML document that has expanded
principal. Expanded principals allow document to overcome
cross-domain limitations. Document scripts will be able to
interact with a domains that were provided in `package.json`.
Note: This specific feature part of a bigger goal for add-on
sdk and may not be present in the initial draft.

Pane document has no direct access to a privileged add-on APIs
or a content document being debugged. Pane document scripts can
communicate with add-on host (code that has access to privileged
APIs) through message passing:

```html
<html>
	<button id="mybutton">click me</button>
  <script>
		window.addEventListener("click", function(event) {
      if (event.target.id === "mybutton") {
        // Pane document can send messages to add-on host
        // via message events.
        window.parent.postMessage({
          id: 1,
          text: "hello world"
        }, "*");
      }
		});

		// Pane document can also receive messages from the privileged
    // add-on code. Via message events.
		window.addEventListener("message", function(event) {
      console.log("received message from the add-on host", event.data);
	  });
  </script>
</html>
```

On the add-on host side such messages can be handled via message event
handler:

```js
const { Pane } = require("dev/tool")
const pane = new Pane({
  title: "Addon pad",
  url: "./index.html",
  onMessage: ({source, data, origin}) => {
    console.log("Received message from pane document");
    // send message back to pane document.
    source.postMessage("pong!", origin);
  }
});
```

### Inspection target

Pane viewports are bound to a specific target (tab) being inspected.
Pane viewports are passed an `event.target` that are instances of
`[MessagePort][]` and represent [remote debugging protocol][] connection
to an inspection target. This means that messages posted on the `target`
are send as packets of [remote debugging protocol][] to a debuggee,
responses are also delivered back to a `target` via message events.

```js
const pane = new Pane({
  title: "Addon pad",
  url: "./index.html",
  onReady: ({source, target, origin}) => {
    target.addEventListener("message", function({data}) {
      console.log("Received packet from the inspection target", packet)
    });
    target.start();
  },
  onMessage: ({source, data, origin, target}) => {
    console.log("Forward pane message to an inspection target", data);
    target.postMessage(data);
  }
});
```

Above example sets up one way pane document to inspection target communication.
Although in practice two way communication is more interesting. Given that
ports are transfarable it's very easy to set up two way communication between
pane document & inspection target:


```js
const pane = new Pane({
  title: "Addon pad",
  url: "./index.html",
  onReady: ({source, target, origin}) => {
    // Transfer inspection target port to pane document once it's ready.
    source.postMessage({ type: "inspection-target" }, origin, [target]);
  }
});
```

Now communication with a debuggee through raw [remote debugging protocol][]
maybe too low level for most use cases. Although given raw communication port
it is possible to generate easier to use APIs on the fly, either dinamycally
(see [Bug 983928]) or statically. We could expose certain scripts to pane
document via resource URIs to allow exactly that.


### Inspection target instrumentation

While firefox debugging protocol may provide some build-in instrumentation
code in form of actors that may not necessarily address cover everything
that developer tool add-on may want to accomplish. There for add-on should
be able to provide own custom instrumentation for a debugee. In most
browsers this is accomplished via code evaluation on the inpsection target,
but that's pretty limited. We could leverage work done to build firefox
devtools itself and build on top of actors. Add-on should be able to provide
custom actor definition in form of a module (with limited access, so that
we won't have to send all of the add-on modules to debuggee which maybe
on mobile phone). Add-on actors would be loaded when developer toolbox is
activated & there for it will be able to instrument debuggee. It also could
provide high level API that can be consumed from the toolbox panel or
add-on itself.

As a side effect community could implement actor providing chrome API &
a script for pane document as a clinet to it, essentially providing polyfill
that would bridge differences between browsers.



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
