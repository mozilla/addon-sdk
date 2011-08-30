# Installation #

## Prerequisites

To develop with the Add-on SDK, you'll need:

* [Python](http://www.python.org/) 2.5 or 2.6. Note that versions 3.0 and 3.1
  of Python are not supported. Make sure that Python is in your path.

* Firefox version 4.0 or later.

At the moment, the latest stable version of the Add-on SDK is 1.1.
You can obtain it as a
[tarball](https://ftp.mozilla.org/pub/mozilla.org/labs/jetpack/jetpack-sdk-latest.tar.gz)
or a [zip file](https://ftp.mozilla.org/pub/mozilla.org/labs/jetpack/jetpack-sdk-latest.zip).
Alternatively, you can get the latest development version of the
Add-on SDK from its [GitHub repository](https://github.com/mozilla/addon-sdk).

## Installation on Mac OS X / Linux ##

Extract the file contents wherever you choose, and navigate to the root
directory of the SDK with a shell/command prompt. For example:

<pre>
  ~/mozilla > tar -xf addon-sdk-1.1.tar.gz
  ~/mozilla > cd addon-sdk-1.1
  ~/mozilla/addon-sdk-1.1 >
</pre>

Then run:

<pre>
  ~/mozilla/addon-sdk-1.1 > source bin/activate
</pre>

Your command prompt should now have a new prefix containing the name of the
SDK's root directory:

<pre>
  (addon-sdk-1.1)~/mozilla/addon-sdk-1.1 >
</pre>

## Installation on Windows ##

Extract the file contents wherever you choose, and navigate to the root
directory of the SDK with a shell/command prompt. For example:

<pre>
  C:\Users\mozilla\sdk>7z.exe x addon-sdk-1.1.zip
  C:\Users\mozilla\sdk>cd addon-sdk-1.1
  C:\Users\mozilla\sdk\addon-sdk-1.1>
</pre>

Then run:

<pre>
  C:\Users\mozilla\sdk\addon-sdk-1.1>bin\activate
</pre>

You might see an error like this:

<pre>
  ERROR: The system was unable to find the specified registry key or value.
</pre>

This is a known issue, being tracked as
[bug 574563](https://bugzilla.mozilla.org/show_bug.cgi?id=574563), and should
not affect the proper functioning of the SDK at all.

Your command prompt should now have a new prefix containing the full path to
the SDK's root directory:

<pre>
  (C:\Users\mozilla\sdk\addon-sdk-1.1) C:\Users\Work\sdk\addon-sdk-1.1>
</pre>

## SDK Virtual Environment ##

The new prefix to your command prompt indicates that your shell has entered
a virtual environment that gives you access to the Add-on SDK's command-line
tools.

At any time, you can leave a virtual environment by running `deactivate`.

The virtual environment is specific to this particular command prompt. If you
close this command prompt, it is deactivated and you need to type
`source bin/activate` or `bin\activate` in a new command prompt to reactivate
it. If you open a new command prompt, the SDK will not be active in the new
prompt.

You can have multiple copies of the SDK in different locations on disk and
switch between them, or even have them both activated in different command
prompts at the same time.

## Sanity Check ##

Run this at your shell prompt:

<pre>
  ~/mozilla/addon-sdk-1.1 > cfx
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
