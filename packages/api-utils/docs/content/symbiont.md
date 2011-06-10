<!-- contributed by Myk Melez [myk@mozilla.org] -->
<!-- contributed by Irakli Gozalishvili [gozala@mozilla.com] -->


This module is not intended to be used directly by programs.  Rather, it is
intended to be used by other modules that provide APIs to programs.


This module exports `Symbiont` trait that can be used for creating JavaScript
contexts that can access web content in host application frames (i.e. XUL
`<iframe>` and `<browser>` elements) and communicate with programs via
asynchronous JSON pipes.  It is useful in the construction of APIs that
are compatible with the execution model codenamed "electrolysis" in which
programs run in separate processes from web content.

Introduction
------------

`Symbiont` constructs a content symbiont for a given frame, it loads the
specified contentURL and scripts into it, and plumbs an asynchronous
JSON pipe between the content symbiont object and the content symbiont
context. If frame is not provided hidden frame will be created.

Examples
--------

    const { Symbiont } = require('content');
    const Thing = Symbiont.resolve({ constructor: '_init' }).compose({
      constructor: function Thing(options) {
        // `getMyFrame` returns the host application frame in which
        // the page is loaded.
        this._frame = getMyFrame();
        this._init(options)
      }
    });

See the [panel][] module for a real-world example of usage of this module.

[panel]:packages/addon-kit/docs/panel.html

Reference
---------

<api name="Symbiont">
@class
Symbiont is composed from the [Worker][] trait, therefore instances
of Symbiont and their descendants expose all the public properties
exposed by [Worker][] along with additional public properties that
are listed below:

[Worker]:packages/api-utils/docs/content/worker.html

<api name="Symbiont">
@constructor
Creates a content symbiont.
@param options {object}
  Options for the constructor. Includes all the keys that
the [Worker](packages/api-utils/docs/content/worker.html)
constructor accepts and a few more:

  @prop [frame] {object}
    The host application frame in which the page is loaded.
    If frame is not provided hidden one will be created.
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

  @prop [allow] {object}
    Permissions for the content, with the following keys:
      @prop [script] {boolean}
      Whether or not to execute script in the content.  Defaults to true.
      Optional.
    Optional.
</api>

<api name="contentScriptFile">
@property {array}
The local file URLs of content scripts to load.  Content scripts specified by
this property are loaded *before* those specified by the `contentScript`
property.
</api>

<api name="contentScript">
@property {array}
The texts of content scripts to load.  Content scripts specified by this
property are loaded *after* those specified by the `contentScriptFile` property.
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

<api name="contentURL">
@property {string}
The URL of the content loaded.
</api>

<api name="allow">
@property {object}
Permissions for the content, with a single boolean key called `script` which
defaults to true and indicates whether or not to execute scripts in the
content.
</api>

</api>


