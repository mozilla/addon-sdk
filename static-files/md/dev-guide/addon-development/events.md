# Working with Events #

The Add-on SDK supports event-driven programming through its
[`EventEmitter`](packages/api-utils/docs/events.html) framework.

Objects emit events on state changes that might be of interest to add-on code,
such as browser windows opening, pages loading, network requests completing,
and mouse clicks. By registering a listener function to an event emitter an
add-on can receive notifications of these events.

<span class="aside">
We talk about content
scripts in more detail in the
[Working with Content Scripts](dev-guide/addon-development/web-content.html)
guide.</span>
Additionally, if you're using content scripts to interact with web content,
you can define your own events and use them to communicate between the main
add-on code and the content scripts. In this case one end of the conversation
emits the events, and the other end listens to them.

So there are two main ways you will interact with the EventEmitter
framework:

* **listening to built-in events** emitted by objects in the SDK, such as tabs
opening, pages loading, mouse clicks

* **sending and receiving user-defined events** between content scripts and
add-on code

This guide only covers the first of these; the second is explained in the
[Working with Content Scripts](dev-guide/addon-development/web-content.html)
guide.

## Adding Listeners ##

You can add a listener to an event emitter by calling its `on(type, listener)`
method.

It takes two parameters:

* **`type`**: the type of event we are interested in, identified by a string.
Many event emitters may emit more than one type of event: for example, a browser
window might emit both `open` and `close` events. The list of valid event types
is specific to an event emitter and is included with its documentation.

* **`listener`**: the listener itself. This is a function which will be called
whenever the event occurs. The arguments that will be passed to the listener
are specific to an event type and are documented with the event emitter.

For example, the following add-on registers two listeners with the
[`private-browsing`](packages/addon-kit/docs/private-browsing.html) module to
listen for the `start` and `stop` events, and logs a string to the console
reporting the change:

    var pb = require("private-browsing");

    pb.on("start", function() {
      console.log("Private browsing is on");
    });

    pb.on("stop", function() {
      console.log("Private browsing is off");
    });

It is not possible to enumerate the set of listeners for a given event.

The value of `this` in the listener function is the object that emitted
the event.

### Adding Listeners in Constructors ###

Event emitters may be modules, as is the case for the
`private-browsing` events, or they may be objects returned by
constructors.

In the latter case the `options` object passed to the constructor typically
defines properties whose names are the names of supported event types prefixed
with "on": for example, "onOpen", "onReady" and so on. Then in the constructor
you can assign a listener function to this property as an alternative to
calling the object's `on()` method.

For example: the [`widget`](packages/addon-kit/docs/widget.html) object emits
an event when the widget is clicked.

The following add-on creates a widget and assigns a listener to the
`onClick` property of the `options` object supplied to the widget's
constructor. The listener loads the Google home page:

    var widgets = require("widget");
    var tabs = require("tabs");

    widgets.Widget({
      id: "google-link",
      label: "Widget with an image and a click handler",
      contentURL: "http://www.google.com/favicon.ico",
      onClick: function() {
        tabs.open("http://www.google.com/");
      }
    });

This is exactly equivalent to constructing the widget and then calling the
widget's `on()` method:

    var widgets = require("widget");
    var tabs = require("tabs");

    var widget = widgets.Widget({
      id: "google-link-alternative",
      label: "Widget with an image and a click handler",
      contentURL: "http://www.google.com/favicon.ico"
    });

    widget.on("click", function() {
      tabs.open("http://www.google.com/");
    });

## Removing Event Listeners ##

Event listeners can be removed by calling `removeListener(type, listener)`,
supplying the type of event and the listener to remove.

The listener must have been previously been added using one of the methods
described above.

In the following add-on, we add two listeners to private-browsing's `start`
event, enter and exit private browsing, then remove the first listener and
enter private browsing again.

    var pb = require("private-browsing");

    function listener1() {
      console.log("Listener 1");
      pb.removeListener("start", listener1);
    }

    function listener2() {
      console.log("Listener 2");
    }

    pb.on("start", listener1);
    pb.on("start", listener2);

    pb.activate();
    pb.deactivate();
    pb.activate();

Removing listeners is optional since they will be removed in any case
when the application or add-on is unloaded.

