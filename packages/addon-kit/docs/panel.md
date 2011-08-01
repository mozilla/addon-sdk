<!-- contributed by Myk Melez [myk@mozilla.org] -->
<!-- contributed by Irakli Gozalishvili [gozala@mozilla.com] -->

The `panel` module creates floating modal "popup dialogs" that appear on top of
web content and browser chrome and persist until dismissed by users or programs.
Panels are useful for presenting temporary interfaces to users in a way that is
easier for users to ignore and dismiss than a modal dialog, since panels are
hidden the moment users interact with parts of the application interface outside
them.

The module exports a single constructor function `Panel` which constructs a
new panel.

A panel's content is loaded as soon as it is created, before the panel is shown,
and the content remains loaded when a panel is hidden, so it is possible
to keep a panel around in the background, updating its content as appropriate
in preparation for the next time it is shown.

Your add-on can receive notifications when a panel is shown or hidden by
listening to its `show` and `hide` events.

Panels have associated content scripts, which are JavaScript scripts that have
access to the content loaded into the panels.  An add-on can specify one or
more content scripts to load for a panel, and the add-on can communicate with
those scripts either using the `message` event or by using user-defined
events. See
[Working with Content Scripts](dev-guide/addon-development/web-content.html)
for more information.

The panel's default style is different for each operating system.
For example, suppose a panel's content is specified with the following HTML:

<script type="syntaxhighlighter" class="brush: html"><![CDATA[
<h1>Default Style</h1>

This is what a panel with no custom styling looks like.
]]>
</script>

On OS X it will look like this:

<img class="image-center" src="media/screenshots/default-panel-osx.png"
alt="OS X panel default style">
<br>

On Windows 7 it will look like this:

<img class="image-center" src="media/screenshots/default-panel-windows.png"
alt="Windows 7 panel default style">
<br>

On Ubuntu it will look like this:

<img class="image-center" src="media/screenshots/default-panel-ubuntu.png"
alt="Ubuntu panel default style">
<br>

This helps to ensure that the panel's style is consistent with the dialogs
displayed by Firefox and other applications, but means you need to take care
when applying your own styles. For example, if you set the panel's
`background-color` property to `white` and do not set the `color` property,
then the panel's text will be invisible on OS X although it looks fine on Ubuntu.

Examples
--------

Create and show a simple panel with content from the `data/` directory:

    const data = require("self").data;
    var panel = require("panel").Panel({
      contentURL: data.url("foo.html")
    });

    panel.show();

The tutorial section on
[web content](dev-guide/addon-development/web-content.html) has
a more complex example using panels.

<api name="Panel">
@class
The Panel object represents a floating modal dialog that can by an add-on to
present user interface content.

Once a panel object has been created it can be shown and hidden using its
`show()` and `hide()` methods. Once a panel is no longer needed it can be
deactivated using `destroy()`.

The content of a panel is specified using the `contentURL` option. An add-on
can interact with the content of a panel using content scripts which it
supplies in the `contentScript` and/or `contentScriptFile` options. For example,
a content script could create a menu and send the user's selection to the
add-on.

<api name="Panel">
@constructor
Creates a panel.
@param options {object}
  Options for the panel, with the following keys:
  @prop [width] {number}
    The width of the panel in pixels. Optional.
  @prop [height] {number}
    The height of the panel in pixels. Optional.
  @prop [contentURL] {string}
    The URL of the content to load in the panel.
  @prop [allow] {object}
    An optional object describing permissions for the content.  It should
    contain a single key named `script` whose value is a boolean that indicates
    whether or not to execute script in the content.  `script` defaults to true.
  @prop [contentScriptFile] {string,array}
    A local file URL or an array of local file URLs of content scripts to load.
    Content scripts specified by this property are loaded *before* those
    specified by the `contentScript` property.
  @prop [contentScript] {string,array}
    A string or an array of strings containing the texts of content scripts to
    load.  Content scripts specified by this property are loaded *after* those
    specified by the `contentScriptFile` property.
  @prop [contentScriptWhen="end"] {string}
    When to load the content scripts. This may take one of the following
    values:

    * "start": load content scripts immediately after the document
    element for the panel is inserted into the DOM, but before the DOM content
    itself has been loaded
    * "ready": load content scripts once DOM content has been loaded,
    corresponding to the
    [DOMContentLoaded](https://developer.mozilla.org/en/Gecko-Specific_DOM_Events)
    event
    * "end": load content scripts once all the content (DOM, JS, CSS,
    images) for the panel has been loaded, at the time the
    [window.onload event](https://developer.mozilla.org/en/DOM/window.onload)
    fires

    This property is optional and defaults to "end".

  @prop [onMessage] {function}
    Include this to listen to the panel's `message` event.
  @prop [onShow] {function}
    Include this to listen to the panel's `show` event.
  @prop [onHide] {function}
    Include this to listen to the panel's `hide` event.
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

<api name="isShowing">
@property {boolean}
Tells if the panel is currently shown or not. This property is read-only.
</api>

<api name="height">
@property {number}
The height of the panel in pixels.
</api>

<api name="width">
@property {number}
The width of the panel in pixels.
</api>

<api name="contentURL">
@property {string}
The URL of the content loaded in the panel.
</api>

<api name="allow">
@property {object}
An object describing permissions for the content.  It contains a single key
named `script` whose value is a boolean that indicates whether or not to execute
script in the content.
</api>

<api name="contentScriptFile">
@property {string,array}
A local file URL or an array of local file URLs of content scripts to load.
Content scripts specified by this property are loaded *before* those
specified by the `contentScript` property.
</api>

<api name="contentScript">
@property {string,array}
A string or an array of strings containing the texts of content scripts to
load.  Content scripts specified by this property are loaded *after* those
specified by the `contentScriptFile` property.
</api>

<api name="contentScriptWhen">
@property {string}
When to load the content scripts. This may have one of the following
values:

* "start": load content scripts immediately after the document
element for the panel is inserted into the DOM, but before the DOM content
itself has been loaded
* "ready": load content scripts once DOM content has been loaded,
corresponding to the
[DOMContentLoaded](https://developer.mozilla.org/en/Gecko-Specific_DOM_Events)
event
* "end": load content scripts once all the content (DOM, JS, CSS,
images) for the panel has been loaded, at the time the
[window.onload event](https://developer.mozilla.org/en/DOM/window.onload)
fires

</api>

<api name="destroy">
@method
Destroys the panel, unloading any content that was loaded in it. Once
destroyed, the panel can no longer be used. If you just want to hide
the panel and might show it later, use `hide` instead.
</api>

<api name="postMessage">
@method
Sends a message to the content scripts.
@param message {value}
The message to send.  Must be stringifiable to JSON.
</api>

<api name="show">
@method
Displays the panel.
@param [anchor] {handle}
A handle to a DOM node in a page to which the panel should appear to be
anchored.  If not given, the panel is centered inside the most recent browser
window. Note that it is not currently possible to anchor panels in this way
using only the high level APIs.
</api>

<api name="hide">
@method
Stops displaying the panel.
</api>

<api name="resize">
@method
Resizes the panel.
@param width {number}
The new width of the panel in pixels.
@param height {number}
The new height of the panel in pixels.
</api>

<api name="on">
@method
  Registers an event listener with the panel.
@param type {string}
  The type of event to listen for.
@param listener {function}
  The listener function that handles the event.
</api>

<api name="removeListener">
@method
  Unregisters an event listener from the panel.
@param type {string}
  The type of event for which `listener` was registered.
@param listener {function}
  The listener function that was registered.
</api>

<api name="show">
@event
This event is emitted when the panel is shown.
</api>

<api name="hide">
@event
This event is emitted when the panel is hidden.
</api>

<api name="message">
@event
If you listen to this event you can receive message events from content
scripts associated with this panel. When a content script posts a
message using `self.postMessage()`, the message is delivered to the add-on
code in the panel's `message` event.

@argument {value}
Listeners are passed a single argument which is the message posted
from the content script. The message can be any
<a href = "dev-guide/addon-development/web-content.html#json_serializable">JSON-serializable value</a>.
</api>

<api name="error">
@event
This event is emitted when an uncaught runtime error occurs in one of the
panel's content scripts.

@argument {Error}
Listeners are passed a single argument, the
[Error](https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Error)
object.
</api>

</api>
