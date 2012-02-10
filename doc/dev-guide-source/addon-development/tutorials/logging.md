# Logging #

<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

<span class="aside">
To follow this tutorial you'll need to have
[installed the SDK](dev-guide/addon-development/installation.html)
and learned the
[basics of `cfx`](dev-guide/addon-development/tutorials/getting-started-with-cfx.html).
</span>

To help debug your add-on you can use the SDK's global `console` object
to log error, warning, or informational messages. You don't have to
`require()` anything to get access to the console: it is automatically
made available to you.

<span class="aside">
Because `window.alert()` isn't available to your main add-on code,
if you use it for diagnostics then the console is a
useful replacement.
</span>


The `console.log()` method prints an informational message:

    console.log("Hello World");

Try it out:

* create a new directory, and navigate to it
* execute `cfx init`
* open "lib/main.js" and replace its contents with the line above
* execute `cfx run`, then `cfx run` again

Firefox will start, and the following line will appear in the command
window you used to execute `cfx run`:

<pre>
info: Hello World!
</pre>

## `console` in Content Scripts ##

You can use the console in [content scripts]() as well as in your main
add-on code. The following add-on logs the HTML content of every tab the
user loads, by calling `console.log()` inside a content script:

    require("tabs").on("ready", function(tab) {
      tab.attach({
        contentScript: "console.log(document.body.innerHTML);"
      });
    });

## `console` Output ##

If you are running your add-on from the command line (for example,
executing `cfx run` or `cfx test`) then the console's messages appear
in the command shell you used.

If you've installed the add-on in Firefox, or you're running the
add-on in the Add-on Builder, then the messages appear in Firefox's
[Error Console](https://developer.mozilla.org/en/Error_Console).

## Learning More ##

For the complete `console` API, see its
[API reference](dev-guide/addon-development/console.html).
