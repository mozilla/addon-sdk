<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

# Open a Web Page #

To follow this tutorial you'll need to have
[installed the SDK](dev-guide/addon-development/tutorials/installation.html)
and learned the
[basics of `cfx`](dev-guide/addon-development/tutorials/getting-started-with-cfx.html).

To open a new web page, you can use the
[`tabs`](packages/addon-kit/docs/tabs.html) module:

    var tabs = require("tabs");
    tabs.open("http://www.example.com");

This function is asynchronous, so you don't immediately get back a
[`tab` object](packages/addon-kit/docs/tabs.html#Tab) which you can examine.
To do this, pass a callback function into `open()`. The callback is assigned
to the `onReady` property, and will be passed the tab as an argument:

    var tabs = require("tabs");
    tabs.open({
      url: "http://www.example.com",
      onReady: function onReady(tab) {
        console.log(tab.title);
      }
    });

Even then, you don't get direct access to any content hosted in the tab.

To access tab content you need to attach a script to the tab
using `tab.attach()`. This add-on attaches a script to all open
tabs that adds a red border to the document:

    var tabs = require("tabs");
    tabs.open({
      url: "http://www.example.com",
      onReady: runScript
    });

    function runScript(tab) {
      tab.attach({
        contentScript: "document.body.style.border = '5px solid red';"
      });
    }

## Learning More ##

To learn more about working with tabs in the SDK, see the
[`tabs` API reference](packages/addon-kit/docs/tabs.html).

To learn more about running scripts in tabs, see the
[tutorial on using `tab.attach()`](dev-guide/addon-development/tutorials/modifying-web-pages-tab.html).
