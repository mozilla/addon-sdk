<!-- contributed by Dietrich Ayala [dietrich@mozilla.com]  -->
<!-- edited by Noelle Murata [fiveinchpixie@gmail.com]  -->


The `tabs` module provides easy access to tabs and tab-related events.

Events
------

Events represent common actions and state changes for tabs and their content.

Listeners are passed the `tab` object that triggered the event.

All the tabs and lists of tabs emit following events:

### open ###
Event emitted when a new tab is open.
This does not mean that the content has loaded, only that the browser tab
itself is fully visible to the user.

Tab content related properties (title, thumbnail, favicon, url) will not
be correct at this point. Use `ready` event listener to be notified when the
page has loaded.

### close ###
Event emitted when a tab is closed.

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

**Example**

    var tabs = require("tabs").tabs;

    // listen for tab openings.
    tabs.on('open', function onOpen(tab) {
      myOpenTabs.push(tab);
    });

    // listen for tab content loadings.
    tabs.on('ready', function(tab) {
      console.log('tab is loaded', tab.title, tab.url)
    });

<api name="tabs">
@property {TabList}

The live list of all open tabs, across all open windows.

_See TabList class for more details._

**Example**

    var tabs= require("tabs").tabs;
    for each (var tab in tabs) {
      console.log(tab.title);
    }
</api>

<api name="TabList">
@class
The set of sorted list of open tabs.
An instance of `TabList` represents a list of open tabs. `Tablist` can represent
a list of tabs per window as in the case of `BrowserWindow`'s `tabs` property
or list of all open tabs as in the case of `tabs` object that is exported by
this module.

`TabList` instances emit all the events described in the "events" section.
Listeners are passed the `tab` object that triggered the event.

<api name="active">
@property {Tab}

The currently active tab in this list. This property is read-only.

**Example**

    // Getting active tab's title.
    var tabs = require("tabs").tabs;
    console.log("title of active tab is " + tabs.active.title);

    // Activate tab next to currently active one.
    tabs.active = tabs[tabs.active++];
</api>
<api name="length">
@property {number}

Number of items in this list.
</api>
<api name="open">
@method
Open a new tab. If this is a list of tabs for a window, the tab will be opened
on this window. If this is a list of all tabs, the new tab will be open in the
active window or in the new window depending on the option being passed.

**Example**

    var tabs = require("tabs").tabs;

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

    // Open a new tab as an apptab and do something once it's open.
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
If present and true, then the new tab will be pinned as an AppTab.
[AppTab]:http://blog.mozilla.com/faaborg/2010/07/28/app-tabs-in-firefox-4-beta-2/

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
@prop [onActivate] {function}
A callback function that will be registered for 'activate' event.
This is an optional property.
</api>
</api>

<api name="Tab">
@class
A `tab` instance represents a single open tab. It contains various tab
properties, several methods for manipulation, as well as per-tab event
registration.

Tabs emit all the events described in the "events" section. Listeners are
passed the `tab` object that triggered the event.

    var tabs = require("tabs").tabs;

    // Close the active tab.
    tabs.activeTab.close();

    // Move the active tab one position to the right.
    tabs.activeTab.index++;

    // Open a tab and listen for content being ready.
    tabs.open({
      url: "http://www.mozilla.com",
      onReady: function(tab) {
        console.log(tab.title);
      }
    });

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

<api name="style">
@property {string}
The CSS style for the tab. **NOT IMPLEMENTED YET**.
</api>

<api name="index">
@property {integer}
The index of the tab relative to other tabs in the application window.
This property can be set to change it's relative position.
</api>

<api name="thumbnail">
@property {string}
Data URI of a thumbnail of the page currently loaded in the tab.
This property is read-only.
</api>

<api name="isPinned">
@property {boolean}
Whether or not tab is pinned as an [AppTab].
This property is read-only.
[AppTab]:http://blog.mozilla.com/faaborg/2010/07/28/app-tabs-in-firefox-4-beta-2/
</api>

<api name="pin">
@method
Pins this tab as an [AppTab].
[AppTab]:http://blog.mozilla.com/faaborg/2010/07/28/app-tabs-in-firefox-4-beta-2/
</api>

<api name="unpin">
@method
Unpin this tab.
</api>

<api name="close">
@method
Close this tab.

@param [callback] {function}
A function to be called when the tab finishes its closing process.
This is an optional arguments.
</api>

<api name="activate">
@method
Makes this tab active, which will bring this tab to the foreground.
</api>
</api>
