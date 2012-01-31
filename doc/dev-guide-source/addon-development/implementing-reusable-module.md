<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

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

In this example we'll start with the [wikipanel
add-on](dev-guide/addon-development/implementing-simple-addon.html), and create
a separate module containing the code that loads the panel.

## Implementing "wikipanel.js" ##

In the `lib` directory under your wikipanel's root, create a new file called
`wikipanel.js` with the following contents:

    // Define the 'lookup' function using Panel
    function lookup(item) {
      var panel = require("panel").Panel({
        width: 240,
        height: 320,
        contentURL: getURL(item)
      });
      panel.show();
    }

    // Define a function to build the URL
    function getURL(item) {
      if (item.length === 0) {
        throw ("Text to look up must not be empty");
      }
      return "http://en.wikipedia.org/w/index.php?title=" + item + "&useformat=mobile";
    }

    // Export the 'lookup' and 'getURL' functions
    exports.lookup = lookup;
    exports.getURL = getURL;

The `lookup()` function here is essentially the same as the `lookup()` in the
original code.

Just so we can demonstrate the SDK's unit testing framework, we've also
split the code that creates the URL into its own trivial `getURL()` function.

We export both functions by adding them to the global `exports` object.

## Editing "main.js" ##

Next we edit `main.js` to make it use our new module rather than the `panel`
module:

    // Import the APIs we need.
    var contextMenu = require("context-menu");
    var wikipanel = require("wikipanel");

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
          wikipanel.lookup(item);
        }
      });
    };

Next, execute `cfx run` again, and try out the add-on. It should work in
exactly the same way as the previous version, except that now the core
`lookup()` function has been made available to other parts of your add-on or
to any other module that imports it.

## Testing Your Module ##

The SDK provides a framework to help test any modules you develop. To
demonstrate this we will add a test for the `getURL` function.

Navigate to the `test` directory and delete the `test-main.js` file. In its
place create a file called `test-wikipanel.js` with the following contents:

    var wikipanel = require("wikipanel/wikipanel")

    var referenceURL =
      "http://en.wikipedia.org/w/index.php?title=Mozilla&useformat=mobile";

    function test_getURL(test) {
      test.assertEqual(wikipanel.getURL("Mozilla"), referenceURL);
      test.done();
    }

    function test_empty_string(test) {
      test.assertRaises(function() {
        wikipanel.getURL("");
      },
      "Text to look up must not be empty");
    };

    exports.test_getURL = test_getURL;
    exports.test_empty_string = test_empty_string;

This file:

* exports two functions, each of which expects to receive a single
argument which is a `test` object. `test` is supplied by the
[`unit-test`](packages/api-utils/docs/unit-test.html) module and provides
functions to simplify unit testing.
The first function calls `getURL()` and uses [`test.assertEqual()`](packages/api-utils/docs/unit-test.html#assertEqual(a, b, message))
to check that the URL is as expected.
The second function tests the wikipanel's error-handling code by passing an
empty string into `getURL()` and using
[`test.assertRaises()`](packages/api-utils/docs/unit-test.html#assertRaises(func%2C predicate%2C message))
to check that the expected exception is raised.

* imports one module, the `wikipanel` module that lives in our
`wikipanel` package. The `PACKAGE/MODULE` ("wikipanel/wikipanel") syntax lets
you identify a specific module in a specific package, rather than searching
all available packages (using, for example, `require("request")`). The
[module-search](dev-guide/addon-development/module-search.html) documentation
has more detail on this.

At this point your package ought to look like this:

<pre>
  /wikipanel
      package.json
      README.md
      /doc
          main.md
      /lib
          main.js
          wikipanel.js
      /test
          test-wikipanel.js
</pre>

Now execute `cfx --verbose test` from under the package root directory.
You should see something like this:

<pre>
Running tests on Firefox 7.0.1/Gecko 7.0.1 ({ec8030f7-c20a-464f-9b0e-13a3a9e97384}) under Darwin/x86_64-gcc3.
info: executing 'test-wikipanel.test_empty_string'
info: pass: a == b == "Text to look up must not be empty"
info: executing 'test-wikipanel.test_getURL'
info: pass: a == b == "http://en.wikipedia.org/w/index.php?title=Mozilla&useformat=mobile"

2 of 2 tests passed.
OK
</pre>

What happens here is that `cfx test`:

<span class="aside">Note the hyphen after "test" in the module name.
`cfx test` will include a module called "test-myCode.js", but will exclude
modules called "test_myCode.js" or "testMyCode.js".</span>

* looks in the `test` directory of your
package
* loads any modules whose names start with the word `test-`
*  calls all their exported functions, passing them a `test` object
implementation as their only argument.

Obviously, you don't have to pass the `--verbose` option to `cfx` if you don't
want to; doing so just makes the output easier to read.

## Next: Introducing the SDK's APIs ##

Next we'll summarize the
[APIs provided by the SDK](dev-guide/addon-development/api-intro.html).

