<!-- contributed by Dietrich Ayala [dietrich@mozilla.com]  -->
<!-- contributed by Drew Willcoxon [adw@mozilla.com]  -->
<!-- edited by Noelle Murata [fiveinchpixie@gmail.com]  -->

The `widget` module provides your add-on with a simple user interface that is
consistent with other add-ons and blends in well with Firefox.

## Introduction ##

"Widgets" are small pieces of content that live in the Firefox 4
[add-on bar](https://developer.mozilla.org/en/The_add-on_bar).
They can be simple icons or complex web pages.  You can attach
[panels](packages/addon-kit/docs/panel.html) to them that open when they're
clicked, or you can define a custom click handler to perform some other action,
like opening a web page in a tab.

There are a few advantages to using widgets over an ad hoc user interface.
First, your users will be accustomed to interacting with add-ons via widgets and
the add-on bar.  Second, it allows Firefox to treat your interface as a
first-class citizen.  For example, in the future Firefox may allow the user to
drag widgets from the add-on bar to other toolbars.  By exposing your interface
as a widget, your add-on would automatically inherit such functionality.

## Creation and Content ##

Widgets can contain images or arbitrary web content.  You can include this
content inline as a string by using the `content` property, or point to content
using a URL with the `contentURL` property.

For example, this widget contains an image, so it looks like a simple icon:

    require("widget").Widget({
      id: "mozilla-icon", 
      label: "My Mozilla Widget",
      contentURL: "http://www.mozilla.org/favicon.ico"
    });

Upon creation, the widget is automatically added to the add-on bar.

This widget contains an entire web page:

    require("widget").Widget({
      id: "hello-display",
      label: "My Hello Widget",
      content: "Hello!",
      width: 50
    });

Widgets are quite small by default, so this example used the `width` property to
grow it in order to show all the text.

As with many SDK APIs, communication with the content inside your widgets is
handled by [content scripts](dev-guide/addon-development/web-content.html).
So, for example, to be notified when your widget's content has loaded, you can
make a small script that calls back to the widget when it finishes loading.

## Events ##

Widgets emit the following types of [events](dev-guide/addon-development/events.html).

### click ###

This event is emitted when the widget is clicked.

### message ###

This event is emitted when the widget's content scripts post a message.
Listeners are passed the message as their first argument.

### mouseover ###

This event is emitted when the user moves the mouse over the widget.

### mouseout ###

This event is emitted when the user moves the mouse away from the widget.

## Examples ##

For conciseness, these examples create their content scripts as strings and use
the `contentScript` property.  In your own add-ons, you will probably want to
create your content scripts in separate files and pass their URLs using the
`contentScriptFile` property.  See
[Working with Content Scripts](dev-guide/addon-development/web-content.html) for more
information.

    const widgets = require("widget");

    // A basic click-able image widget.
    widgets.Widget({
      id: "google-link",
      label: "Widget with an image and a click handler",
      contentURL: "http://www.google.com/favicon.ico",
      onClick: function() {
        require("tabs").activeTab.url = "http://www.google.com/";
      }
    });

    // A widget that changes display on mouseover.
    widgets.Widget({
      id: "mouseover-effect",
      label: "Widget with changing image on mouseover",
      contentURL: "http://www.yahoo.com/favicon.ico",
      onMouseover: function() {
        this.contentURL = "http://www.bing.com/favicon.ico";
      },
      onMouseout: function() {
        this.contentURL = "http://www.yahoo.com/favicon.ico";
      }
    });

    // A widget that updates content on a timer.
    widgets.Widget({
      id: "auto-update-widget",
      label: "Widget that updates content on a timer",
      content: "0",
      contentScript: 'setTimeout(function() {' +
                     '  document.body.innerHTML++;' +
                     '}, 2000)',
      contentScriptWhen: "ready"
    });

    // A widget that loads a random Flickr photo every 5 minutes.
    widgets.Widget({
      id: "random-flickr",
      label: "Random Flickr Photo Widget",
      contentURL: "http://www.flickr.com/explore/",
      contentScriptWhen: "ready",
      contentScript: 'postMessage(document.querySelector(".pc_img").src);' +
                     'setTimeout(function() {' +
                     '  document.location = "http://www.flickr.com/explore/";' +
                     '}, 5 * 60 * 1000);',
      onMessage: function(imgSrc) {
        this.contentURL = imgSrc;
      },
      onClick: function() {
        require("tabs").activeTab.url = this.contentURL;
      }
    });

    // A widget created with a specified width, that grows.
    let myWidget = widgets.Widget({
      id: "widget-effect",
      label: "Wide widget that grows wider on a timer",
      content: "I'm getting longer.",
      width: 50,
    });
    require("timer").setInterval(function() {
      myWidget.width += 10;
    }, 1000);

    // A widget communicating bi-directionally with a content script.
    let widget = widgets.Widget({
      id: "message-test",
      label: "Bi-directional communication!",
      content: "<foo>bar</foo>",
      contentScriptWhen: "ready",
      contentScript: 'on("message", function(message) {' +
                     '  alert("Got message: " + message);' +
                     '});' +
                     'postMessage("ready");',
      onMessage: function(message) {
        if (message == "ready")
          widget.postMessage("me too");
      }
    });

<api-name="Widget">
@class
Represents a widget object.

<api name="Widget">
@constructor {options}
  Creates a new widget.  The widget is immediately added to the add-on bar.

@param options {object}
  An object with the following keys:

  @prop label {string}
    A required string description of the widget used for accessibility,
    title bars, and error reporting.

  @prop id {string}
    Mandatory string used to identify your widget in order to save it's 
    location when user customizes it in the browser. 
    This string has to be unique and must not be changed in time.
  
  @prop [content] {string}
    An optional string value containing the displayed content of the widget.
    It may contain HTML. Widgets must have either the `content` property or the
    `contentURL` property set.

  @prop [contentURL] {string}
    An optional string URL to content to load into the widget. This can be
    [local content](dev-guide/addon-development/web-content.html) or remote
    content, an image or web content. Widgets must have either the `content`
    property or the `contentURL` property set.

  @prop [panel] {Panel}
    An optional [panel](packages/addon-kit/docs/panel.html) to open when the
    user clicks on the widget. Note: If you also register a "click" listener,
    it will be called instead of the panel being opened.  However, you can show
    the panel from the listener by calling `this.panel.show()`.

  @prop [width] {integer}
    Optional width in pixels of the widget. If not given, a default width is
    used.

  @prop [onClick] {function}
    An optional "click" event listener.  See Events above.

  @prop [onMessage] {function}
    An optional "message" event listener.  See Events above.

  @prop [onMouseover] {function}
    An optional "mouseover" event listener.  See Events above.

  @prop [onMouseout] {function}
    An optional "mouseout" event listener.  See Events above.

  @prop [tooltip] {string}
    Optional text to show when the user's mouse hovers over the widget.  If not
    given, the `label` is used.

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

  @prop [contentScriptWhen] {string}
    When to load the content scripts.
    Possible values are "start" (default), which loads them as soon as
    the window object for the page has been created, and "ready", which loads
    them once the DOM content of the page has been loaded.
</api>

<api name="destroy">
@method
  Removes the widget from the add-on bar.
</api>

<api name="postMessage">
@method
  Sends a message to the widget's content scripts.
@param data {value}
  The message to send.  Must be JSON-able.
</api>

<api name="on">
@method
  Registers an event listener with the widget.
@param type {string}
  The type of event to listen for.
@param listener {function}
  The listener function that handles the event.
</api>

<api name="removeListener">
@method
  Unregisters an event listener from the widget.
@param type {string}
  The type of event for which `listener` was registered.
@param listener {function}
  The listener function that was registered.
</api>

<api name="label">
@property {string}
  The widget's label.  Read-only.
</api>

<api name="content">
@property {string}
  A string containing the widget's content.  It can contain HTML.  Setting it
  updates the widget's appearance immediately.  However, if the widget was
  created using `contentURL`, then this property is meaningless, and setting it
  has no effect.
</api>

<api name="contentURL">
@property {string}
  The URL of content to load into the widget.  This can be
  [local content](dev-guide/addon-development/web-content.html) or remote
  content, an image or web content.  Setting it updates the widget's appearance
  immediately.  However, if the widget was created using `content`, then this
  property is meaningless, and setting it has no effect.
</api>

<api name="panel">
@property {Panel}
  A [panel](packages/addon-kit/docs/panel.html) to open when the user clicks on
  the widget.
</api>

<api name="width">
@property {number}
  The widget's width in pixels.  Setting it updates the widget's appearance
  immediately.
</api>

<api name="tooltip">
@property {string}
  The text of the tooltip that appears when the user hovers over the widget.
</api>

<api name="allow">
@property {object}
  A object describing permissions for the content.  It contains a single key
  named `script` whose value is a boolean that indicates whether or not to
  execute script in the content.
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
  A string indicating when to load the content scripts.  Possible values are
  "start" (default), which loads them as soon as the window object for the page
  has been created, and "ready", which loads them once the DOM content of the
  page has been loaded.
</api>

</api>
