# Working with Content Scripts #

Almost all interesting add-ons will need to interact with web content or the
browser's user interface. For example, they may need to access and modify the
content of web pages or be notified when the user clicks a link.

The SDK provides several core modules to support this:

**[panel](packages/addon-kit/docs/panel.html)**<br>
Create a dialog that can host web content.

**[page-worker](packages/addon-kit/docs/page-worker.html)**<br>
Retrieve a page and access its content, without displaying it to the user.

**[page-mod](packages/addon-kit/docs/page-mod.html)**<br>
Execute scripts in the context of selected web pages.

**[widget](packages/addon-kit/docs/widget.html)**<br>
Host an add-on's user interface, including web content.

**[context-menu](packages/addon-kit/docs/context-menu.html)**<br>
Add items to the browser's context menu.

The Mozilla platform is moving towards a model in which it uses separate
processes to display the UI, handle web content, and execute add-ons. The main
add-on code will run in the add-on process and will not have direct access to
any web content.

This means that an add-on which needs to interact with web content needs to be
structured in two parts:

* the main script runs in the add-on process
* any code that needs to interact with web content is loaded into the web
content process as a separate script. These separate scripts are called
_content scripts_.

A single add-on may use multiple content scripts, and content scripts loaded
into the same context can interact directly with each other as well as with
the web content itself. See the section below on
<a href="dev-guide/addon-development/web-content.html#content_script_access">
content script access</a>.

The add-on script and content script can't directly access each other's state.
Instead, you can define your own events which each side can emit, and the
other side can register listeners to handle them. The interfaces are similar
to the event-handling interfaces described in the
[Working with Events](dev-guide/addon-development/events.html) guide.

The diagram below shows an overview of the main components and their
relationships. The gray fill represents code written by the add-on developer.

<img class="image-center" src="media/content-scripting-overview.png"
alt="Content script events">

This might sound complicated but it doesn't need to be. The following add-on
uses the [page-mod](packages/addon-kit/docs/page-mod.html) module to replace the
content of any web page in the `.co.uk` domain by executing a content script
in the context of that page:

    var pageMod = require("page-mod");

    pageMod.add(new pageMod.PageMod({
      include: ["*.co.uk"],
      contentScript: 'document.body.innerHTML = ' +
                     '"<h1>this page has been eaten</h1>";'
    }));

In this example the content script is supplied directly to the page mod via
the `contentScript` option in its constructor, and does not need to be
maintained as a separate file at all.

## Loading Content Scripts ##

The constructors for content-script-using objects such as panel and page-mod
define a group of options for loading content scripts:

<pre>
  contentScript      string, array
  contentScriptFile  string, array
  contentScriptWhen  string
</pre>

We have already seen the `contentScript` option, which enables you to pass
in the text of the script itself as a string literal. This version of the API
avoids the need to maintain a separate file for the content script.

The `contentScriptFile` option enables you to pass in the local file URL from
which the content script will be loaded. To supply the file
"my-content-script.js", located in the /data subdirectory under your package's
root directory, use a line like:

    // "data" is supplied by the "self" module
    var data = require("self").data;
    ...
    contentScriptFile: data.url("my-content-script.js")

Both `contentScript` and `contentScriptFile` accept an array of strings, so you
can load multiple scripts, which can also interact directly with each other in
the content process:

    // "data" is supplied by the "self" module
    var data = require("self").data;
    ...
    contentScriptFile:
        [data.url("jquery-1.4.2.min.js"), data.url("my-content-script.js")]

Scripts specified using contentScriptFile are loaded before those specified
using contentScript. This enables you to load a JavaScript library like jQuery
by URL, then pass in a simple script inline that can use jQuery.

The `contentScriptWhen` option specifies when the content script(s) should be
loaded. It takes one of three possible values:

* "start" loads the scripts immediately after the document element for the
page is inserted into the DOM. At this point the DOM content hasn't been
loaded yet, so the script won't be able to interact with it.

* "ready" loads the scripts after the DOM for the page has been loaded: that
is, at the point the
[DOMContentLoaded](https://developer.mozilla.org/en/Gecko-Specific_DOM_Events)
event fires. At this point, content scripts are able to interact with the DOM
content, but externally-referenced stylesheets and images may not have finished
loading.

* "end" loads the scripts after all content (DOM, JS, CSS, images) for the page
has been loaded, at the time the
[window.onload event](https://developer.mozilla.org/en/DOM/window.onload)
fires.

The default value is "end".

### <a name="content_script_access">Content Script Access</a> ###

Content scripts loaded into the same global execution context can interact
with each other directly as well as with the web content itself. However,
content scripts which have been loaded into different execution contexts
cannot interact with each other.

For example:

* if an add-on creates a single `panel` object and loads several content
scripts into the panel, then they can interact with each other

* if an add-on creates two `panel` objects and loads a script into each
one, they can't interact with each other.

* if an add-on creates a single `page-mod` object and loads several content
scripts into the page mod, then only content scripts associated with the
same page can interact with each other: if two different matching pages are
loaded, content scripts attached to page A cannot interact with those attached
to page B.

The web content has no access to objects created by the content script, unless
the content script explicitly makes them available.

## <a name="content_script_events">Communicating with Content Scripts</a> ##

To enable add-on scripts and content scripts to communicate with each other,
each end of the conversation has access to a `port` object which defines two
functions:

**`emit()`** is used to emit an event. It may be called with any number of
parameters, but is most likely to be called with a name for the event and
an optional payload. The payload can be any value that is
<a href = "dev-guide/addon-development/web-content.html#json_serializable">serializable to JSON</a>.
It is used to emit an event:

    port.emit("myEvent", myEventPayload);

**`on()`** takes two parameters: the name of the event and a function to handle it:

    port.on("myEvent", function handleMyEvent(myEventPayload) {
      // Handle the event
    });

We could depict the interface between add-on code and content script code like
this:

<img class="image-center" src="media/content-scripting-events.png"
alt="Content script events">

Events are asynchronous: that is, the sender does not wait for a reply from
the recipient but just emits the event and continues processing.

### Accessing `port` in the Content Script ###

In the content script the `port` object is available as a property of the
global `self` object. Thus, to emit an event from a content script:

    self.port.emit("myContentScriptEvent", myContentScriptEventPayload);

To receive an event from the add-on code:

    self.port.on("myAddonEvent", function(myAddonEventPayload) {
      // Handle the event
    });

Compare this to the technique used to receive _built-in_ events in the
content script. For example, to receive the `context` event in a content script
associated with a [context menu](packages/addon-kit/docs/context-menu.html)
object, you would call the `on` function attached to the global `self` object:

    self.on("context", function() {
      // Handle the event
    });

So the `port` property is essentially used here as a namespace for
user-defined events.

### Accessing `port` in the Add-on Script ###

In the add-on code, the channel of communication between the add-on and a
particular content script context is encapsulated by the `worker` object. Thus
the `port` object for communicating with a content script is a property of the
corresponding `worker` object.

However, the worker is not exposed to add-on code in quite the same way
in all modules. The `panel` and `page-worker` objects integrate the
worker API directly. So to receive events from a content script associated
with a panel you use `panel.port.on()`:

    var panel = require("panel").Panel({
      contentScript: "self.port.emit('showing', 'panel is showing');"
    });

    panel.port.on("showing", function(text) {
      console.log(text);
    });

    panel.show();

Conversely, to emit user-defined events from your add-on you can just call
`panel.port.emit()`:

    var panel = require("panel").Panel({
      contentScript: "self.port.on('alert', function(text) {" +
                     "  console.log(text);" +
                     "});"
    });

    panel.show();
    panel.port.emit("alert", "panel is showing");

The `panel` and `page-worker` objects only host a single page at a time,
so each distinct page object only needs a single channel of communication
to its content scripts. But some modules, such as `page-mod`, might need to
handle multiple pages, each with its own context in which the content scripts
are executing, so it needs a separate channel (worker) for each page.

So `page-mod` does not integrate the worker API directly: instead, each time a
content script is attached to a page, the worker associated with the page is
supplied to the page-mod in its `onAttach` function. By supplying a target for
this function in the page-mod's constructor you can register to receive
events from the content script, and take a reference to the worker so as to
emit events to it.

    var pageModScript = "window.addEventListener('click', function(event) {" +
                        "  self.port.emit('click', event.target.toString());" +
                        "  event.stopPropagation();" +
                        "  event.preventDefault();" +
                        "}, false);" +
                        "self.port.on('warning', function(message) {" +
                        "window.alert(message);" +
                        "});"

    var pageMod = require('page-mod').PageMod({
      include: ['*'],
      contentScript: pageModScript,
      onAttach: function(worker) {
        worker.port.on('click', function(html) {
          worker.port.emit('warning', 'Do not click this again');
        });
      }
    });

In the add-on above there are two user-defined events:

* `click` is sent from the page-mod to the add-on, when the user clicks an
element in the page
* `warning` sends a silly string back to the page-mod

### <a name="json_serializable">JSON-Serializable Values</a> ###

The payload for an event can be any JSON-serializable value. When events are
sent their payloads are automatically serialized, and when events are received
their payloads are automatically deserialized, so you don't need to worry
about serialization.

However, you _do_ have to ensure that the payload can be serialized to JSON.
This means that it needs to be a string, number, boolean, null, array of
JSON-serializable values, or an object whose property values are themselves
JSON-serializable. This means you can't send functions, and if the object
contains methods they won't be encoded.

For example, to include an array of strings in the payload:

    var pageModScript = "self.port.emit('loaded'," +
                        "  [" +
                        "  document.location.toString()," +
                        "  document.title" +
                        "  ]" +
                        ");"

    var pageMod = require('page-mod').PageMod({
      include: ['*'],
      contentScript: pageModScript,
      onAttach: function(worker) {
        worker.port.on('loaded', function(pageInfo) {
          console.log(pageInfo[0]);
          console.log(pageInfo[1]);
        });
      }
    });

### Examples ###

#### Reddit Example ####

This example add-on creates a panel containing the mobile version of Reddit.
When the user clicks on the title of a story in the panel, the add-on opens
the linked story in a new tab in the main browser window.

To accomplish this the add-on needs to run a content script in the context of
the Reddit page which intercepts mouse clicks on each title link and fetches the
link's target URL. The content script then needs to send the URL to the add-on
script.

This is the complete add-on script:

    var data = require("self").data;

    var reddit_panel = require("panel").Panel({
      width: 240,
      height: 320,
      contentURL: "http://www.reddit.com/.mobile?keep_extension=True",
      contentScriptFile: [data.url("jquery-1.4.4.min.js"),
                          data.url("panel.js")]
    });

    reddit_panel.port.on("click", function(url) {
      require("tabs").open(url);
    });

    require("widget").Widget({
      id: "open-reddit-btn",
      label: "Reddit",
      contentURL: "http://www.reddit.com/static/favicon.ico",
      panel: reddit_panel
    });

This code supplies two content scripts to the panel's constructor in the
`contentScriptFile` option: the jQuery library and the script that intercepts
link clicks.

Finally, it registers a listener to the user-defined `click` event which in
turn passes the URL into the `open` function of the
[tabs](packages/addon-kit/docs/tabs.html) module.

This is the `panel.js` content script that intercepts link clicks:

    $(window).click(function (event) {
      var t = event.target;

      // Don't intercept the click if it isn't on a link.
      if (t.nodeName != "A")
        return;

      // Don't intercept the click if it was on one of the links in the header
      // or next/previous footer, since those links should load in the panel itself.
      if ($(t).parents('#header').length || $(t).parents('.nextprev').length)
        return;

      // Intercept the click, passing it to the addon, which will load it in a tab.
      event.stopPropagation();
      event.preventDefault();
      self.port.emit('click', t.toString());
    });

This script uses jQuery to interact with the DOM of the page and the
`self.port.emit` function to pass URLs back to the add-on script.

See the `examples/reddit-panel` directory for the complete example (including
the content script containing jQuery).

### Message Events ###

As an alternative to user-defined events content modules support the built-in
`message` event. For most cases user-defined events are preferable to message
events. However, the `context-menu` module does not support user-defined
events, so to send messages from a content script to the add-on via a context
menu object, you must use message events.

#### Handling Message Events in the Content Script ####

To send a message from a content script, you use the `postMessage` function of
the global `self` object:

    self.postMessage(contentScriptMessage);

This takes a single parameter, the message payload, which may be any
<a href = "dev-guide/addon-development/web-content.html#json_serializable">JSON-serializable value</a>.

To receive a message from the add-on script, use `self`'s `on` function:

    self.on("message", function(addonMessage) {
      // Handle the message
    });

Like all event-registration functions, this takes two parameters: the name
of the event, and the handler function. The handler function is passed the
message payload.

#### Handling Message Events in the Add-on Script ####

To send a message to a content script, use the worker's `postMessage`
function. Again, `panel` and `page` integrate `worker` directly:

    // Post a message to the panel's content scripts
    panel.postMessage(addonMessage);

However, for `page-mod` objects you need to listen to the `onAttach` event
and use the worker supplied to that:

    var pageMod = require('page-mod').PageMod({
      include: ['*'],
      contentScript: pageModScript,
      onAttach: function(worker) {
        worker.postMessage(addonMessage);
      }
    });

To receive messages from a content script, use the worker's `on` function.
To simplify this most content modules provide an `onMessage` property as an
argument to the constructor:

    panel = require("panel").Panel({
      onMessage: function(contentScriptMessage) {
        // Handle message from the content script
      }
    });

#### Message Events Versus User-Defined Events ####

You can use message events as an alternative to user-defined events:

    var pageModScript = "window.addEventListener('mouseover', function(event) {" +
                        "  self.postMessage(event.target.toString());" +
                        "}, false);";

    var pageMod = require('page-mod').PageMod({
      include: ['*'],
      contentScript: pageModScript,
      onAttach: function(worker) {
        worker.on('message', function(message) {
          console.log('mouseover: ' + message);
        });
      }
    });

The reason to prefer user-defined events is that as soon as you need to send
more than one type of message, then both sending and receiving messages gets
more complex.

Suppose the content script wants to send `mouseout` events as well as
`mouseover`. Now we have to embed the event type in the message payload, and
implement a switch function in the receiver to dispatch the message:

    var pageModScript = "window.addEventListener('mouseover', function(event) {" +
                        "  self.postMessage({" +
                        "    kind: 'mouseover'," +
                        "    element: event.target.toString()" +
                        "  });" +
                        "}, false);" +
                        "window.addEventListener('mouseout', function(event) {" +
                        "  self.postMessage({" +
                        "    kind: 'mouseout'," +
                        "    element: event.target.toString()" +
                        "  });" +
                        " }, false);"


    var pageMod = require('page-mod').PageMod({
      include: ['*'],
      contentScript: pageModScript,
      onAttach: function(worker) {
        worker.on('message', function(message) {
        switch(message.kind) {
          case 'mouseover':
            console.log('mouseover: ' + message.element);
            break;
          case 'mouseout':
            console.log('mouseout: ' + message.element);
            break;
          }
        });
      }
    });

Implementing the same add-on with user-defined events is shorter and more
readable:

    var pageModScript = "window.addEventListener('mouseover', function(event) {" +
                        "  self.port.emit('mouseover', event.target.toString());" +
                        "}, false);" +
                        "window.addEventListener('mouseout', function(event) {" +
                        "  self.port.emit('mouseout', event.target.toString());" +
                        "}, false);";

    var pageMod = require('page-mod').PageMod({
      include: ['*'],
      contentScript: pageModScript,
      onAttach: function(worker) {
        worker.port.on('mouseover', function(message) {
          console.log('mouseover :' + message);
        });
        worker.port.on('mouseout', function(message) {
          console.log('mouseout :' + message);
        });
      }
    });
