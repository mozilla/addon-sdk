
# Using the SDK with XUL extensions #

With the Add-on SDK you can use modules in a regular XUL-based extension. This
can be helpful if you want to use some of SDK APIs, if you like the way
modules help separate your code into testable and re-usable pieces,
or if you'd like to gradually migrate an existing extension over to the SDK.

Quick start
------------------
Creating a XUL-based extension with the SDK is very similar to creating a
regular Add-on SDK extension. We assume you have already completed the
[Getting Started](dev-guide/addon-development/getting-started.html) tutorial
and will only focus on the steps specific to XUL extensions here.

To get started, [run activate](dev-guide/addon-development/installation.html),
create an empty directory, navigate to it, and run:
<pre>
  cfx init --template xul
</pre>

This creates all the necessary files, so you can run the extension, its tests,
and build the XPI right away. The `cfx` syntax is exactly the same as for the
regular SDK-based extensions:
<pre>
  cfx test
  cfx run
  cfx xpi
</pre>

You can create your own modules, tests, and use the modules provided by the SDK
in a XUL extension, just like you can do in a regular SDK-based extension. The
only two differences are:

 * Restarting the application is required to install (uninstall, disable,
   upgrade and so on) a XUL-based extension.
 * XUL-based extensions can use the functionality unavailable to bootstrapped
   (restartless) extensions, like using [chrome.manifest](https://developer.mozilla.org/en/Chrome_Registration)
   to register overlays and to define user interface in XUL.

The home for your XUL files
------------------
When you ran `cfx init`, it created a directory named `extension` in the
current directory (alongside `lib`, `tests`, and others).

The files and directories that are not managed by the SDK (XUL, locale, skins,
default preferences, XPCOM components and modules, and others) should be placed
in this directory.

Note that there are already a few files and directories here. Some of them are
necessary for the SDK-based functionality (`cfx test` and the module system,
in particular) to work. We'll discuss their roles in a later section.

Loading modules from extension's code
------------------
To load modules we'll need to get the harness XPCOM service provided by the SDK.
This service has contract ID `@mozilla.org/harness-service;1?id=<package id>`,
where *&lt;package-id>* is specified as the `id` key in `package.json`:

    {
      "id": "jid0-i6WjYzrJ0UFR0pPPM7Znl3BvYbk",
      // other properties here
    }


To call the SDK modules from regular extension code use this code:

    function myExtension_loadSDKModule(module) {
      return Components.classes[
        "@mozilla.org/harness-service;1?id=jid0-i6WjYzrJ0UFR0pPPM7Znl3BvYbk"].
        getService().wrappedJSObject.loader.require(module);
    }
    myExtension_loadSDKModule("notifications").notify({text: "Hello world!"});

You can test it by pasting into the Error Console of the Firefox
instance that appears when you use `cfx run`.

Pre-generated files in a XUL-based extension
------------------

The extension created by `cfx init --template xul` has a few additional files
and keys not present in a regular SDK extension. This section explains their
purpose:

* `extension/components/harness.js` - is the heart of any SDK-based add-on. It
  handles the startup and shutdown process of the module-based part of the
  extension. Note that this file is copied from the SDK
  (`python-lib/cuddlefish/app-extension/components/harness.js`) to your
  extension, so you may need to update it manually when upgrading the SDK.
* `extension/chrome.manifest` contains the instructions
  [required to register `harness.js` in Firefox 4] [mdc-xpcom-registration].
  Be careful not to overwrite the three instructions (`component`, `contract`,
  and `category`) when adding your own stuff to chrome.manifest.
* `extension/install.rdf` is the extension's [install manifest] [mdc-install]. It
  will be updated with [information from package.json] [package-spec] when you
  run `cfx xpi`, but for attributes that can not be specified in package.json,
  you'll have to edit the manifest directly.
* `extension/modules/module.jsm` is an example of using functionality
   available only to XUL extensions and is used only in `tests/test-module.js`.
   You can safely remove both files, along with the reference to it in
   the `chrome.manifest`.
* `package.json` has two attributes specific to XUL-based extensions:
    * `templatedir` lets `cfx` know about the `extension` directory with your
      XUL files.
    * `harnessClassID` matches the classID of the harness component specified
      in chrome.manifest. It's passed on to the `harness.js` component by
      `cfx`, so that the generic code in harness.js knows what classID it's
      supposed to respond to.

  [mdc-xpcom-registration]: https://developer.mozilla.org/en/XPCOM/XPCOM_changes_in_Gecko_2.0#Component_registration
  [mdc-install]: https://developer.mozilla.org/en/Install_manifests
  [package-spec]: dev-guide/addon-development/package-spec.html
