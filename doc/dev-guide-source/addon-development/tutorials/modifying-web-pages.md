# Modifying Web Pages #

There are two main ways you can use the SDK to modify web pages.

* to modify any pages which match a particular URL pattern (for
example:"mozilla.com" or "*.org") as they are loaded, use
[`page-mod`](dev-guide/addon-development/tutorials/modifying-web-pages.html#page-mod)
* to modify the page hosted by a particular tab (for example,
the currently active tab) use
[`tab.attach()`](dev-guide/addon-development/tutorials/modifying-web-pages.html#tab-attach)

## <a name="page-mod">Modifying Pages Based on URL</a> ##

`page-mod` enables you to attach scripts to web pages which match a particular
URL pattern.

To use it you need to specify two things:

* one or more scripts to run. Because their job is to interact with web
content, these scripts are called *content Scripts*.
* one or more patterns to match the URLs for the pages you want to modify

Here's a simple example. The content script is supplied as the `contentScript`
option, and the URL pattern is given as the `include` option:

    // Import the page-mod API
    var pageMod = require("page-mod");

    // Create a page mod
    // It will run a script whenever a ".org" URL is loaded
    // The script replaces the page contents with a message
    pageMod.PageMod({
      include: "*.org",
      contentScript: 'document.body.innerHTML = ' +
                     ' "<h1>Page matches ruleset</h1>";'
    });

Try it out:

* create a new directory and navigate to it
* run `cfx init`
* open the `lib/main.js` file, and replace its contents with the code above
* run `cfx run`, then run `cfx run` again
* open [ietf.org](http://www.ietf.org) in the browser window that opens

This is what you should see:

<img  class="image-center" src="static-files/media/screenshots/pagemod-ietf.png"
alt="ietf.org eaten by page-mod" />

### Specifying the Match Pattern ###

The match pattern uses the
[`match-pattern`](packages/api-utils/docs/match-pattern.html)
syntax. You can pass a single match-pattern string, or an array.

### Keeping the Content Script in a Separate File ###

In the example above we've passed in the content script as a string. In most
real-world cases, it's easier to maintain the script as a separate file.
To do this, you need to:

* save the script in your add-on's `data` directory
* use the `contentScriptFile` option instead of `contentScript`, and pass
it the URL for the script. The URL can be obtained using `self.data.url()`

For example, if we save the script above under the add-on's `data` directory
in a file called `my-script.js`:

    document.body.innerHTML = "<h1>Page matches ruleset</h1>";

We can load this script by changing the page-mod code like this:

    // Import the page-mod API
    var pageMod = require("page-mod");
    // Import the self API
    var self = require("self");

    // Create a page mod
    // It will run a script whenever a ".org" URL is loaded
    // The script replaces the page contents with a message
    pageMod.PageMod({
      include: "*.org",
      contentScriptFile: self.data.url("my-script.js")
    });

You can load more than one script, and the scripts can interact
directly with each other. So, for example, if you save jQuery in your
`data` directory and load it alongside your script, then your script
can make use of jQuery:

    // Import the page-mod API
    var pageMod = require("page-mod");
    // Import the self API
    var self = require("self");

    // Create a page mod
    // It will run a script whenever a ".org" URL is loaded
    // The script replaces the page contents with a message
    pageMod.PageMod({
      include: "*.org",
      contentScriptFile: self.data.url("jquery-1.7.min.js"),
      contentScript: '$("body").html("<h1>Page matches ruleset</h1>");'
    });

Note, though, that you can't load a script from a web site. The script
must be loaded from `data`.

### Communicating With the Content Script ###

Your add-on script and the content script can't directly
access each other's variables or call each other's functions, but they
can send each other messages.

To send a
message from one side to the other, the sender calls `port.emit()` and
the receiver listens using `port.on()`.

* In the content script, `port` is a property of the global `self` object.
* In the add-on script, you need to listen for the `onAttach` event to get
passed an object that contains `port`.

Let's rewrite the example above to pass a message from the add-on to
the content script. The content script now needs to look like this:

    // "self" is a global object in content scripts
    self.port.on("displayMessage", function(message) {
      document.body.innerHTML = "<h1>" + message + "</h1>";
    });

In the add-on script, we'll send the content script a message inside `onAttach`:

    // Import the page-mod API
    var pageMod = require("page-mod");
    // Import the self API
    var self = require("self");

    // Create a page mod
    // It will run a script whenever a ".org" URL is loaded
    // The script replaces the page contents with a message
    pageMod.PageMod({
      include: "*.org",
      contentScriptFile: self.data.url("my-script.js"),
      // Send the content script a message inside onAttach
      onAttach: function(worker) {
        worker.port.emit("displayMessage", "Page matches ruleset");
      }
    });

### Learning More ###

To learn more about page-mod, see its
[API reference page](packages/addon-kit/docs/page-mod.html).

To learn more about content scripts, see the
[content scripts guide](dev-guide/addon-development/web-content.html).

## <a name="tab-attach">Modifying the Page Hosted by a Tab</a> ##

To load a script into the page hosted by a particular tab, use the
`attach()` method of the [tab](packages/addon-kit/docs/tabs.html) object.

`attach()` takes a single mandatory option, which is one or more content
scripts to execute in the page. The content script is executed immediately.

Here's a simple example:

    var widgets = require("widget");
    var tabs = require("tabs");

    var widget = widgets.Widget({
      id: "mozilla-link",
      label: "Mozilla website",
      contentURL: "http://www.mozilla.org/favicon.ico",
      onClick: function() {
        tabs.activeTab.attach({
          contentScript:
            'document.body.style.border = "5px solid red";'
          })
        }
    });

This add-on creates a widget which contains the Mozilla favicon as an icon.
It has a click handler which fetches the active tab and loads a content
script into the page hosted by the active tab. The content script just draws
a red border round the page. Try it out:

* create a new directory and navigate to it
* run `cfx init`
* open the `lib/main.js` file, and replace its contents with the code above
* run `cfx run`, then run `cfx run` again

You should see the Mozilla icon appear in the bottom-right corner of the
browser:

<img class="image-center" src="static-files/media/screenshots/widget-mozilla.png"
alt="Mozilla icon widget" />

Next open any web page in the browser window that opens, and click the
Mozilla icon. You should see a red border appear around the page, like this:

<img class="image-center" src="static-files/media/screenshots/tabattach-bbc.png"
alt="bbc.co.uk modded by tab.attach" />

### Keeping the Content Script in a Separate File ###

In the example above we've passed in the content script as a string. But
as with the
[`page-mod` example above](dev-guide/addon-development/tutorials/modifying-web-pages.html#page-mod),
it's usually easier to maintain the script as a separate file.

For example, if we save the script above under the add-on's `data` directory
in a file called `my-script.js`:

    document.body.style.border = "5px solid red";

We can load this script by changing the add-on code like this:

    var widgets = require("widget");
    var tabs = require("tabs");
    var self = require("self");

    var widget = widgets.Widget({
      id: "mozilla-link",
      label: "Mozilla website",
      contentURL: "http://www.mozilla.org/favicon.ico",
      onClick: function() {
        tabs.activeTab.attach({
          contentScriptFile: self.data.url("my-script.js")
          })
        }
    });

As in the
[`page-mod` example](dev-guide/addon-development/tutorials/modifying-web-pages.html#page-mod),
you can load more than one script, and the scripts can interact
directly with each other.

### Communicating With the Content Script ###

As with
[`page-mod`](dev-guide/addon-development/tutorials/modifying-web-pages.html#page-mod),
your add-on script and the content script can't directly
access each other's variables or call each other's functions, but they
can send each other messages using `port.emit()` and
`port.on()`. In this case `tab-attach()` returns an object containing the
`port` property you use to send messages to the content script.

Let's rewrite the example above to pass a message from the add-on to
the content script. The content script now needs to look like this:

    // "self" is a global object in content scripts
    self.port.on("drawBorder", function(color) {
      document.body.style.border = "5px solid" + color;
    });

In the add-on script, we'll send the content script a message using the
object returned from `attach()`:

    var widgets = require("widget");
    var tabs = require("tabs");
    var self = require("self");

    var widget = widgets.Widget({
      id: "mozilla-link",
      label: "Mozilla website",
      contentURL: "http://www.mozilla.org/favicon.ico",
      onClick: function() {
        worker = tabs.activeTab.attach({
          contentScriptFile: self.data.url("my-script.js")
          })
        worker.port.emit("drawBorder", "red");
        }
    });

### Learning More ###

To learn more about working with tabs in the SDK, see the
[Working With Tabs and Windows tutorial](dev-guide/addon-development/tutorials/tabs-and-windows.html),
and the [`tabs` API reference](packages/addon-kit/docs/tabs.html).

To learn more about content scripts, see the
[content scripts guide](dev-guide/addon-development/web-content.html).