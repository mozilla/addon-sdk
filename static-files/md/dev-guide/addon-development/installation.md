# Installation #

To develop with the Add-on SDK, you'll need:

* [Python](http://www.python.org/) 2.5 or 2.6. Note that versions 3.0 and 3.1
  of Python are not supported. Make sure that Python is in your path.

* A version of Firefox that uses Gecko 2.0.0.7 or later
  (for example, Firefox 4.0).

At the moment, the latest stable version of the Add-on SDK is 1.0b5.
You can obtain it as a
[tarball](https://ftp.mozilla.org/pub/mozilla.org/labs/jetpack/jetpack-sdk-latest.tar.gz)
or a [zip file](https://ftp.mozilla.org/pub/mozilla.org/labs/jetpack/jetpack-sdk-latest.zip).
Alternatively, you can get the latest development version of the
Add-on SDK from its [GitHub repository](https://github.com/mozilla/addon-sdk).

Extract the file contents wherever you choose, and navigate to the root
directory of the SDK with a shell/command prompt. For example:

<pre>
  ~/mozilla > tar -xf addon-sdk-1.0b5.tar.gz
  ~/mozilla > cd addon-sdk-1.0b5
  ~/mozilla/addon-sdk-1.0b5 >
</pre>

Then, if you're on Linux, OS X, or another Unix-based system, run:

<pre>
  ~/mozilla/addon-sdk-1.0b5 > source bin/activate
</pre>

Otherwise, if you're on Windows, run:

<pre>
  C:\Users\Mozilla\addon-sdk-1.0b5> bin\activate
</pre>

Now the beginning of your command prompt should contain the text
`(addon-sdk)`, which means that your shell has entered a special
virtual environment that gives you access to the Add-on SDK's
command-line tools.

At any time, you can leave a virtual environment by running
`deactivate`.

The virtual environment is specific to this particular command prompt. If you
close this command prompt, it is deactivated and you need to type
`source bin/activate` in a new command prompt to reactivate it. If
you open a new command prompt, the SDK will not be active in the new prompt.

You can have multiple copies of the SDK in different locations on disk and
switch between them, or even have them both activated in different command
prompts at the same time.

## Sanity Check ##

Run this at your shell prompt:

<pre>
  ~/mozilla/addon-sdk-1.0b5 > cfx
</pre>

It should produce output whose first line looks something like this, followed by
many lines of usage information:

<pre>
  Usage: cfx [options] [command]
</pre>

This is the `cfx` command-line program.  It's your primary interface to the
Add-on SDK.  You use it to launch Firefox and test your add-on, package your
add-on for distribution, view documentation, and run unit tests.

## cfx docs ##

If you're reading these documents online, try running `cfx docs`. This will
run a self-hosted documentation server and open it in your web browser.

## Problems? ##

Try the [Troubleshooting](dev-guide/addon-development/troubleshooting.html)
page.

## Next Steps ##

Next, take a look at the
[Getting Started](dev-guide/addon-development/getting-started.html) tutorial,
which explains the basic concepts behind the SDK and walks through a simple
example.
