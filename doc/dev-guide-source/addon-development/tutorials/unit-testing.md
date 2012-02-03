# Unit Testing #

<span class="aside">
To follow this tutorial you'll need to have
[installed the SDK](dev-guide/addon-development/tutorials/installation.html),
learned the
[basics of `cfx`](dev-guide/addon-development/tutorials/getting-started-with-cfx.html),
and followed the tutorial on
[writing reusable modules](dev-guide/addon-development/tutorials/reusable-modules.html).
</span>

The SDK provides a framework to help creates and run unit tests for
your code. test any modules you develop. To demonstrate how it works
we'll write some unit tests for the "geolocation" module from the
tutorial on
[writing reusable modules](dev-guide/addon-development/tutorials/reusable-modules.html).

If you need a copy of the module you can download it from its [GitHub repository](https://github.com/wbamberg/geolocation/zipball/1.0).

The "geolocation" module exports a function called `getCurrentPosition()`
which retrieves the user's location if they agree to share it. When it
asks the user's permission it prompts them to select one of four options:

* yes, this time
* not this time
* always
* never

If the user selects "always" or "never" then the function stores that choice
as a preference, and next time does not prompt them. We'll write some unit
tests to check that this code works properly.

Navigate to the root "geolocation" directory, create a directory called
"test", and in it, create a file called "test-geolocation.js" with the
following contents:

The SDK provides a framework to help creates and run unit tests for your code.
test any modules you develop. To
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

