# Implementing Reusable Modules #

So far we've seen how you can use the SDK to build a simple add-on. But you
can also use the SDK to create reusable CommonJS modules with clearly defined
APIs. These modules are then usable by any other program which follows the
CommonJS standard, including other add-ons built using the SDK.

Even if you do not expect to provide reusable modules to other developers, it
can often make sense to structure a larger or more complex add-on as a
collection of modules. This makes the design of the add-on easier to understand
and provides some encapsulation as each module will export only what it chooses
to, so you can change the internals of the module without breaking its users.

In this example we'll start with the [translator
add-on](dev-guide/addon-development/implementing-simple-addon.html), and create
a separate module containing the code that performs the translation.

## Implementing "translate.js" ##

In the `lib` directory under your translator's root, create a new file called
`translate.js` with the following contents:

    // Import the APIs we need.
    var request = require("request");

    // Define the 'translate' function using Request
    function translate(text, callback) {
      if (text.length === 0) {
        throw ("Text to translate must not be empty");
      }
      var req = request.Request({
        url: "http://ajax.googleapis.com/ajax/services/language/translate",
        content: {
          v: "1.0",
          q: text,
          langpair: "|en"
        },
        onComplete: function (response) {
          callback(response.json.responseData.translatedText);
        }
      });
      req.get();
    }

    // Export the 'translate' function
    exports.translate = translate;


The `translate` function here is essentially the same as the listener function
assigned to `onMessage` in the original code, except that it calls a callback
with the translation instead of assigning the result directly to the selection.

We export the function by adding it to the global `exports` object.

## Editing "main.js" ##

Next we edit `main.js` to make it use our new module rather than the `request`
module:

    // Import the APIs we need.
    var contextMenu = require("context-menu");
    var selection = require("selection");
    var translate = require("translate");

    exports.main = function(options, callbacks) {
      console.log(options.loadReason);

      // Create a new context menu item.
      var menuItem = contextMenu.Item({
        label: "Translate Selection",
        // Show this item when a selection exists.
        context: contextMenu.SelectionContext(),
        // When this item is clicked, post a message to the item with the
        // selected text and current URL.
        contentScript: 'self.on("click", function () {' +
                       '  var text = window.getSelection().toString();' +
                       '  self.postMessage(text);' +
                       '});',

        // When we receive the message, call the translator with the
        // selected text and replace it with the translation.
        onMessage: function (text) {
          translate.translate(text, function(translation) {
                                        selection.text = translation; })
        }
      });
    };

    exports.onUnload = function (reason) {
      console.log(reason);
    };


Next, execute `cfx run` again, and try out the add-on. It should work in
exactly the same way as the previous version, except that now the core
translate function has been made available to other parts of your add-on or
to *any other program* that imports it.

## Testing Your Module ##

The SDK provides a framework to help test any modules you develop. To
demonstrate this we will add some slightly unlikely tests for the translator
module.

Navigate to the `test` directory and delete the `test-main.js` file. In its
place create a file called `test-translate.js` with the following contents:

    var translate = require("translator/translate")
    var testRunner;
    var remainingTests;

    function check_translation(translation) {
      testRunner.assertEqual("Lizard", translation);
      testRunner.done();
    }

    function test_languages(test, text) {
      testRunner= test;
      testRunner.waitUntilDone(2000);
      translate.translate(text, check_translation);
    }

    exports.test_german = function(test) {
      test_languages(test, "Eidechse");
    }

    exports.test_italian = function(test) {
      test_languages(test, "Lucertola");
    }

    exports.test_finnish = function(test) {
      test_languages(test, "Lisko");
    }

    exports.test_error = function(test) {
      test.assertRaises(function() {
        translate.translate("", check_translation);
      },
      "Text to translate must not be empty");
    };

This file exports four functions, each of which expects to receive a single
argument which is a `test` object. `test` is supplied by the
[`unit-test`](packages/api-utils/docs/unit-test.html) module and provides
functions to simplify unit testing. The file imports one module, the
`translate` module that lives in our `translator` package. The
`PACKAGE/MODULE` syntax lets you identify a specific module in a specific
package, rather than searching all available packages (using, for example,
`require("request")`). The
[module-search](dev-guide/addon-development/module-search.html) documentation
has more detail.

<span class="aside">
`waitUntilDone()` and `done()` are needed here because the translator is
asynchronous. To test an asynchronous function (a function that completes
using a callback, rather than a return value), you call `test.waitUntilDone(),`
supplying a delay time in milliseconds long enough for the function to
complete. You put the test assertion in the callback, then call `test.done()`
to signal that the test has finished.
</span>

The first three functions call `translate` and in the callback use
`test.assertEqual()` to check that the translation is as expected.

The fourth function tests the translator's error-handling code by passing an
empty string into `translate` and using `test.assertRaises()` to check that the
expected exception is raised.

At this point your package ought to look like this:

<pre>
  /translator
      package.json
      README.md
      /doc
          main.md
      /lib
          main.js
          translate.js
      /test
          test-translate.js
</pre>

Now execute `cfx --verbose test` from under the package root directory.
You should see something like this:

<pre>
  Running tests on Firefox 4.0.1/Gecko 2.0.1 ...
  info: executing 'test-translate.test_german'
  info: pass: a == b == "Lizard"
  info: executing 'test-translate.test_italian'
  info: pass: a == b == "Lizard"
  info: executing 'test-translate.test_finnish'
  info: pass: a == b == "Lizard"
  info: executing 'test-translate.test_error'
  info: pass: a == b == "Text to translate must not be empty"
  4 of 4 tests passed.
  OK
</pre>

What happens here is that `cfx test`:

* looks in the `test` directory of your
package

* loads any modules that start with the word `test`
*  calls all their exported functions, passing them a `test` object
implementation as their only argument.

Obviously, you don't have to pass the `--verbose` option to `cfx` if you don't
want to; doing so just makes the output easier to read.

## Next: Introducing the SDK's APIs ##

Next we'll summarize the
[APIs provided by the SDK](dev-guide/addon-development/api-intro.html).

