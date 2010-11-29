<!-- contributed by Dietrich Ayala [dietrich@mozilla.com]  -->
<!-- edited by Noelle Murata [fiveinchpixie@gmail.com]  -->

The `widget` module provides a consistent, unified way for extensions to
expose their user-interface in a way that blends in well with the host
application.

The widgets are displayed in the Firefox 4 Add-on Bar by default.
Users can move them around using the Firefox toolbar customization
palette, available in the View/Toolbars menu.

The widget bar can be shown and hidden via the Control+Shift+U keyboard
shortcut (or Cmd+Shift+U if on Mac).

To communicate between your widget and the content loading in it, every widget
exposes the `Loader` module API. This allows you to run content scripts in
the context of your widget's content. For example, to be notified when the 
widget contents have loaded, you can make a small script that calls back to the
widget when it first loads, or when it's DOM is ready. See the example code
below for various ways of doing this.

## Examples ##

    const widgets = require("widget");

    // A basic click-able image widget.
    widgets.Widget({
      label: "Widget with an image and a click handler",
      contentURL: "http://www.google.com/favicon.ico",
      onClick: function() require("tabs").activeTab.location = "http://www.google.com"
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
      contentScript: "setTimeout(function() { document.body.innerHTML++; }, 2000)",
      contentScriptWhen: "ready"
    });

    // A widget that loads a random Flickr photo every 5 minutes.
    widgets.Widget({
      label: "Random Flickr Photo Widget",
      contentURL: "http://www.flickr.com/explore/",
      contentScriptWhen: "ready",
      contentScript: "postMessage(document.querySelector('.pc_img').src); " +
        "setTimeout(function() { document.location = 'http://www.flickr.com/explore/'; }, 5 * 60 * 1000);",
      onMessage: function(widget, message) {
        widget.contentURL = message;
      },
      onClick: function() require("tabs").activeTab.location = this.contentURL
    });

    // A widget created with a specified width, that grows.
    let myWidget = widgets.Widget({
      label: "Wide widget that grows wider on a timer",
      content: "I'm getting longer.",
      width: 50,
    });
    require("timer").setInterval(function() myWidget.width += 10, 1000);

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
    as `onClick(widget, event)`. `widget` is the `Widget` instance, and `event`
    is the standard DOM event object.

  @prop [onMouseover] {callback}
    An optional function to be called when the user passes the mouse over the
    widget. It is called as `onMouseover(widget, event)`. `widget` is the
    `Widget` instance, and `event` is the standard DOM event object.

  @prop [onMouseout] {callback}
    An optional function to be called when the mouse is no longer over the
    widget. It is called as `onMouseout(widget, event)`. `widget` is the
    `Widget` instance, and `event` is the standard DOM event object.

  @prop [tooltip] {string}
    Optional text to show when the user's mouse hovers over the widget.  If not
    given, the `label` is used.

  @prop [allow] {object}
    Permissions for the content, with the following keys:
    @prop [script] {boolean}
      Whether or not to execute script in the content.  Defaults to true.

  @prop [contentScriptURL] {array}
    The URLs of content scripts to load.  Content scripts specified by this property
    are loaded *before* those specified by the `contentScript` property.

  @prop [contentScript] {array}
    The texts of content scripts to load.  Content scripts specified by this
    property are loaded *after* those specified by the `contentScriptURL` property.

  @prop [contentScriptWhen] {string}
    When to load the content scripts.
    Possible values are "start" (default), which loads them as soon as
    the window object for the page has been created, and "ready", which loads
    them once the DOM content of the page has been loaded.

  @prop [onMessage] {array}
    Functions to call when a content script sends the widget a message.
</api>
<api name="destroy">
@method
  Removes the widget from the widget bar.
</api>
</api>
