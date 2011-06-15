<!-- contributed by Felipe Gomes [felipc@gmail.com] -->

The `page-worker` module provides a way to create a permanent, invisible page
and access its DOM.

Introduction
------------

The module exports a constructor function `Page`, which constructs a new page
worker.  A page worker may be destroyed, after which its memory is freed, and
you must create a new instance to load another page.

Page workers have associated content scripts, which are JavaScript scripts that
have access to the content loaded into the pages.  You can specify scripts to
load for a page worker, and you communicate with those scripts over an
asynchronous JSON pipe.  For more information on content scripts, see
[Working with Content Scripts](dev-guide/addon-development/web-content.html).

Examples
--------

For conciseness, these examples create their content scripts as strings and use
the `contentScript` property.  In your own add-ons, you will probably want to
create your content scripts in separate files and pass their URLs using the
`contentScriptFile` property.  See
[Working with Content Scripts](dev-guide/addon-development/web-content.html)
for more information.

### Print all header titles from a Wikipedia article ###

    var pageWorkers = require("page-worker");

    // This content script sends header titles from the page to the add-on:
    var script = "var elements = document.querySelectorAll('h2 > span'); " +
                 "for (var i = 0; i < elements.length; i++) { " +
                 "  postMessage(elements[i].textContent) " +
                 "}";

    // Create a page worker that loads Wikipedia:
    pageWorkers.Page({
      contentURL: "http://en.wikipedia.org/wiki/Internet",
      contentScript: script,
      contentScriptWhen: "ready",
      onMessage: function(message) {
        console.log(message);
      }
    });

The page worker's "message" event listener, specified by `onMessage`, will print
all the titles it receives from the content script.

<api name="Page">
@class
A `Page` object loads the page specified by its `contentURL` option and
executes any content scripts that have been supplied to it in the
`contentScript` and `contentScriptFile` options.

The page is not displayed to the user.

The page worker is loaded as soon as the `Page` object is created and stays
loaded until its `destroy` method is called or the add-on is unloaded.

<api name="Page">
@constructor
  Creates an uninitialized page worker instance.
@param [options] {object}
  The *`options`* parameter is optional, and if given it should be an object
  with any of the following keys:
  @prop [contentURL] {string}
    The URL of the content to load in the panel.
  @prop [allow] {object}
    An object with keys to configure the permissions on the page worker. The
    boolean key `script` controls if scripts from the page are allowed to run.
    `script` defaults to true.
  @prop [contentScriptFile] {string,array}
    A local file URL or an array of local file URLs of content scripts to load.
    Content scripts specified by this option are loaded *before* those specified
    by the `contentScript` option.  See
    [Working with Content Scripts](dev-guide/addon-development/web-content.html)
    for help on setting this property.
  @prop [contentScript] {string,array}
    A string or an array of strings containing the texts of content scripts to
    load.  Content scripts specified by this option are loaded *after* those
    specified by the `contentScriptFile` option.
  @prop [contentScriptWhen="end"] {string}
    When to load the content scripts. This may take one of the following
    values:

    * "start": load content scripts immediately after the document
    element for the page is inserted into the DOM, but before the DOM content
    itself has been loaded
    * "ready": load content scripts once DOM content has been loaded,
    corresponding to the
    [DOMContentLoaded](https://developer.mozilla.org/en/Gecko-Specific_DOM_Events)
    event
    * "end": load content scripts once all the content (DOM, JS, CSS,
    images) for the page has been loaded, at the time the
    [window.onload event](https://developer.mozilla.org/en/DOM/window.onload)
    fires

    This property is optional and defaults to "end".

  @prop [onMessage] {function}
    Use this to add a listener to the page worker's `message` event.
</api>

<api name="port">
@property {EventEmitter}
[EventEmitter](packages/api-utils/docs/events.html) object that allows you to:

* send events to the content script using the `port.emit` function
* receive events from the content script using the `port.on` function

See
<a href="dev-guide/addon-development/web-content.html#content_script_events">
Communicating with Content Scripts</a> for details.
</api>

<api name="contentURL">
@property {string}
The URL of the content loaded.
</api>

<api name="allow">
@property {object}
  A object describing permissions for the content.  It contains a single key
  named `script` whose value is a boolean that indicates whether or not to
  execute script in the content.  `script` defaults to true.
</api>

<api name="contentScriptFile">
@property {string,array}
A local file URL or an array of local file URLs of content scripts to load.
</api>

<api name="contentScript">
@property {string,array}
A string or an array of strings containing the texts of content scripts to
load.
</api>

<api name="contentScriptWhen">
@property {string}
  When to load the content scripts. This may have one of the following
  values:

  * "start": load content scripts immediately after the document
  element for the page is inserted into the DOM, but before the DOM content
  itself has been loaded
  * "ready": load content scripts once DOM content has been loaded,
  corresponding to the
  [DOMContentLoaded](https://developer.mozilla.org/en/Gecko-Specific_DOM_Events)
  event
  * "end": load content scripts once all the content (DOM, JS, CSS,
  images) for the page has been loaded, at the time the
  [window.onload event](https://developer.mozilla.org/en/DOM/window.onload)
  fires

</api>

<api name="destroy">
@method
Unloads the page worker. After you destroy a page worker, its memory is freed
and you must create a new instance if you need to load another page.
</api>

<api name="postMessage">
@method
Sends a message to the content scripts.
@param message {value}
The message to send.  Must be JSON-able.
</api>

<api name="on">
@method
Registers an event listener with the page worker.  See
[Working with Events](dev-guide/addon-development/events.html) for help with
events.
@param type {string}
The type of event to listen for.
@param listener {function}
The listener function that handles the event.
</api>

<api name="removeListener">
@method
Unregisters an event listener from the page worker.
@param type {string}
The type of event for which `listener` was registered.
@param listener {function}
The listener function that was registered.
</api>

<api name="message">
@event
If you listen to this event you can receive message events from content
scripts associated with this page worker. When a content script posts a
message using `self.postMessage()`, the message is delivered to the add-on
code in the page worker's `message` event.

@argument {value}
Listeners are passed a single argument which is the message posted
from the content script. The message can be any
<a href = "dev-guide/addon-development/web-content.html#json_serializable">JSON-serializable value</a>.
</api>

<api name="error">
@event
This event is emitted when an uncaught runtime error occurs in one of the
page worker's content scripts.

@argument {Error}
Listeners are passed a single argument, the
[Error](https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Error)
object.
</api>

</api>
