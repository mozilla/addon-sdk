# Proposal

There should be a easy way to develop Jetpacks within the browser.  There should not be a need for external
tools to develop Jetpack based add-ons, or tests.  All that one should need in order to build a Jetpack should be
available to them with Firefox, in this way Jetpacks will become first class extensions and Firefox
development tool.

A fundamental step towards this goal will be to have Firefox understand Jetpack code natively,
without the need to convert the jetpack's code base (using `package.json` etc) to a bootstrap extension code base
(using `install.rdf` etc).

# Definitions

* [AOM](about:addons) = Add-on manager for Firefox.
* Add-on = A traditional extension, bootstrap extension, and sdk extension all apply.
* Traditional Extension = Old schoold add-ons which required a restart to install and a `install.rdf` file with a `chrome.manifest` file in their root.
* Bootstrap Extensions = Newer style restartless add-on which required a `install.rdf` and a `bootsrap.js` file.
* Native Jetpack / SDK Extension = The type of add-on proposed in this document, which uses a `package.json` and some main js file which is either index.js or defined in the `package.json` manifest.
* Jetpack = CommonJS structured add-ons and tests for Firefox, of old (a bootstrap.js extension) and of new (an SDK extension).
* SDK = Shorthand for the Add-on SDK, the new name for Jetpack APIs which are built in to Firefox.
* SDK Test = An SDK extensions which is meant to be purely a test, not an extension with tests,
like [these current test add-ons](https://github.com/mozilla/addon-sdk/tree/1.15/test/addons).
* XPIProvider = The part of the AOM which manages extensions for Firefox.
* [Flightdeck](https://builder.addons.mozilla.org/) = Website used to make extensions development easy.
* [AMO](https://addons.mozilla.org/) = Website used for sharing add-ons in the Mozilla community.
* [Scratchpad](https://developer.mozilla.org/docs/Tools/Scratchpad) = A Firefox DevTool for text editing.
* Third Party Modules = Modules made by extensions developers which are not part of the SDK.
* [NPM](https://npmjs.org/) = Node Package Manager
* [JPM]((https://github.com/jsantell/jpm)) = Jetpack Manager
* CFX / Cuddlefish = The existing python command line tool to run, xpi, test, and do more for current Jetpack bootstrap extensions.

# Use Cases

* Running tests for a SDK extensions via Command Line or via the AOM user interface.
* Run an SDK extension with a blank profile (or existing profile) via cli
* Pointing AOM to work in progress unpacked bootstrap or SDK extensions for development purposes
* Add UI to the AOM to initialize & register blank add-ons (perhaps only SDK extensions).
* Add support for SDK extensions to the AOM, that would use `package.json` and
won't require presence of `install.rdf` or `boostrap.js`.
* Allow SDK extensions to be written which are purely tests (see [bug 852538](https://bugzilla.mozilla.org/show_bug.cgi?id=852538)).
* Opening an unpacked add-on in Scratchpad or something like it.

## Possibilities for the future

* Running SDK extension tests via Firefox binary command line options.

# Implementation

## Phase 1

In the first phase there will not be any changes to the AOM interface nor to the Firefox CLI;
all changes will be to the backend XPIProvider, the SDK cfx tool the SDK `bootstrap.js`, loader, and various other modules.
These are the important first steps, from here many different directions can be taken.

The vision here is to keep the cfx command line tool for now, and offload or nullify large parts
of the workload it handles.  There will still be a
desire for a cli tool, so the goal here is to make the instructions so simple that this tool set we are familiar with
(namely `cfx run`, `cfx xpi`, `cfx test`) will be possible for anyone to reproduce in any language
that they desire, or integrate into their toolchain, or build upon to make userscript/userstyle/webapp to SDK extension converting
command line tools.

### The Future of Cuddlefish

This will be the end of life for our cuddlefish/cfx command line tool (for reasons stated above)
as a thing that is meant for community use, if it exists at all then it will be a small fragment of
what it used to be.

The new tool is [jpm](https://github.com/mozilla/jpm).

Here is what is happening to the old `cfx` commands:

* `cfx init`: Will be handled by `jpm init`.
* `cfx xpi`: Will be handled by `jpm xpi`.
* `cfx run`: Will be handled by `jpm run`.
* `cfx test` (if used an add-on): Will be handled by `jpm test`.
* `cfx testall`: Will be handled by a simple script, my preference would be to use node, but this will probably need
to be used by m-c to run their test suite so it should probably be done in python and thus we may be able to use cfx here.
* `cfx docs`: The docs have been migrated (see [bug 948606](https://bugzilla.mozilla.org/show_bug.cgi?id=948606))

#### ON JPM

There are many things which jpm may need to do in order to provide the same power to
the community that the cfx tool has provided.  This does not mean it will be difficult to
craft one's own version of the tool however, and this is beacuse the core functionality
is extremely simple, and the rest is just loads of sugar (aka non-essentials).

##### JPM Core

* `jpm xpi` is essentially a wrapper for zip, with the potential for all kinds of sugar.
* `jpm run` will run `jpm xpi`, create a blank firefox profile with the extension, and run firefox with that profile.
* `jpm test` will run `jpm run` and run the profile with extra preferences which provide information for the sdk/test/options module.

Note: `jpm run` could be simplified by adding a (or multiple) commaind line option(s) to Firefox which
would create temporary blank profiles, and run a profile with a restartless add-on (and tear it out on shutdown), but
I don't think this is fruitful path to explore intially because there are so many libraries that help
us do these things already.

[The JPM code base can be found here](https://github.com/mozilla/jpm).

#### On Running SDK Tests

The SDK has these current `cfx` test suites:

* `testaddons` which are SDK tests.
* `testex` which are SDK extensions with tests.
* `testpkgs` which test the SDK modules built-in to Firefox.
* `testcfx` which tests cfx itself.
* `test` which tests a third party package or SDK extension.

All of these tests can be done with `jpm test`.
So I suggest we replace/simplify these `cfx test*` variations with
a python harness (we are currently working on a Mochitest implementation) that can handle the `testaddons`, `testex`, `testpkgs` use cases, then the `test` use case will be handled by `jpm test`
and `jpm` has tests for itself to replace the `testcfx` tests.

### Updating Loader

There is also a parallel project to support node dependencies (see [bug 935109](https://bugzilla.mozilla.org/show_bug.cgi?id=935109)) which can be integrated into this plan, since the changes are overlapping and
because this project is the solution to our legacy dependency handling which would bloat `jpm xpi`
and which we've already decided should be replaced
by leverging NPM's infrustructure which is more sane than building our own.

Note: I do not suggest we tie ourseleves to NodeJS, if there is other popular CommonJS package manager that comes along then we should try to leverage that too in my opionion.

### Updating XPIProvider

The XPIProvider will need to be updated to support SDK extensions.

Therefore, the `XPIProvider` will first look for a `package.json` file, if found it should
read the necessary information from there.  If the `package.json` file does not include a `main`
key then it should assume that there is a `index.js` file in the add-on root.

If the `package.json` file is not found, then the `XPIProvider` should check for an `install.rdf`.
This way an add-on can be built to support older versions of Firefox and the latest version by
providing both an `install.rdf` and a `package.json` file.

If there is a `package.json` file found,
then the add-on will be assumed to be a Jetpack.  Once
this occurs the XPIProvider will automatically use [a bootstrap.js](https://github.com/mozilla/addon-sdk/blob/master/app-extension/bootstrap.js), which does the following:

* Setting up a `resource:` uri for the add-on root, derived from the add-on's id.
* Do a check for required modules and build and cache a `modules.json` file, if one is not provided (this
  installation time generation of the `modules.json` could be controlled by a pref, which is off by default, in
  order to optimize installations for non developers, if it is needed) caching could be done only if there is some preference).
* Creating a `Loader` instance will have to be created.
* Load main module.
* Emit events like `startup`, `shutdown`, and so on [listed here](https://developer.mozilla.org/docs/Extensions/Bootstrapped_extensions#Bootstrap_entry_points).

Note: the XPIProvider will not handle any Jetpack module dependency work, and that work will be conducted
by the cached `JetpackBootstrap.js` (similar to the [SpellCheckDictionaryBootstrap.js](http://mxr.mozilla.org/mozilla-central/source/toolkit/mozapps/extensions/SpellCheckDictionaryBootstrap.js)).

#### On The Differences Between package.json and install.rdf

The [`package.json`](https://npmjs.org/doc/json.html) and [`install.rdf`](https://developer.mozilla.org/Add-ons/Install_Manifests)
definitions have a lot of overlap, but there are differences.  Most of this differnces don't appear to matter much, for instance
adding a `unpack` or `iconURL` key to the `package.json` spec seems trival, and many `install.rdf` elements can be ignored, like `bootstrap`,
`type`, or `strictCompatibility`.  However, `targetApplication` and `updateURL` are more tricky.

The `package.json` spec has a `engines` key, so we could have `{ "engines" : { "firefox" : ">=25" } }` in the SDK extension's
`package.json`, but then how would work with an `update.rdf` when using a `updateURL`?  I think it would be best to have an `update.rdf` file used with
a `package.json` file in phase 1, and possibly offer the updating functionality via an `update.json` file in a future, completely separate, project.

So as far as I can tell we will have to ensure that it is possible to still use an `update.rdf` file.

Also I think adding these keys to the `package.json` spec is not a problem.

The new keys would be:

* `unpack`: optional, default is false
* `updateURL`: optional
* `updateKey`: optional
* `aboutURL`: optional
* `strictCompatibility`: optional

Note: We currently allow/support keys in [our package.json](https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/package-spec.html) which are not used in the [Node/NPM package.json]((https://npmjs.org/doc/json.html) and [`install.rdf`](https://developer.mozilla.org/Add-ons/Install_Manifests),
which I am not listing a being "new keys" here, we will continue to support those keys.  Some of our
currently supported keys will no longer be necessary, like the `harnessClassID` one.

##### Localization

Localizing `package.json` metadata will be done by using the [Before Gecko 1.9 method described here](https://developer.mozilla.org/docs/Mozilla/Localization/Localizing_extension_descriptions#Localizing_before_Gecko_1.9), but the
steps referring to the default preferences file will be done automatically.  However, since it is currently
possible to localize this information with the `cfx` tool I do not think this should be a blocker for Phase 1,
and can be done at some point in the future.

#### AMO

The AMO website and validator will need updating to support this new format, that may affect our timeframe for
releasing/announcing these updates.

#### Simple Prefs (See [Bug 903039](https://bugzilla.mozilla.org/show_bug.cgi?id=903039))

If no `options.xul` file is provided, then simple prefs will to be created dynamically when the
[`addon-options-displayed` observer service event is fired](https://developer.mozilla.org/docs/Extensions/Inline_Options#Display_notifications).
If there is an `options.xul` file provided then it will be used.

#### Localization ([Bug 935290](https://bugzilla.mozilla.org/show_bug.cgi?id=935290))

Since Jetpacks use `.properties` files no converstion should be required, and the `l10n` module
should be made to read directly from these files.

#### Documentation

SDK extensions are first class exentsions, so the documentation is on [MDN](https://developer.mozilla.org/) with the rest of
the extension documentation.

#### On Test Suite portablity

By using preferences to pass the `sdk/test/options` it should be possible for anyone to create a test suite of SDK tests, for example they
could be used for testing a website using page-mods, or for writing bug examples, which are either SDK extensions which
reproduce a bug that can then be easily converted to an SDK test or written as SDK tests from the start, attached
to new bugs, which when resolved are shipped with the community contributed SDK test. This is [bug 852538](https://bugzilla.mozilla.org/show_bug.cgi?id=852538).

There are two options which I see where SDK tests can live anywhere in mozilla-central:

1. We build on top of Mochitests, using a simple header which installs an SDK test and pipes the assertions/failures to the Mochitest framework.
2. We build our own Jetpack test harness using the cfx internals that we have, which are already being used for a Jetpack test suite which is currently limited to tests in the `addon-sdk` directory of mozilla-central.

The former seems like it may be the quickest path to success, but I think that the latter should be the end goal, so I feel like the latter is the path to take because I'm not sure how much reusuable work is in the two options.

## Phase 2

In the second phase we have a few remaining very important issues to consider which address the end of life
for Flightdeck.  There are many different options that can be taken after Phase 1, and really
no limitations, because it should be possible for the community to develop an infinite number of
tools around the instruction set described for `jpm`, but Mozilla should provide a replacement
for the functionality provided by Flightdeck, probably as an add-on first which could
later land in mozilla-central if that seems right.

### On Flightdeck

[Flightdeck](https://wiki.mozilla.org/AMO/FlightDeck) is a tool which which had the following goals:

1. Make extension development easy and rapid.
2. Make extension development collaborative (in the async sense that Github exemplifys, and not the sync sense like Cloud9 or Etherpad).
3. Make submitting add-ons to AMO easy.

Flightdeck is very powerful, and certainly succeed in introducing people to Jetpack and getting them
to build their first Jetpacks, but there was very little longer term development happening with this product, the second goal
however was missed for a large variety of reasons, and the third goals success was handicapped by the
issues with reaching the first and second goals.

These are lesssons that we should learn from, we should not try to reinvent things that we do not need to,
and leverage tools that already exist.  For example `git` and `hg` are great for version control when
developing an add-on and they are great for collaboration because one can use BitBucket or Github.
Also NPM is great for managing third party CommonJS modules, so we don't need to make a package
manager of any kind.  Furthermore, we do not need to build an IDE, we can leverage a simple tool
like Scratchpad and add a small file explorer (like Sublime Text does) by default and allow
add-on developers to use their favorite file editor (which might have extensions of their own
for this kind of work).

Another issue with Flightdeck is that it was slow because it required an internet connection, also
the requiring an internet connection idea wasn't great.

Flightdeck is also extremely hard for Mozilla staff to contribute to, let alone the Mozilla community,
because the list of setup steps was far too complex.

Finally, Flightdeck would be far too expensive to scale to large demands, especially when compared
to developing add-ons offline with some AOM tools (either built-in or provided by an add-on).

So Flightdeck is ending and it is time to dream up some alternatives, and I doubt the add-on community
will ever say it's done with that task, but Mozilla should implement a solution as an add-on
as soon as possible to make sure we cater to the existing Flightdeck community, it's target audience,
and all other Jetpack developers.

#### Rapid extension development within Firefox

Once Firefox natively supports Jetpacks as first class extensions (see Phase 1) rapid developement will
be free, making this functionality easy to discover for developers will however require
interface changes to the AOM.  These are some suggested changes that may be useful:

1. Some means for creating a new add-on skeleton (similar to the task which `cfx init` provided or
creating a new add-on on Flightdeck).
2. Some means for editing files in an add-on without the requirement for external tools or
file editors (while still allowing external tools/editors to be used).  For example Scratchpad integration.

#### Making extension development collaborative

One of the most important features for Flightdeck was the ability to share and reuse third party modules.
In the future this should be done through NPM, ideally it would be possible to use third package modules
available on NPM through Firefox by some means.

#### Submitting Add-ons to AMO

Some sort of AMO integration or streamlined add-on submission process would be ideal.


