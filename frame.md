### Intro

Frame API is marily a replacement for a more problematic
`Widget` API, although instead of being a replacement for
buttons, drawings, and more interactive UI component it
will be designed to focused to be a solution when some
advance and custom UI is requred.

Intent is to provide an subset of of the HTML iframe API
compatible with multiprocess architecture.

Implementation will actually create iframes and load
provided document in them. API provides an interface to
communicate with those iframes.

### Goals

- Frame API should let users load a bundled HTML document,
  that can interacted in a way iframes of different origin
  can communicate with each other.

- API should not be constrained with 1 to 1 relation, meaning
  that multiple documents may actually be loaded (one per
  browser window for example).

- API should allow communication with an individual viewports
  or all of them at the same time.

### Non goals

- API is not supposed to completely emulate iframe API more
  specifically `frame.contentWindow` & `frame.contentDocument`
  are out of scope.

### Future maybe goals

- Once `MessageChannel` API is available it should be possible
  send message ports to the viewports.

- Once E10S compatible `WindowProxy` is implemented as defined
  by [HTML WebMessaging][] it may be exposed directly.


### API

```js
let frame = new Frame({
  name: "my-iframe",
  url: "./index.html",
  onAttach: ({source, origin}) => {
    console.log("Frame was attached to new browser window");
  },
  onReady: ({source, origin}) => {
    console.log("Frame document is interactive");
    source.postMessage({ hi: "there" }, origin);
  },
  onLoad: ({source, origin}) => {
    console.log("Frame load is complete");
  },
  onMessage: ({source, data, origin}) => {
    console.log("Received ping from frame");
    source.postMessage("pong!", origin);
  }
});
```

Constructor takes mandatory `options.url` that is relative uri to
an add-on bundled html document (which will be loaded into every
viewport).

All other options are optional. Optional `options.name` can be provided
that must be unique per add-on. Unique frame `id` will be generated
either from `options.name` or if not provided from the `options.url`.
Since frame `id` is required to be unique attempt to create two frames
with a same `url` and no `name` or with same `name` will fail.

Optional event handlers `onAttach`, `onReady`, `onLoad`, `onMessage`,
more details on that will be covered in the events section of the
document.


#### Methods

- Frame instances implement `EventTarget` interface there for
  `on`, `once`, `off` method that can be used to register / unregister
  event handlers.

- Frame instances implement `postMessage` function that implements
  interface defined by HTML [posting messages][] specification. (Initially
  `targetOrigin` and `transfer` arguments will be ignored. This method
  can be used to post a message to all of the documents that are presently
  loaded in all viewports.

- Toolbar instance implements `Disposable` interface there for it can be
  destroyed by calling `destroy`. This will remove all frame views from
  firefox user interface. Frames are automatically destroyed once add-on
  is unloaded.

#### Events

Most event handlers are passed an `event` that has a `source` field
represeting a window proxy from which event came. `event.source` implements
`source.postMessage` method defined by HTML [posting messages][] specification,
which can be used to send messages back to a `window` from which event occured.

- Event "attach" is dispatched whenever new underlaynig view port `iframe`
  is created and `frame.url` is staretd to load into it. Note that by the
  time event is received document may already be loaded. Event handler is
  given `event` object with a `source` field for the given view port. Note
  that sending message to just attached document is not guaranteed to be recieved
  as JS in the document may not be loaded yet.

- Event "ready" is dispatched whenever document in any of the viewport
  `iframe` becomes `interactive` (`document.readyState === "interactive"`).
  Event hanhler is passed an `event` object.

- Event "load" is is dispatched whenever document in any of the viewport
  `iframes` is fully loaded (`document.readySate === "complete"`). Event
  handler is pasesd an `event` object.

- Event "message" is dispateched whenever document in any of the viewport
  `iframes` sends a message to a parent.
  (`window.parent.postMessage(data, "*"))`). Event handler is passed object
  implementing interface in HTML [event definition][] specification. Which
  includes `event.data`, `event.origin`, `event.source` (event `source`
  object).


#### Fields

- Toolbar instances have a read-only `url` field represeting `url` provided
  to a constructor.


#### Example:

```js
const { Frame } = require("sdk/ui/frame");
const { Toolbar } = require("sdk/ui/toolbar");

const frame = new Frame({
  url: "./index.html"
  onAttach: ({source, origin}) => {
    console.log("Frame was attached to new browser window");
    source.postMessage("hi there", origin);
  },
  onReady: ({source, origin}) => {
    console.log("Frame document is interactive");
    // post current state for document to render.
    source.postMessage(state, origin);
  },
  onLoad: ({source}) => {
    console.log("Frame load is complete");
  },
  onMessage: ({source, data, origin}) => {
    console.log("Received data from frame");

    if (data === "ping!")
      source.postMessage("pong!", origin);
  }
});
```

#### Open questions

- Should `frame` also dispatch `detach` events.

- Consider `frame.sources` iterator for iterating attached frame sources.


[iframe]:https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe
[Web Messaging]:http://www.w3.org/TR/webmessaging/
[posting messages]:http://www.w3.org/TR/webmessaging/#posting-messages
[Event definition]:http://www.w3.org/TR/webmessaging/#event-definitions
