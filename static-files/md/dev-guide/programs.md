<span class="aside">
The procedures described in this section are tentative and likely to
change in the near future.
</span>

If packages are constructed in a certain way, they can function as
Firefox or Thunderbird extensions, full-fledged native platform applications,
and more.

## Your First Program ##

We're going to continue building upon our package from the [Packaging]
section.  This program adds a menu item to Firefox's context menu that replaces
selected text with its English translation.

### Adding Your Code ###

If a module called `main` exists in your package, that module will be evaluated
as soon as your program is loaded. By "loaded", we mean that either a host
application such as Firefox or Thunderbird has enabled your program as an
extension, or that your program is itself a standalone application.  The
forthcoming example will demonstrate an extension.

With this in mind, let's create a file at `lib/main.js` with the
following content:

    // Import the APIs we need.
    var contextMenu = require("context-menu");
    var request = require("request");
    var selection = require("selection");

    // Create a new context menu item.
    var menuItem = contextMenu.Item({

      label: "Translate Selection",

      // Show this item when a selection exists.
      context: contextMenu.SelectionContext(),

      // When this item is clicked, post a message to the item with the
      // selected text and current URL.
      contentScript: 'on("click", function () {' +
                     '  var text = window.getSelection().toString();' +
                     '  postMessage({ text: text, url: document.URL });' +
                     '});',

      // When we receive the message, call the Google Translate API with the
      // selected text and replace it with the translation.
      onMessage: function (selectionInfo) {
        var req = request.Request({
          url: "http://ajax.googleapis.com/ajax/services/language/translate",
          content: {
            v: "1.0",
            q: selectionInfo.text,
            langpair: "|en"
          },
          headers: {
            Referer: selectionInfo.url
          },
          onComplete: function (response) {
            selection.text = response.json.responseData.translatedText;
          }
        });
        req.get();
      }
    });

### Listening for Load and Unload ###

We take a moment to note that just as your program is loaded when it starts, it
is unloaded when it exits. By "unloaded", we mean that either the host
application has quit or disabled or uninstalled your program as an extension, or
that your program as a standalone application has quit. Your program can listen
for both of these load and unload events.

If your program exports a function called `main`, that function will be called
when your program is loaded.

    exports.main = function (options, callbacks) {};

`options` is an object describing the parameters with which your program was
loaded.  In particular, `options.loadReason` is one of the following strings
describing the reason your program was loaded: `"install"`, `"enable"`,
`"startup"`, `"upgrade"`, or `"downgrade"`.  (On Gecko 1.9.2-based applications
such as Firefox 3.6, `"enable"`, `"upgrade"`, and `"downgrade"` are not
available, and `"startup"` will be sent in their place.)

If your program exports a function called `onUnload`, that function will be
called when your program is unloaded.

    exports.onUnload = function (reason) {};

`reason` is one of the following strings describing the reason your program was
unloaded: `"uninstall"`, `"disable"`, `"shutdown"`, `"upgrade"`, or
`"downgrade"`.  (On Gecko 1.9.2-based applications such as Firefox 3.6,
`"upgrade"` and `"downgrade"` are not available, and `"shutdown"` will be sent
in their place.)

Note that if your program is unloaded with reason `"disable"`, it will not be
notified about `"uninstall"` while it is disabled.  (A solution to this issue
is being investigated; see bug 571049.)

### Logging ###

<span class="aside">
If you've used [Firebug], the `console` object may seem familiar.
This is completely intentional; we'll eventually be plugging
this object into a much richer implementation.

  [Firebug]: http://getfirebug.com/
</span>

You'll note that the code above also uses a global object called `console`.
This is a global accessible by any module and is very useful for debugging.

### Running It ###

To run your program, navigate to the root of your package directory
in your shell and type:

    cfx run

The first time you do this, you'll see a message like this:

    No 'id' in package.json: creating a new keypair for you.
    package.json modified: please re-run 'cfx run'

Run it again, and it will run an instance of Firefox (or your default
application) with your add-on installed.

The ID that `cfx` generated the first time you executed `cfx run` is called the
**Program ID** and it is important. It is a unique identifier for your add-on
and is used for a variety of purposes. For example: mozilla.addons.org uses it
to distinguish between new add-ons and updates to existing add-ons, and the
[`simple-storage`](#module/addon-kit/simple-storage) module uses it to figure
out which stored data belongs to which add-on.

To learn more about the Program ID refer to the [Program ID](#guide/program-id)
document.

### Trying It Out ###

Once `cfx run` has launched Firefox you can try out the new add-on. Load a
page containing some text that is not in English. For example:
[http://www.mozilla-europe.org/fr/](http://www.mozilla-europe.org/fr/).

Select some text on that page and right-click to activate the context menu.
You should see a new item labeled "Translate Selection". Select that item and
the text you selected should be replaced with its English translation.

### Packaging It ###

Your program is packaged like any other extension for a Mozilla-based
application, as a XPI file. The Add-on SDK simplifies the packaging
process by generating this file for you.

To package your program as a XPI, navigate to the root of your package
directory in your shell and run `cfx xpi`. The first time you do this,
you'll see a message about generating a keypair and modifying your
`package.json` to add an `id` field, asking you to run `cfx xpi` again.
When you re-run it, you should see a message:

    Exporting extension to my-first-package.xpi.

The my-first-package.xpi file can be found in the directory in which you ran
the command.

#### The Program ID ####

The ID that `cfx` generated the first time you executed `cfx run` is called the
**Program ID** and it is important. It is a unique identifier for your add-on
and is used for a variety of purposes. For example: mozilla.addons.org uses it
to distinguish between new add-ons and updates to existing add-ons, and the
[`simple-storage`](#module/addon-kit/simple-storage) module uses it to figure
out which stored data belongs to which add-on.

### Checking the Package ###

Test that the package installs correctly by adding it to your own Firefox
installation.

You can do this by pressing the Ctrl+O key combination (Cmd+O on Mac) from
within Firefox. This will bring up a file selection dialog: navigate to the
my-first-package.xpi file, open it and follow the prompts to install the
add-on.

Alternatively, open the Firefox Add-ons Manager from within Firefox, either
from the Add-ons item on the Tools menu, or by typing "about:addons" into the
address bar. In the Firefox Add-ons Manager there is a gears icon next to the
search bar. Click the icon and select "Install Add-on From File..." from the
menu that appears. Again, this will bring up a file selection dialog which you
can use to find and open the XPI file.

Once you have installed the add-on you can test it in exactly the same way as
in the "Trying It Out" section above.

### Distributing It ###

To distribute your program, you can upload it to
[Addons.mozilla.org](http://addons.mozilla.org).
Eventually, this step may be automated via the SDK, streamlining the
distribution process further.

The next section provides an overview of the SDK's [event-handling
framework](#guide/events).

  [Packaging]: #guide/packaging
  [troubleshooting]: #guide/troubleshooting
