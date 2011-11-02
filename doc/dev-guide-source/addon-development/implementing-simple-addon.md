# Implementing a Simple Add-on #

This section of the tutorial takes you through the process of implementing,
running and packaging a simple add-on using the SDK. The add-on will add a
menu item to Firefox's context menu, to appear when anything in the page
is selected. The menu item displays a popup dialog containing the
Wikipedia entry for the selected text.

## Initializing Your Add-on ##

Create a directory called `wikipanel`. This is where we will keep all the
files for this add-on.

You *do not* have to create this directory under the SDK root: once you have
called `source bin/activate` from the SDK root, `cfx` will remember where the
SDK is, and you will be able to reference SDK packages from any directory.

Keeping your add-on code outside the SDK is good practice as it makes it easier
for you to update the SDK and to manage your code using a version control
system.

Next we'll use `cfx init` to create a skeleton structure for your add-on.
Navigate to the `wikipanel` directory and execute `cfx init`. You should see
something like this:

<pre>
  * lib directory created
  * data directory created
  * test directory created
  * doc directory created
  * README.md written
  * package.json written
  * test/test-main.js written
  * lib/main.js written
  * doc/main.md written

  Your sample add-on is now ready for testing:
      try "cfx test" and then "cfx run". Have fun!"
</pre>

First, `cfx init` creates the directory structure your add-on needs:

<span class="aside">
When you create add-ons using the SDK, you might create two different sorts of
scripts.
All add-ons will create at least one script under `/lib`. Some add-ons
will also create "content scripts" stored under `/data`.
For more information
on the difference between these two sorts of files, see
[Two Types of Scripts](dev-guide/addon-development/two-types-of-scripts.html).
</span>

* `/data` contains resources such as icons or HTML files, as well as any
[content scripts](dev-guide/addon-development/web-content.html) included
with your add-on. You can access the
content of the `data` subdirectory from within your add-on's code using the
Add-on SDK's [`self`](packages/addon-kit/docs/self.html) module.

* `/doc` contains any documentation for your add-on.

* `/lib` contains the JavaScript modules implementing your add-on.

* `/test` contains unit test code.

Next, `cfx init` creates a file called `package.json` in the root `wikipanel`
directory. This contains information about your add-on and should look
something like this:

<pre>
  {
    "name":"wikipanel",
    "fullName":"wikipanel",
    "description":"This is an example of addon description.",
    "author":"",
    "license":"MPL",
    "version":"0.1"
  }
</pre>

Finally, `cfx init` creates some example files under `doc`, `lib`, and
`test`: we will replace those.

## Adding Your Code ##

In the `lib` directory, open the file called `main.js` and replace its
contents with the following:

    // Import the APIs we need.
    var contextMenu = require("context-menu");
    var panel = require("panel");

    exports.main = function(options, callbacks) {
      console.log(options.loadReason);

      // Create a new context menu item.
      var menuItem = contextMenu.Item({
        label: "What's this?",
        // Show this item when a selection exists.
        context: contextMenu.SelectionContext(),
        // When this item is clicked, post a message back with the selection
        contentScript: 'self.on("click", function () {' +
                       '  var text = window.getSelection().toString();' +
                       '  self.postMessage(text);' +
                       '});',
        // When we receive a message, look up the item
        onMessage: function (item) {
          console.log('looking up "' + item + '"');
          lookup(item);
        }
      });
    };

    function lookup(item) {
      wikipanel = panel.Panel({
        width: 240,
        height: 320,
        contentURL: "http://en.wikipedia.org/w/index.php?title=" +
                    item + "&useformat=mobile"
      });
      wikipanel.show();
    }

### Importing Modules ###

The first two lines are used to import two SDK modules from the
addon-kit package:

* [`context-menu`](packages/addon-kit/docs/context-menu.html) enables add-ons
to add new items to the context menu
* [`panel`](packages/addon-kit/docs/panel.html) enables add-ons to display
popup windows

### Creating a Context Menu Item ###

Next, this code constructs a context menu item. It supplies:

* the text to appear in the menu: "What's this?"
* a context in which the item should be displayed: `SelectionContext()`,
meaning: include this item in the context menu whenever some content on the
page is selected
* a script to execute when the item is clicked: this script sends the selected
text to the function assigned to the `onMessage` property
* a value for the `onMessage` property: this function will now be called with
the selected text, whenever the user clicks the menu.

The supplied function loads the Wikipedia entry for the selection into a
panel.

### Listening for Load and Unload ###

The code which creates the context menu is wrapped in a function which we have
assigned to the  `main` property of the global `exports` object.

If your add-on exports a function called `main`, that function will be called
when the add-on is loaded.

    exports.main = function (options, callbacks) {};

`options` is an object describing the parameters with which your add-on was
loaded. In particular, `options.loadReason` is one of the following strings
describing the reason your add-on was loaded: `install`, `enable`, `startup`,
`upgrade`, or `downgrade`.

Conversely, if your add-on exports a function called `onUnload`, that function
will be called when the add-on is unloaded.

    exports.onUnload = function (reason) {};

<span class="aside">
Note that if your add-on is unloaded with reason `disable`, it will not be
notified about `uninstall` while it is disabled: see
bug [571049](https://bugzilla.mozilla.org/show_bug.cgi?id=571049).
</span>

`reason` is one of the following strings describing the reason your add-on was
unloaded: `uninstall`, `disable`, `shutdown`, `upgrade`, or `downgrade`.

You don't have to use `exports.main` or `exports.onUnload`. You can just place
your add-on's code at the top level instead of wrapping it in a function
assigned to `exports.main`: it will be loaded in the same circumstances, but
you won't get access to the `options` or `callbacks` arguments.

This particular add-on doesn't need to use `exports.main` for anything, and
only includes it to illustrate its use.

### Logging ###

Note the calls to `console.log()` here. `console` is a global object accessible
by any module, which you can use to write error, warning, or informational
messages.

For an add-on which has been packaged as an XPI file and installed into
Firefox, the messages are sent to Firefox's
[Error Console](https://developer.mozilla.org/en/Error_Console). If you are
launching Firefox from the command line using `cfx`, as you will be for
development and debugging, then the messages are sent to the command shell
from which you launched Firefox.

For more information on the `console` object see its
[documentation page](dev-guide/addon-development/console.html).

## Running It ##

To run your program, navigate to the `wikipanel` directory and type:

<pre>
  cfx run
</pre>

The first time you do this, you'll see a message like this:

<pre>
  No 'id' in package.json: creating a new ID for you.
  package.json modified: please re-run 'cfx run'
</pre>

<span class="aside">
The ID that `cfx` generated the first time you executed `cfx run` is a unique
identifier for your add-on. To learn more about it refer to the
[Program ID](dev-guide/addon-development/program-id.html) document.
</span>

Run it again, and it will run an instance of Firefox with your add-on
installed.

Once `cfx run` has launched Firefox you can try out the new add-on. Load a
page containing some text that is not in English, for example:
[http://www.mozilla.org/about/manifesto.fr.html](http://www.mozilla.org/about/manifesto.fr.html)

Select some text on that page and right-click to activate the context menu.
You should see a new item labeled "What's this?":

![wikipanel context-menu](static-files/media/screenshots/wikipanel/wikipanel-context-menu.png)

Select that item and you'll see a popup panel showing the Wikipedia entry for
the selection:

![wikipanel panel](static-files/media/screenshots/wikipanel/wikipanel-panel.png)

You will also see output like this appear in your command shell:

<pre>
  info: looking up "Jetpack"
</pre>

## Preparing Your Add-on for Deployment ##

Once you have finished testing your add-on you can package it for deployment
like any other Firefox add-on, as a XPI file. The Add-on SDK simplifies the
packaging process by generating this file for you.

### Specifying an Icon ###

You can specify an icon for your add-on. This icon will appear beside your
add-on in Firefox's Add-ons Manager and on
[addons.mozilla.org](https://addons.mozilla.org/en-US/firefox/).

To specify an icon, save it as "icon.png" in your add-on's root directory. To
give the icon a different name or to store it in a different location
under the root, use the "icon" key in your `package.json` file. See the
[Package Specification](file:///Users/Work/mozilla/jetpack-sdk/doc/dev-guide/addon-development/package-spec.html)
for more details.

### cfx xpi ###

To package your program as a XPI, navigate to the root of your package
directory in your shell and run `cfx xpi`. You should see a message like:

<pre>
  Exporting extension to wikipanel.xpi.
</pre>

The `wikipanel.xpi` file can be found in the directory in which you ran
the command.

## Installing the Package ##

Test that the package installs correctly by adding it to your own Firefox
installation.

You can do this by pressing the Ctrl+O key combination (Cmd+O on Mac) from
within Firefox. This will bring up a file selection dialog: navigate to the
`wikipanel.xpi` file, open it and follow the prompts to install the
add-on.

Alternatively:

* Open the Firefox Add-ons Manager from within Firefox, either
from the Add-ons item on the Tools menu, or by typing `about:addons` into the
address bar.

* In the Firefox Add-ons Manager there is a gears icon next to the
search bar. Click the icon and select "Install Add-on From File..." from the
menu that appears. Again, this will bring up a file selection dialog which you
can use to find and open the XPI file.

Once you have installed the add-on you can test it in exactly the same way as
in the "Running It" section above.

## Distributing It ##

To distribute your program, you can upload it to
[addons.mozilla.org](http://addons.mozilla.org).
Eventually, this step may be automated via the SDK, streamlining the
distribution process further.

In the next section we'll introduce
[CommonJS](dev-guide/addon-development/commonjs.html), which provides the
infrastructure for the SDK.
