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
* [NPM](https://npmjs.org/) = Node Pakage Manager

# Use Cases

* ? Running tests for a Jetpack via Command Line (using Firefox binary) and via the AOM user interface.
* Test run an addon with a blank profile (or existing profile) via cli
* ? Creating a blank/skeleton jetpack add-on via user interface
* Pointing AOM to WIP add-on for development purposes
* Installing a Jetpack, zipped and renamed and a xpi, without the need to convert the Jetpack structure to
  use the old school xpi structure (ie: no need for a install.rdf or bootstrap.js file)

# Implementation

## Phase 1 (2013 Q4 - 2014 Q1)

In the first phase there will not be any changes to the AOM interface, all changes will be to the backend
XPIProvider, and possibly the Firefox CLI.

### Updating XPIProvider

The XPIProvider will need to be updated to support add-ons that have a Jetpack structure.
This structure doesn't not include an `install.rdf`, or a `bootstrap.js` file, although it is restartless.
Therefore, after looking for an `install.rdf` the `XPIProvider` should look for `package.json` file
and read the necessary information from there.  If the `package.json` file does not include a `main`
key then it should assume that there is a `main.js` file in the default locations (root then check for a `lib` folder.

If a `bootstrap.js` file is found, then the add-on will be assumed to be a Jetpack.  Once
this occurs the XPIProvider will have to do the work that [this file used to do](https://github.com/mozilla/addon-sdk/blob/master/app-extension/bootstrap.js), which includes:

* Setting up `resource:` uri(s) for the add-on.
* Creating a `Loader` instance will have to be created.
* Emit events like `startup`, `shutdown`, and so on [listed here](https://developer.mozilla.org/en-US/docs/Extensions/Bootstrapped_extensions#Bootstrap_entry_points).
* Do a check for required modules and build a `harness-options.json` file, if one is not provided.

#### Tests

Running `cfx test` on an add-on will either have to:

1. Generate a `harness-options.json` file which causes
`sdk/test/runner` to be invovked as the `main.js` file for the add-on, this means that
`harness-options.json` will be an important hidden file which developers should not try to
use and be warned against using.
2. Use a CLI flag to indicate which add-ons should be tested after startup.

#### Localization

Since Jetpacks use `.properties` files no converstion should be required, and the `l10n` module
should be made to read directly from these files.

#### Documentation

This is a more minor consideration, but if Jetpacks are treated as first class extensions, as is
proposed here, then the documentation should be available on MDN as all other extension documentation
is, and there should no longer be a need to store the documentation with the cuddlefish CLI.

## Phase 2 (2014 Q2)

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
