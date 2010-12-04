<!-- contributed by Dietrich Ayala [dietrich@mozilla.com]  -->
<!-- contributed by Drew Willcoxon [adw@mozilla.com]  -->
<!-- edited by Noelle Murata [fiveinchpixie@gmail.com]  -->

The `widget` module lets your add-on provide a simple user interface that is
consistent with other add-ons and blends in well with Firefox.

## Introduction ##

"Widgets" are small pieces of content that live in the Firefox 4 [add-on bar].
They can be simple icons or complex web pages.  You can attach [panels] to them
that open when they're clicked, or you can define a custom click handler to
perform some other action, like opening a web page in a tab.

There are a few advantages to using widgets over an ad hoc user interface.
First, your users will be accustomed to interacting with add-ons via widgets and
the add-on bar.  Second, it allows Firefox to treat your interface as a
first-class citizen.  For example, in the future Firefox may allow the user to
drag widgets from the add-on bar to other toolbars.  By exposing your interface
as a widget, your add-on would automatically inherit such functionality.

[add-on bar]: https://developer.mozilla.org/en/The_add-on_bar
[panels]: #module/addon-kit/panel

## Creation and Content ##

Widgets can contain images or arbitrary web content.  You can include this
content inline as a string by using the `content` property, or point to content
using a URL with the `contentURL` property.

For example, this widget contains an image, so it looks like a simple icon:

    require("widget").Widget({
      label: "My Mozilla Widget",
      contentURL: "http://www.mozilla.org/favicon.ico"
    });

Upon creation, the widget is automatically added to the add-on bar.

This widget contains an entire web page:

    require("widget").Widget({
      label: "My Hello Widget",
      content: "Hello!",
      width: 50
    });

Widgets are quite small by default, so this example used the `width` property to
grow it in order to show all the text.

As with many SDK APIs, communication with the content inside your widgets is
handled by [content scripts].  So, for example, to be notified when your
widget's content has loaded, you can make a small script that calls back to the
widget when it finishes loading.

[content scripts]: #guide/web-content

## Examples ##

For conciseness, these examples create their content scripts as strings and use
the `contentScript` property.  In your own add-ons, you will probably want to
create your content scripts in separate files and pass their URLs using the
`contentScriptFile` property.  See
[Working with Content Scripts](#guide/web-content) for more information.

    const widgets = require("widget");

    // A basic click-able image widget.
    widgets.Widget({
      label: "Widget with an image and a click handler",
      contentURL: "http://www.google.com/favicon.ico",
      onClick: function() {
        require("tabs").activeTab.url = "http://www.google.com/";
      }
    });

    // A widget that changes display on mouseover.
    widgets.Widget({
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
      label: "Widget that updates content on a timer",
      content: "0",
      contentScript: 'setTimeout(function() {' +
                     '  document.body.innerHTML++;' +
                     '}, 2000)',
      contentScriptWhen: "ready"
    });

    // A widget that loads a random Flickr photo every 5 minutes.
    widgets.Widget({
      label: "Random Flickr Photo Widget",
      contentURL: "http://www.flickr.com/explore/",
      contentScriptWhen: "ready",
      contentScript: 'postMessage(document.querySelector(".pc_img").src);' +
                     'setTimeout(function() {' +
                     '  document.location = "http://www.flickr.com/explore/";' +
                     '}, 5 * 60 * 1000);',
      onMessage: function(widget, message) {
        widget.contentURL = message;
      },
      onClick: function() {
        require("tabs").activeTab.url = this.contentURL;
      }
    });

    // A widget created with a specified width, that grows.
    let myWidget = widgets.Widget({
      label: "Wide widget that grows wider on a timer",
      content: "I'm getting longer.",
      width: 50,
    });
    require("timer").setInterval(function() {
      myWidget.width += 10;
    }, 1000);

<api-name="Widget">
@class
Represents a widget object.
<api name="Widget">
@constructor {options}
  Creates a new widget.  The widget is immediately added to the widget bar.

@param options {object}
  An object with the following keys:

  @prop [label] {string}
    A required string description of the widget used for accessibility,
    title bars, and error reporting.

  @prop [content] {string}
    An optional string value containing the displayed content of the widget.
    It may contain raw HTML content. Widgets must have either the `content` property or the
    `contentURL` property set.

  @prop [contentURL] {URL}
    An optional string URL to content to load into the widget. This can be
    local content via the `self` module, or remote content, and can be an image
    or web content. Widgets must have either the `content` property or the
    `contentURL` property set.

  @prop [panel] {panel}
    An optional `Panel` to open when the user clicks on the widget.  See the
    [`panel`](#module/addon-kit/panel) module for more information about the
    `Panel` objects to which this option can be set and the `reddit-panel`
    example add-on for an example of using this option.  Note: If you also
    specify an `onClick` callback function, it will be called instead of the
    panel being opened.  However, you can then show the panel from the `onClick`
    callback function by calling `panel.show()`.

  @prop [width] {integer}
    Optional width in pixels of the widget. This property can be updated after
    the widget has been created, to resize it. If not given, a default width is
    used.

  @prop [onClick] {callback}
    An optional function to be called when the widget is clicked. It is called
    as `onClick(widget)`, where `widget` is the `Widget` instance.

  @prop [onMessage] {callback}
    An optional function to be called when the widget's content scripts post
    a message. It is called as `onMessage(widget, message)`, where `widget` is
    the `Widget` instance and `message` is the JSON-able data posted by the
    content script.

  @prop [onMouseover] {callback}
    An optional function to be called when the user passes the mouse over the
    widget. It is called as `onMouseover(widget)`, where `widget` is the
    `Widget` instance.

  @prop [onMouseout] {callback}
    An optional function to be called when the mouse is no longer over the
    widget. It is called as `onMouseout(widget)`, where `widget` is the
    `Widget` instance.

  @prop [tooltip] {string}
    Optional text to show when the user's mouse hovers over the widget.  If not
    given, the `label` is used.

  @prop [allow] {object}
    Permissions for the content, with the following keys:
    @prop [script] {boolean}
      Whether or not to execute script in the content.  Defaults to true.

  @prop [contentScriptFile] {array}
    The local file URLs of content scripts to load.  Content scripts specified
    by this property are loaded *before* those specified by the `contentScript`
    property.

  @prop [contentScript] {array}
    The texts of content scripts to load.  Content scripts specified by this
    property are loaded *after* those specified by the `contentScriptFile`
    property.

  @prop [contentScriptWhen] {string}
    When to load the content scripts.
    Possible values are "start" (default), which loads them as soon as
    the window object for the page has been created, and "ready", which loads
    them once the DOM content of the page has been loaded.
</api>
<api name="destroy">
@method
  Removes the widget from the widget bar.
</api>
</api>
