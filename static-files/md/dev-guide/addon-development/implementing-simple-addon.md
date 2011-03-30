# Implementing a Simple Add-on #

This section of the tutorial takes you through the process of implementing,
running and packaging a simple add-on using the SDK. The add-on will add a
menu item to Firefox's context menu that replaces selected text with its
English translation.

## Initializing Your Add-on ##

Create a directory called `translator`. This is where we will keep all the
files for this add-on.

You *do not* have to create this directory under the SDK root: once you have
called `source bin/activate` from the SDK root, `cfx` will remember where the
SDK is, and you will be able to reference SDK packages from any directory.

Keeping your add-on code outside the SDK is good practice as it makes it easier
for you to update the SDK and to manage your code using a version control
system.

Next we'll use `cfx init` to create a skeleton structure for your add-on.
Navigate to the `translator` directory and execute `cfx init`. You should see
something like this:

<pre>
  * lib directory created
  * data directory created
  * tests directory created
  * docs directory created
  * README.md written
  * package.json written
  * tests/test-main.js written
  * lib/main.js written
  * docs/main.md written

  Your sample add-on is now ready for testing:
      try "cfx test" and then "cfx run". Have fun!"
</pre>

First, `cfx init` creates the directory structure your add-on needs:

* `/data` contains resources such as icons or strings. You can access the
content of the `data` subdirectory from within your add-on's code using the
Add-on SDK's [`self`](packages/api-utils/docs/self.html) module.

<span class="aside">*Note that until bug
[614712](https://bugzilla.mozilla.org/show_bug.cgi?id=614712) is fixed, cfx
expects this to be `/docs`.*</span>

* `/doc` contains any documentation for your add-on.

* `/lib` contains the JavaScript modules implementing your add-on.

<span class="aside">*Note that until bug
[614712](https://bugzilla.mozilla.org/show_bug.cgi?id=614712) is fixed, cfx
expects this to be `/tests`.*</span>

* `/test` contains unit test code.

Next, `cfx init` creates a file called `package.json` in the root `translator`
directory. This contains information about your add-on and should look
something like this:

<pre>
  {
    "name":"translator",
    "fullName":"translator",
    "description":"This is an example of addon description.",
    "author":"",
    "license":"MPL",
    "version":"0.1"
  }
</pre>

Finally, `cfx init` creates some example files under `docs`, `lib`, and
`tests`: we will replace those.

## Adding Your Code ##

In the `lib` directory, open the file called `main.js` and replace its
contents with the following:

    // Import the APIs we need.
    var contextMenu = require("context-menu");
    var request = require("request");
    var selection = require("selection");

    exports.main = function(options, callbacks) {
      console.log(options.loadReason);

      // Create a new context menu item.
      var menuItem = contextMenu.Item({

        label: "Translate Selection",

        // Show this item when a selection exists.

        context: contextMenu.SelectionContext(),

        // When this item is clicked, post a message to the item with the
        // selected text and current URL.
        contentScript: 'on("click", function () {' +
                       '  var text = window.getSelection().toString();' +
                       '  postMessage(text);' +
                       '});',

        // When we receive the message, call the Google Translate API with the
        // selected text and replace it with the translation.
        onMessage: function (text) {
          if (text.length == 0) {
            throw ("Text to translate must not be empty");
          }
          console.log("input: " + text)
          var req = request.Request({
            url: "http://ajax.googleapis.com/ajax/services/language/translate",
            content: {
              v: "1.0",
              q: text,
              langpair: "|en"
            },
            onComplete: function (response) {
              translated = response.json.responseData.translatedText;
              console.log("output: " + translated)
              selection.text = translated;
            }
          });
          req.get();
        }
      });
    };

    exports.onUnload = function (reason) {
      console.log(reason);
    };


### Importing Modules ###

The first three lines are used to import three SDK modules from the
addon-kit package:

* [`context-menu`](packages/addon-kit/docs/context-menu.html) enables add-ons
to add new items to the context menu
* [`request`](packages/addon-kit/docs/request.html) enables add-ons to make
network requests
* [`selection`](packages/addon-kit/docs/selection.html) gives add-ons access
to selected text in the active browser window

### Creating a Context Menu Item ###

Next, this code constructs a context menu item. It supplies:

* the name of the item to display: "Translate Selection"
* a context in which the item should be displayed: `SelectionContext()`,
meaning: include this item in the context menu whenever some content on the
page is selected
* a script to execute when the item is clicked: this script sends the selected
text to the function assigned to the `onMessage` property
* a value for the `onMessage` property: this function will now be called with
the selected text, whenever the user clicks the menu. It uses Google's
AJAX-based translation service to translate the selection to English and sets
the selection to the translated text.

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

This particular add-on doesn't need to use `exports.main` or `exports.onUnload`
for anything, and only includes them to illustrate their use.

### Logging ###

Note the calls to `console.log()` here. `console` is a global object accessible
by any module, which you can use to write error, warning, or informational
messages.

For an extension which has been packaged as an XPI file and installed into
Firefox, the messages are sent to Firefox's
[Error Console](https://developer.mozilla.org/en/Error_Console). If you are
launching Firefox from the command line using `cfx`, as you will be for
development and debugging, then the messages are sent to the command shell
from which you launched Firefox.

For more information on the `console` object see the
[Globals](dev-guide/addon-development/globals.html) reference section.

## Running It ##

To run your program, navigate to the `translator` directory and type:

<pre>
  cfx run
</pre>

The first time you do this, you'll see a message like this:

<pre>
  No 'id' in package.json: creating a new keypair for you.
  package.json modified: please re-run 'cfx run'
</pre>

Run it again, and it will run an instance of Firefox with your add-on
installed.

The ID that `cfx` generated the first time you executed `cfx run` is a unique
identifier for you add-on called the **Program ID** and it is important. It is
used by various tools and services to distinguish this add-on from any other.

To learn more about the Program ID refer to the
[Program ID](dev-guide/addon-development/program-id.html) document.

Once `cfx run` has launched Firefox you can try out the new add-on. Load a
page containing some text that is not in English, for example:
[http://www.mozilla.org/about/manifesto.fr.html](http://www.mozilla.org/about/manifesto.fr.html)

Select some text on that page and right-click to activate the context menu.
You should see a new item labeled "Translate Selection":

![translator context-menu](media/screenshots/translator/context-menu-osx.png)

Select that item and the text you selected should be replaced with its English
translation:

![translator context-menu](media/screenshots/translator/translated-osx.png)

You will also see output like this appear in your command shell:

<pre>
  info: input: Le projet Mozilla est une communauté mondiale de personnes
  qui pensent que l'ouverture, l'innovation et la saisie des chances qui nous
  sont offertes sont les clés de la vitalité d'Internet. Nous travaillons
  ensemble depuis 1998 pour nous assurer qu'Internet se développe d'une manière
  qui bénéficie à tout le monde. On nous connaît surtout pour la création du
  navigateur Web Mozilla Firefox.
  info: output: The Mozilla project is a global community of people who believe
  that openness, innovation and seizing opportunities offered to us are the
  keys to the vitality of the Internet. We have been working together since
  1998 to ensure that the Internet develops in a way that benefits everyone.
  We are best known for creating the Mozilla Firefox Web browser.
</pre>

## Preparing Your Add-on for Deployment ##

Once you have finished testing your add-on you can package it for deployment
like any other Firefox add-on, as a XPI file. The Add-on SDK simplifies the
packaging process by generating this file for you.

To package your program as a XPI, navigate to the root of your package
directory in your shell and run `cfx xpi`. You should see a message:

<pre>
  Exporting extension to translator.xpi.
</pre>

The `translator.xpi` file can be found in the directory in which you ran
the command.

## Installing the Package ##

Test that the package installs correctly by adding it to your own Firefox
installation.

You can do this by pressing the Ctrl+O key combination (Cmd+O on Mac) from
within Firefox. This will bring up a file selection dialog: navigate to the
`translator.xpi` file, open it and follow the prompts to install the
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
