### Mockup

![mockup][mockup]

### Use Cases

There are tons of popular [toolbar addons][] for firefox today,
which clearly indicates there are lots of use cases. At the
moment SDK only provides Widget and Panel API that could be
used to address same problem space, although we would like
to deprecate widgets to adress problems we learned from our
experience and panels are not persistent UI real estate which
may makes it not a a good fit for a specific cases.

### Goals

- Toolbars should provide persistent UI real estate for placing
  other SDK provided components.

- Firefox users should be in control of which toolbars are
  displayed and when. There for there should be a intuitive user
  interface for hiding / showing them.

- Toolbar state should be persistent across firefox sessions.

### Non goals

- Dynamically updating toolbar content is not a goal, in fact
  that tends to provide a pretty unpleasent user experience.

- Not all UI components provided by SDK will be compatible with
  Toolbars although some maybe made over time.

### Future maybe goals

- Customizable toolbars should let users decide what they want
  to keep in toolbar and what they want to disregard.

- Window / tab specific toolbar states.

### API

```js
let toolbar = new Toolbar({
  title: "Addon Demo",
  items: [frame],
  hidden: false,
  onShow: () => {
    console.log("toolbar was shown");
  },
  onHide: () => {
    console.log("toolbar was hidden");
  }
});
```

Constructor takes mandatory `options.title` that will be displayed
in the Firefox toolbars menu (which users can use to toogle toolbar).

All other options are optional, although toolbar is pretty useless
without `items` in it. `options.items` can be an array or set of
supported UI component instances that needs to be placed in the
toolbar. Initially only [Frame][]s will be supported, but more
components will be made compatible over time.

Optionally `options.hidden` can be provided to express desired initial
state. If not provided newly installed add-on's toolbar will be shown.
This option won't take any effect on subsequent loads of add-on as
users choice will be respected.

Two optional event handlers `onShow` and `onHide` can also be provided
which will be invoked when toolbar is toggled on / off.

#### Methods

- Toolbar instances implement `EventTarget` interface there for
  `on`, `once`, `off` method that can be used to register / unregister
  event handlers.

- Toolbar instance implements `Disposable` interface there for it can be
  destroyed by calling `destroy`. This will remove toolbar from the
  firefox user interface. Toolbars will be destroyed on add-on unload.

#### Events

- Event "show" will be dispatched whenever toolbar is toggled on. Note that
  it won't be dispatched on toolbar creation as it's was not hidden prior
  to that.

- Event "hide" will be dispatche whenevr toolbar is toggled off. Note that
  it won't be dispatched on toolbar creation if `hidden` was `true` as it's
  technically was not vilisible anyhow.

#### Fields

- Toolbar instances have a field `hidden` that is `true` if toolbar is hidden
  and is `false` if toolbar is `shown`. It is `undefined` if toolbar is not
  yet initialized or was already destroyed.


#### Example:

```js
const { Frame } = require("sdk/ui/frame");
const { Toolbar } = require("sdk/ui/toolbar");

const frame = new Frame({
  url: "./search-toolbar.html"
  onAttach: ({source}) => {
    console.log("Frame was attached to new browser window");
  },
  onReady: ({source, origin}) => {
    console.log("Frame document is interactive");
    source.postMessage({ hi: "there" }, origin);
  },
  onLoad: ({source}) => {
    console.log("Frame load is complete");
  },
  onMessage: ({source, data, origin}) => {
    console.log("Received ping from frame");
    source.postMessage("pong!", origin);
  }
});

const toolbar = Toolbar({
  title: "Uber search",
  items: [frame],
  onShow: () => {
    console.log("Yei they <3 my toolbar!");
  },
  onHide: () => {
    console.log("Oh no! what happend between us ??");
  }
});
```

[mockup]:https://people.mozilla.org/~shorlander/files/addons-in-toolbar-i01/images/04.png
[toolbar addons]:https://addons.mozilla.org/En-us/firefox/search/?q=toolbar
