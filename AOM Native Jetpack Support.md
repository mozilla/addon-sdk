# Proposal

There should be a easy way to develop Jetpacks within the browser.  There should not be a need for external
tools to develop Jetpack based add-ons.  All that one should need in order to build a Jetpack should be
available to them with Firefox, in this way a Jetpacks will become first class extensions.

A fundamental step towards the goal above will be to have Firefox understand Jetpack code natively,
without the need to convert the jetpack code base to an old school extension code base.

# Definitions

* [AOM](about:addons) = Add-on manager for Firefox.
* CLI = Command Line Interface.
* Jetpack = CommonJS structured add-ons for Firefox.
* SDK = Shorthand for the Add-on SDK, the new name for Jetpack APIs which are built in to Firefox.
* XPIProvider = The part of the AOM which manages extensions for Firefox.
* [Flightdeck](https://builder.addons.mozilla.org/) = Website used to make extensions development easy.
* [AMO](https://addons.mozilla.org/) = Website used for sharing add-ons in the Mozilla community.
* Scratchpad = A Firefox DevTool for text editing.
* Third Party Modules = Modules made by extensions developers which are not part of the SDK.
* [NPM](https://npmjs.org/) = Node Package Manager

# Use Cases

* Running tests for a Jetpack via Command Line (using Firefox binary) and via the AOM user interface.
* Run add-on tests via user interface from Addon manager.
* Test run an addon with a blank profile (or existing profile) via cli
* Pointing AOM to WIP add-on for development purposes
* Add UI to an add-on manager to initialize & register blank add-on.
* Add support for SDK style add-ons to the Add-on manager, that would use `package.json` and
won't require presence of `install.rdf` or `boostrap.js`.
* Register add-on location from Add-on manager for interactive development purposes.


# Implementation

## Phase 1 (2013 Q4 - 2014 Q1)

In the first phase there will not be any changes to the AOM interface nor to the Firefox CLI, all changes will be to the backend XPIProvider, the SDK cfx tool and the SDK addon startup related code.

The vision here is not to remove the cfx command line tool just yet, but instead to offload or nullify large parts
of the workload it handles while at the same time removing the necessity of using it at all.

### Updating Loader

The `harness-options.json` file will no longer be required, although it will be used for use cases such as running tests.

### Updating XPIProvider

The XPIProvider will need to be updated to support add-ons that have a Jetpack structure.

Therefore, the `XPIProvider` will first look for a `package.json` file, if found it should
read the necessary information from there.  If the `package.json` file does not include a `main`
key then it should assume that there is a `main.js` file in the default locations (root then check for a `lib` folder.

If the `package.json` file is not found, then the `XPIProvider` should check for an `install.rdf`.

If a there is a `package.json` file found,
then the add-on will be assumed to be a Jetpack.  Once
this occurs the XPIProvider will automatically use [a bootstrap.js](https://github.com/mozilla/addon-sdk/blob/master/app-extension/bootstrap.js), which does the following:

* Setting up `resource:` uri(s) for the add-on.
* Creating a `Loader` instance will have to be created.
* Load main module.
* Emit events like `startup`, `shutdown`, and so on [listed here](https://developer.mozilla.org/en-US/docs/Extensions/Bootstrapped_extensions#Bootstrap_entry_points).
* Do a check for required modules and build and cache a `paths.json` file, if one is not provided.

#### Simple Prefs

If no `options.xul` file is provided, then simple prefs will to be created dynamically when the
[`addon-options-displayed` observer service event is fired](https://developer.mozilla.org/en-US/docs/Extensions/Inline_Options#Display_notifications).
If there is an `options.xul` file provided then it will be used and no prefs will be generated.

#### Localization

Since Jetpacks use `.properties` files no converstion should be required, and the `l10n` module
should be made to read directly from these files.

#### Documentation

This is a more minor consideration, but if Jetpacks are treated as first class extensions, as is
proposed here, then the documentation should be available on MDN as all other extension documentation
is, and there should no longer be a need to store the documentation with the cuddlefish CLI.

## Phase 2 (2014 Q2 - ?)

In the second phase we have a few remaining issues to consider.  First will be the AOM interface,
and the second will be the cuddlefish (aka cfx) cli.

### AOM Interface

[Flightdeck](https://wiki.mozilla.org/AMO/FlightDeck) is a tool which which has the following functions/goals:

1. Made extension development easy and rapid
2. Made extension development collaborative
3. Made submitting add-ons to AMO easy.

The latter two functions will be difficult to support within Firefox itself, but not impossible.

#### Rapid extension development within Firefox

Once Firefox natively supports Jetpacks as first class extensions (see Phase 1) rapid developement will
be free, making this functionality easy to discover and utilize for developers will however require
interface changes to the AOM.  These are some suggested changes that may be useful:

1. Some means for creating a new add-on skeleton (similar to the task which `cfx init` provided or
creating a new add-on on Flightdeck).
2. Some means for editing files in an add-on without the requirement for external tools or
file editors (while still allowing external tools/editors to be used).  For example Scratchpad integration.
3. Some means for creating files and adding files to the extension without the need to use external tools.
It should be possible to add images and other media to an extension in development without the need to
use the file system, it should also be possible to create new files for the extension in development without
the need to use the file system or a file editor.

#### Making extension development collaborative

One of the most important features for Flightdeck was the ability to share and reuse third party modules.
In the future this should be done through NPM, ideally it would be possible to use third package modules
available on NPM through Firefox by some means.

#### Submitting Add-ons to AMO

Some sort of AMO integration or streamlined add-on submission process would be ideal.

### Cuddlefish


