# Adding a Button to the Toolbar #

To add a button to the toolbar, use the
[`widget`](packages/addon-kit/docs/widget.html) module.

The default add-on created by `cfx init`
uses a widget, so we'll start with that as an example. If you haven't already
followed the tutorial introducing
[`cfx init`](dev-guide/addon-development/tutorials/getting-started-with-cfx.html#cfx-init),
do that now, then come back here.

The `lib/main.js` file looks like this:

    const widgets = require("widget");
    const tabs = require("tabs");

    var widget = widgets.Widget({
      id: "mozilla-link",
      label: "Mozilla website",
      contentURL: "http://www.mozilla.org/favicon.ico",
      onClick: function() {
        tabs.open("http://www.mozilla.org/");
      }
    });

It adds a button to the toolbar at the bottom of the browser window:

<img src="static-files/media/screenshots/widget-mozilla.png"
alt="Mozilla icon widget" />

Clicking the button opens [http://www.mozilla.org](http://www.mozilla.org).

You must give a widget a unique `id` and a `label`.

## Specifying the Icon ##

If you're using the widget to make a toolbar button, specify the icon to
display using `contentURL`: this may refer to a remote file as in the
example above, or may refer to a local file. The example below will load
an icon file called "myIcon.png" from the add-on's `data` directory:

    const widgets = require("widget");
    const tabs = require("tabs");
    const self = require("self");

    var widget = widgets.Widget({
      id: "mozilla-link",
      label: "Mozilla website",
      contentURL: self.data.url("myIcon.png"),
      onClick: function() {
        tabs.open("http://www.mozilla.org/");
      }
    });

