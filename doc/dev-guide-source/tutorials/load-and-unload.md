<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

# Listening for Load and Unload #

<span class="aside">
To follow this tutorial you'll need to have
[installed the SDK](dev-guide/tutorials/installation.html)
and learned the
[basics of `cfx`](dev-guide/tutorials/getting-started-with-cfx.html).
</span>

## exports.main() ##

Your add-on's `main.js` code is executed as soon as it is loaded. It is loaded
when it is installed, when it is enabled, or when Firefox starts.

If your add-on exports a function called `main()`, that function will be
called immediately after main() will be invoked a moment after the overall
`main.js` is evaluated, and after all top-level require() statements have
run (so generally after all dependent modules have been loaded).

    exports.main = function (options, callbacks) {};

`options` is an object describing the parameters with which your add-on was
loaded.

### options.loadReason ###

`options.loadReason` is one of the following strings
describing the reason your add-on was loaded: 

<pre>
install
enable
startup
upgrade
downgrade
</pre>

### options.staticArgs ###

You can use the [`cfx`](dev-guide/cfx-tool.html)
`--static-args` option to pass arbitrary data to your
program.

The value of `--static-args` must be a JSON string. The object encoded by the
JSON becomes the `staticArgs` member of the `options` object passed as the
first argument to your program's `main` function. The default value of
`--static-args` is `"{}"` (an empty object), so you don't have to worry about
checking whether `staticArgs` exists in `options`.

For example, if your `main.js` looks like this:

    exports.main = function (options, callbacks) {
      console.log(options.staticArgs.foo);
    };

And you run cfx like this:

<pre>
  cfx run --static-args="{ \"foo\": \"Hello from the command line\" }"
</pre>

Then your console should contain this:

<pre>
info: Hello from the command line
</pre>

The `--static-args` option is recognized by `cfx run` and `cfx xpi`.
When used with `cfx xpi`, the JSON is packaged with the XPI's harness options
and will therefore be used whenever the program in the XPI is run.`

## exports.onUnload() ##

If your add-on exports a function called `onUnload()`, that function
will be called when the add-on is unloaded.

    exports.onUnload = function (reason) {};

<span class="aside">
Note that if your add-on is unloaded with reason `disable`, it will not be
notified about `uninstall` while it is disabled: see
bug [571049](https://bugzilla.mozilla.org/show_bug.cgi?id=571049).
</span>

`reason` is one of the following strings describing the reason your add-on was
unloaded:

<pre>
uninstall
disable
shutdown
upgrade
downgrade
</pre>

You don't have to use `exports.main()` or `exports.onUnload()`. You can just place
your add-on's code at the top level instead of wrapping it in a function
assigned to `exports.main()`. It will be loaded in the same circumstances, but
you won't get access to the `options` or `callbacks` arguments.
