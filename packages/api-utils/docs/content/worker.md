<!-- contributed by Irakli Gozalishvili [gozala@mozilla.com] -->

This module exports the `Worker` trait, which may be used to construct objects
implementing the [Worker][] interface defined by the W3C, with minor
differences.

Content workers are message-passing facilities for communication between
[content scripts](dev-guide/addon-development/web-content.html) and the main
add-on code.

It is important to note that unlike "web workers," these workers run in the
same process as web content and browser chrome, so code within workers can
block the UI.

[Worker]:http://www.w3.org/TR/workers/#worker

<api name="Worker">
@class
Worker is composed from the [EventEmitter][] trait, therefore instances
of Worker and their descendants expose all the public properties
exposed by [EventEmitter][] along with additional public properties that
are listed below.

**Example**

    const workers = require("content/worker");
    let worker =  workers.Worker({
      window: require("window-utils").activeWindow,
      contentScript:
        "self.port.on('hello', function(name) { " +
        "  self.port.emit('response', window.location); " +
        "});"
    });
    worker.port.emit("hello", { name: "worker"});
    worker.port.on("response", function (location) {
      console.log(location);
    });

[EventEmitter]:packages/api-utils/docs/events.html

<api name="Worker">
@constructor
Creates a content worker.
@param options {object}
Options for the constructor, with the following keys:
  @prop window {object}
    The content window to create JavaScript sandbox for communication with.
  @prop [contentScriptFile] {string,array}
    The local file URLs of content scripts to load.  Content scripts specified
    by this option are loaded *before* those specified by the `contentScript`
    option. Optional.
  @prop [contentScript] {string,array}
    The texts of content scripts to load.  Content scripts specified by this
    option are loaded *after* those specified by the `contentScriptFile` option.
    Optional.
  @prop [onMessage] {function}
    Functions that will registered as a listener to a 'message' events.
  @prop [onError] {function}
    Functions that will registered as a listener to an 'error' events.
</api>

<api name="port">
@property {EventEmitter}
[EventEmitter](packages/api-utils/docs/events.html) object that allows you to:

* send customized messages to the worker using the `port.emit` function
* receive events from the worker using the `port.on` function

</api>

<api name="postMessage">
@method
Asynchronously emits `"message"` events in the enclosed worker, where content
script was loaded.
@param data {number,string,JSON}
The data to send. Must be stringifiable to JSON.
</api>

<api name="destroy">
@method
Destroy the worker by removing the content script from the page and removing
all registered listeners. A `detach` event is fired just before removal.
</api>

<api name="url">
@property {string}
The URL of the content.
</api>

<api name="tab">
@property {object}
If this worker is attached to a content document, returns the related 
[tab](packages/addon-kit/docs/tabs.html).
</api>

<api name="message">
@event
This event allows the content worker to receive messages from its associated
content scripts. Calling the `self.postMessage()` function from a content
script will asynchronously emit the `message` event on the corresponding
worker.

@argument {value}
The event listener is passed the message, which must be
<a href = "dev-guide/addon-development/web-content.html#json_serializable">serializable to JSON</a>.
</api>

<api name="error">
@event
This event allows the content worker to react to an uncaught runtime script
error that occurs in one of the content scripts.

@argument {Error}
The event listener is passed a single argument which is an
[Error](https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Error)
object.
</api>

<api name="detach">
@event
This event is emitted when the document associated with this worker is unloaded
or the worker's `destroy()` method is called.
</api>

</api>

