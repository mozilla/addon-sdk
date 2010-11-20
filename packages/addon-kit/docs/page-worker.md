<!-- contributed by Felipe Gomes [felipc@gmail.com] -->

The `page-worker` module provides a way to create a permanent, invisible page
and access its DOM.

Introduction
------------

The module exports a constructor function `Page`, which constructs a new page.
A page may be destroyed, after which its memory is freed, and you must create a
new instance to load another page.

Pages have associated content scripts, which are JavaScript scripts that have
access to the content loaded into the pages.  A program can specify scripts
to load for a page worker, and the program can communicate with those scripts
over an asynchronous JSON pipe.

Events
------
Content workers may emit the following types of events:

####"message"####
Event allows the page worker to receive messages from the content scripts.
Calling `postMessage` function from the one of the content scripts will
asynchronously emit 'message' event on the worker.

####"error"####
Event allows the page worker to react on an uncaught runtime script error
that occurs in one of the content scripts.

Examples
--------

### Print all header titles from a Wikipedia article ###

First, don't forget to import the module:

    var pageWorkers = require("page-worker");

Then make a script that will send the titles from the content script
to the program:

    var script = "var elements = document.querySelectorAll('h2 > span'); " +
                 "for (var i = 0; i < elements.length; i++) { " +
                 "  postMessage(elements[i].textContent) " +
                 "}";

Finally, create a page pointed to Wikipedia:

    pageWorkers.Page({
      contentURL: "http://en.wikipedia.org/wiki/Internet",
      contentScript: script,
      contentScriptWhen: "ready",
      onMessage: function(message) {
        console.log(message);
      }
    });

The page's `onMessage` callback function will print all the titles it receives
from the content script.

<api name="Page">
@class
The `Page` object loads the page specified by the `contentURL` option and
executes any content scripts that have been supplied to it in the
`contentScript` and/or `contentScriptURL` options.

The page is not displayed to the user.

The page is loaded as soon as the page object is created and stays loaded until
its `destroy` method is called or the add-on is unloaded.
<api name="Page">
@constructor
  Creates an uninitialized Page Worker instance.
@param [options] {object}
  The *`options`* parameter is optional, and if given it should be an object
  with any of the following keys:
  @prop [contentURL] {URL,string}
    The URL of the content to load in the panel.
  @prop [allow] {object}
    An object with keys to configure the permissions of the Page Worker.
    The boolean key `script` controls if scripts from the page
    are allowed to run. Its default value is false.
  @prop [contentScriptURL] {string,array}
    The URLs of content scripts to load.  Content scripts specified by this
    option are loaded *before* those specified by the `contentScript` option.
  @prop [contentScript] {string,array}
    The texts of content scripts to load.  Content scripts specified by this
    option are loaded *after* those specified by the `contentScriptURL` option.
  @prop [contentScriptWhen] {string}
    When to load the content scripts.
    Possible values are "start" (default), which loads them as soon as
    the window object for the page has been created, and "ready", which loads
    them once the DOM content of the page has been loaded.
  @prop [onMessage] {function,array}
    Functions to call when a content script sends the program a message.
</api>

<api name="contentURL">
@property {URL}
The URL of the content loaded.
</api>

<api name="allow">
@property {object}
  An object with keys to configure the permissions on the Page Worker.
  The boolean key `script` controls if scripts from the page
  are allowed to run.
</api>

<api name="contentScriptURL">
@property {array}
The URLs of content scripts to load.  Content scripts specified by this property
are loaded *before* those specified by the `contentScript` property.
</api>

<api name="contentScript">
@property {array}
The texts of content scripts to load.  Content scripts specified by this
property are loaded *after* those specified by the `contentScriptURL` property.
</api>

<api name="contentScriptWhen">
@property {string}
When to load the content scripts.
Possible values are "start" (default), which loads them as soon as
the window object for the page has been created, and "ready", which loads
them once the DOM content of the page has been loaded.
</api>

<api name="destroy">
@method
Unloads the Page Worker. After you destroy a Page Worker, its memory is freed
and you must create a new instance if you need to load another page.
</api>

<api name="postMessage">
@method
Send a message to the content scripts.
@param message {string,number,object,array,boolean}
The message to send.  Must be stringifiable to JSON.
</api>

<api name="on">
@method
Registers an event `listener` that will be called when events of
specified `type` are emitted.

If the `listener` is already registered for this `type`, a call to this
method has no effect.

If the event listener is being registered while an event is being processed,
the event listener is not called during the current emit.

@param type {String}
  The type of event.

@param listener {Function}
  The listener function that processes the event.
</api>

Example:

    var page = require("page-worker").PageWorker({
      contentURL: 'http://mozilla.org'
    });
    page.on('message', function onMessage(message) {
      console.log(message);
    })

<api name="removeListener">
@method
Unregisters an event `listener` for the specified event `type`.

If the `listener` is not registered for this `type`, a call to this
method has no effect.

If an event listener is removed while an event is being processed, it is
still triggered by the current emit. After it is removed, the event listener
is never invoked again (unless registered again for future processing).

@param type {String}
  The type of event.
@param listener {Function}
  The listener function that processes the event.
</api>
</api>
