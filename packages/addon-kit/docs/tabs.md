<!-- contributed by Dietrich Ayala [dietrich@mozilla.com]  -->
<!-- edited by Noelle Murata [fiveinchpixie@gmail.com]  -->


The `tabs` module provides easy access to tabs and tab-related events.

Events
------

Events represent common actions and state changes for tabs and their content.
Event listeners are passed the `Tab` object that triggered the event.

For example:

    var tabs = require("tabs");

    // Listen for tab openings.
    tabs.on('open', function onOpen(tab) {
      myOpenTabs.push(tab);
    });

    // Listen for tab content loads.
    tabs.on('ready', function(tab) {
      console.log('tab is loaded', tab.title, tab.url)
    });

All `Tab` objects and the `tabs` module itself emit the following events:

### open ###
Event emitted when a new tab is open.
This does not mean that the content has loaded, only that the browser tab
itself is fully visible to the user.

Tab content related properties (title, thumbnail, favicon, url) will not
be correct at this point. Use `ready` event listener to be notified when the
page has loaded.

### close ###
Event emitted when a tab is closed. In addition, when a window is closed,
this event will be emitted for each of the open tabs in that window.

### ready ###
Event emitted when a tab's content's DOM is ready.

This is equivalent to the `DOMContentLoaded` event for the given content page.
This event will be emitted multiple times for the same tab, if different content
is loaded into it.

At this point all the tab content related properties can be used.

### activate ###
Event emitted when an inactive tab is made active.

### deactivate ###
Event emitted when the active tab is made inactive.

Tab Enumeration
---------------

All tabs across all windows can be enumerated by using the `tabs` module itself
like so:

    var tabs = require("tabs");
    for each (var tab in tabs)
      console.log(tab.title);

<api name="activeTab">
@property {Tab}

The currently active tab in the active window. This property is read-only. To
activate a `Tab` object, call its `activate` method.

**Example**

    // Get the active tab's title.
    var tabs = require("tabs");
    console.log("title of active tab is " + tabs.activeTab.title);
</api>

<api name="length">
@property {number}
The number of open tabs across all windows.
</api>

<api name="open">
@function
Opens a new tab. The new tab will open in the active window or in a new window,
depending on the `inNewWindow` option.

**Example**

    var tabs = require("tabs");

    // Open a new tab on active window and make tab active.
    tabs.open("http://www.mysite.com");

    // Open a new tab in a new window and make it active.
    tabs.open({
      url: "http://www.mysite.com",
      inNewWindow: true
    });

    // Open a new tab on active window in the background.
    tabs.open({
      url: "http://www.mysite.com",
      inBackground: true
    });

    // Open a new tab as an app tab and do something once it's open.
    tabs.open({
      url: "http://www.mysite.com",
      isPinned: true,
      onOpen: function onOpen(tab) {
        // do stuff like listen for content
        // loading.
      }
    });

@param options {object}
An object containing configurable options for how and where the tab will be
opened, as well as a listeners for the tab events.

If the only option being used is `url`, then a bare string URL can be passed to
`open` instead of adding at a property of the `options` object.

@prop [url] {string}
String URL to be opened in the new tab.
This is a required property.

@prop [inNewWindow] {boolean}
If present and true, a new browser window will be opened and the URL will be
opened in the first tab in that window. This is an optional property.

@prop [inBackground] {boolean}
If present and true, the new tab will be opened to the right of the active tab
and will not be active. This is an optional property.

@prop [isPinned] {boolean}
If present and true, then the new tab will be pinned as an
[app tab](http://support.mozilla.com/en-US/kb/what-are-app-tabs).

@prop [onOpen] {function}
A callback function that will be registered for 'open' event.
This is an optional property.
@prop [onClose] {function}
A callback function that will be registered for 'close' event.
This is an optional property.
@prop [onReady] {function}
A callback function that will be registered for 'ready' event.
This is an optional property.
@prop [onActivate] {function}
A callback function that will be registered for 'activate' event.
This is an optional property.
@prop [onDeactivate] {function}
A callback function that will be registered for 'deactivate' event.
This is an optional property.
</api>

<api name="Tab">
@class
A `Tab` instance represents a single open tab. It contains various tab
properties, several methods for manipulation, as well as per-tab event
registration.

Tabs emit all the events described in the Events section. Listeners are
passed the `Tab` object that triggered the event.

<api name="title">
@property {string}
The title of the page currently loaded in the tab.
This property can be set to change the tab title.
</api>

<api name="url">
@property {String}
The URL of the page currently loaded in the tab.
This property can be set to load a different URL in the tab.
</api>

<api name="favicon">
@property {string}
The URL of the favicon for the page currently loaded in the tab.
This property is read-only.
</api>

<api name="index">
@property {integer}
The index of the tab relative to other tabs in the application window.
This property can be set to change it's relative position.
</api>

<api name="isPinned">
@property {boolean}
Whether or not tab is pinned as an [app tab][].
This property is read-only.
[app tab]:http://support.mozilla.com/en-US/kb/what-are-app-tabs
</api>

<api name="getThumbnail">
@property {method}
Returns thumbnail data URI of the page currently loaded in this tab.
</api>

<api name="pin">
@method
Pins this tab as an [app tab][].
[app tab]:http://support.mozilla.com/en-US/kb/what-are-app-tabs
</api>

<api name="unpin">
@method
Unpins this tab.
</api>

<api name="close">
@method
Closes this tab.

@param [callback] {function}
A function to be called when the tab finishes its closing process.
This is an optional argument.
</api>

<api name="activate">
@method
Makes this tab active, which will bring this tab to the foreground.
</api>

<api name="attach">
@method
  Create a page mod and attach it to the document in the tab.
  
**Example**

    var tabs = require("tabs");
    
    var worker = tabs.activeTab.attach({
      contentScript: 
        'document.body.style.border = "5px solid black";' +
        'postMessage(document.getElementById("#my-watched-element").textContent);',
      onMessage: function (data) {
        // data is equal to the text of my DOM element with ID "#my-watched-element"
        
      }
    });

@param options {object}
  Options for the page mod, with the following keys:

@prop [contentScriptFile] {string,array}
    The local file URLs of content scripts to load.  Content scripts specified
    by this option are loaded *before* those specified by the `contentScript`
    option. Optional.
@prop [contentScript] {string,array}
    The texts of content scripts to load.  Content scripts specified by this
    option are loaded *after* those specified by the `contentScriptFile` option.
    Optional.
@prop [onMessage] {function}
    A function called when the page mod receives a message from content scripts. 
    Listeners are passed a single argument, the message posted from the 
    content script.

@returns {Worker}
  See [Content Scripts guide](dev-guide/addon-development/web-content.html)
  to learn how to use the `Worker` object to communicate with the content script.

</api>

</api>
