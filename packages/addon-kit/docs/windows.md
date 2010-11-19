<!-- contributed by Felipe Gomes [felipc@gmail.com]  -->


The `windows` module provides easy access to browser windows, their
tabs, and open/close related functions and events.

This module currently only supports browser windows and does not provide
access to non-browser windows such as the Bookmarks Library, preferences
or other non-browser windows created via add-ons.

Events
------

Events represent common actions and state changes for windows.

Listeners are passed the `window` object that triggered the event.

All the windows and lists of windows emit following events:

### open ###
Event emitted when a new window is open.
This does not mean that the content has loaded, only that the browser window
itself is fully visible to the user.

### close ###
Event emitted when a window is closed.

<api name="browserWindows">
@property {List}
An object that contains various properties and methods to access
functionality from browser windows, such as opening new windows, accessing
their tabs or switching the current active window.

`browserWindows` provides access to all the currently open browser windows:

    var windows = require("windows");
    for each (var window in windows.browserWindows) {
      console.log(window.title);
    }

    console.log(windows.browserWindows.length);

Object emits all the events listed under "Events" section.

####Examples####

    var windows = require("windows").browserWindows;

    // add a listener to the 'open' event
    windows.on('open', function(window) {
      myOpenWindows.push(window);
    });

    // add a listener to the 'close' event
    windows.on('close', function(window) {
      console.log("A window was closed.");
    });

<api name="activeWindow">
@property {BrowserWindow}

The currently active window. This property can be set to an instance of
`BrowserWindow` which will focus that window and bring it to the foreground.

**Example**

    // get
    var windows = require("windows");
    console.log("title of active window is " +
                windows.browserWindows.activeWindow.title);

    // set
    windows.activeWindow = anotherWindow;

</api>

</api>

<api name="openWindow">
@function
Open a new window.

    var windows = require("windows").browserWindows;

    // Open a new window.
    windows.openWindow("http://www.mysite.com");

    // Open a new window and set a listener for "open" event.
    windows.openWindow({
      url: "http://www.mysite.com",
      onOpen: function(window) {
        // do stuff like listen for content
        // loading.
      }
    });

    // Open new window with two tabs.
    windows.openWindow({
      tabs: [
        "http://www.mysite.com",
        { url: "http:/mozilla.com",
          pinned: true                // Open this tab as apptab.
        }
      ]
    });

@param options {object}
An object containing configurable options for how this window will be opened,
as well as a callback for being notified when the window has fully opened.

If the only option being used is `url`, then a bare string URL can be passed to
`openWindow` instead of specifying it as a property of the `options` object.

@prop url {string}
String URL to be opened in the new window.
This is a required property.

@prop [tabs] {array}
Array of objects containing configurable options for tabs or URL strings.
The property can be used to open new window with a several tabs. Each element
of the array is an options object or URL string passed to the
[TabList's open method](#module/addon-kit/tabs).
This is an optional property.

@prop [onOpen] {function}
A callback function that is called when the window has opened. This does not
mean that the URL content has loaded, only that the window itself is fully
functional and its properties can be accessed. This is an optional property.

@prop [onClose] {function}
A callback function that is called when the window will be called.
This is an optional property.
</api>

</api>

<api name="BrowserWindow">
@class
A `BrowserWindow` instance represents a single open window. They can be
retrieved from the `browserWindows` property exported by this module.

    var windows = require("windows").browserWindows;

    //Print how many tabs the current window has
    console.log("The active window has " +
                windows.activeWindow.tabs.length +
                " tabs.");

    // Print the title of all browser windows
    for each (var window in windows) {
      console.log(window.title);
    }

    // close the active window
    windows.activeWindow.close();

    windows.activeWindow.close(function() {
      console.log("The active window was closed");
    });

<api name="title">
@property {string}
The current title of the window. Usually the title of the active tab,
plus an app identifier.
This property is read-only.
</api>

<api name="tabs">
@property {TabList}
An instance of [TabList](#module/addon-kit/tabs) representing the live list of
all the open tabs for this window.
This property is read-only.
</api>

<api name="focus">
@method
Makes window active
</api>

<api name="close">
@method
Close the window.

@param callback {function}
A function to be called when the window finishes its closing process.
</api>

</api>

