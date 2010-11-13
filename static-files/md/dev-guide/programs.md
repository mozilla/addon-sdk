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

### Using the SDK's Built-in Libraries ###

Add a `dependencies` entry to your package.json file, showing that your
package requires modules from the jetpack-core library. It should look
something like this now:

    {
      "description": "This package adds a translation context menu item.",
      "author": "Me (http://me.org)",
      "dependencies": ["jetpack-core"]
    }


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
notified about `"uninstall"` while it is disabled.  (A solution to this issue is
being investigated; see bug 571049.)

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
in your shell and run:

    cfx run

That will load an instance of Firefox (or your default application)
with your program installed.

### Packaging It ###

Your program is packaged like any other extension for a Mozilla-based
application, as a XPI file. The Add-on SDK simplifies the packaging
process by generating this file for you.

<span class="aside"> Each program (such as an add-on) gets a
separate cryptographic keypair. Your program is signed by the private
key, and the public key is used as the "ID". See
[XPI Generation](#guide/xpi) for more details.</span>

To package your program as a XPI, navigate to the root of your package
directory in your shell and run `cfx xpi`. The first time you do this,
you'll see a message about generating a keypair and modifying your
`package.json` to add an `id` field, asking you to run `cfx xpi` again.
When you re-run it, you should see a message:

    Exporting extension to test.xpi.

The test.xpi file can be found in the directory in which you ran the
command.

### Checking the Package ###

If you'd like to test the packaged program before distributing it,
you can run it from the shell with:

    mozrunner -a test.xpi

Or you can install it from the Firefox Add-ons Manager itself, as
you would when testing a traditional add-on.

Running your program as described in the `Running It` section uses
the same process as packaging it as a .xpi, so this step is optional.

### Distributing It ###

To distribute your program, you can upload it to
[Addons.mozilla.org](http://addons.mozilla.org).
Eventually, this step may be automated via the SDK, streamlining the
distribution process further.

The next section provides an overview of the mechanisms the SDK provides
to access and modify web pages: [Interacting with Web
Content](#guide/web-content).

  [Packaging]: #guide/packaging
  [troubleshooting]: #guide/troubleshooting
