
# Using the SDK with XUL extensions #

<div class="warning">
Note that the technique described here doesn't work in the current version of
the SDK, but we're working on a replacement.
<a href="http://groups.google.com/group/mozilla-labs-jetpack/browse_thread/thread/356a7fd464b1043c/ca4e885dfd19edab?lnk=gst&q=xul+extensions#ca4e885dfd19edab"> Check the mailing list</a>
for more details.
</div>

With the Add-on SDK you can use modules in a regular XUL-based extension. This
can be helpful if you want to use some of SDK APIs, if you like the way
modules help separate your code into testable and re-usable pieces,
or if you'd like to gradually migrate an existing extension over to the SDK.

Running an SDK-based add-on in Firefox
------------------
We assume you have already completed the
[Getting Started](dev-guide/addon-development/getting-started.html) tutorial.
You should have a package called `translator` (including a `package.json`
manifest) and modules named `translator` and `main`.

You have used `cfx run` to run the program, which creates a
[key pair](/dev-guide/addon-development/program-id.html) for you.

Getting your XUL extension to run with Add-on SDK
------------------
<span class="aside">
There's only one interesting file in the template extension - the `harness.js`
component that provides the CommonJS module loader (the `require()`
implementation) and bootstraps the add-on (i.e. starts its `main` program or
runs tests).
</span>
Copy the extension template the SDK uses to run add-ons from
`addon-sdk/python-lib/cuddlefish/app-extension` to your own folder, for
example `addon-sdk/packages/translator/extension`.

Copy your other extension files to `addon-sdk/packages/my-extension/extension`
(`components`, `chrome.manifest` and chrome files, etc).

Now you can run Firefox with your XUL extension *and* our test module installed
by executing the following command from the package folder,
`addon-sdk/packages/my-extension`:

<pre>
  cfx run -t extension
</pre>

(The `-t` parameter is actually the path to the folder with the "template"
extension to install when running the specified application).

Loading modules from extension's code
------------------
To load modules we'll need to get the harness XPCOM service provided by the SDK.
This service has contract ID
`@mozilla.org/harness-service;1?id=<package id>`, where *&lt;package-id>*
is the programs "JID", found in `package.json` as the `id` key.

<span class="aside">
The specified ID will also be used as `em:id` in `install.rdf` when building
an XPI with `cfx xpi`, but with a `@jetpack` suffix to fulfill the rules of
add-on identifiers.
</span>

The first time you invoke `cfx xpi` or `cfx run`, the `cfx` tool will modify
your `package.json` (if necessary) provide you with an `id` value. The result
will look something like this:

<pre>
  {
    "id": "jid0-i6WjYzrJ0UFR0pPPM7Znl3BvYbk",
    // other properties here
  }
</pre>

Now we can use CommonJS modules from regular extension code using this code:

    function loadSDKModule(module) {
      return Components.classes[
        "@mozilla.org/harness-service;1?id="jid0-i6WjYzrJ0UFR0pPPM7Znl3BvYbk"].
        getService().wrappedJSObject.loader.require(module);
    }
    loadSDKModule("translator").translate("Bonjour tout le monde", function(translation) {
      alert(translation);
    });

You can test this code by pasting it into the Error Console of the Firefox
instance that appears when you use `cfx run -t extension`.

Packaging the extension into an XPI
------------------
As with regular add-ons, you can use `cfx` to create an XPI from your package:

<pre>
  cfx xpi -t extension
</pre>

**Note 1**: `cfx` attempts to update the `install.rdf` with the package metadata, so if
you get RDF-related errors when using that, try using `install.rdf` from the
default template (bug 556072).

**Note 2**: the tests for modules are not included in the created XPI.
