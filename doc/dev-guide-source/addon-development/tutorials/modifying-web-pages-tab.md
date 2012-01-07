
# Modifying the Page Hosted by a Tab #

To modify the page hosted by a particular tab, load a script into it
using the `attach()` method of the
[tab](packages/addon-kit/docs/tabs.html) object.

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