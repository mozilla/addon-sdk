<span class="aside">
Terminology is important.  Here's a glossary of terms used for the SDK
so all developers speak the same language.
</span>

__CommonJS__: A specification for a cross-platform JavaScript module
system and standard library.  [Web site](http://commonjs.org/).

__Addon__: An XPInstall package (.XPI file) that adds functionality to
a Mozilla application. It can include traditional addons such as
AdBlock Plus, as well as extensions built with Jetpack. Extensions
built with Jetpack, however, will eventually support install/upgrade
without reboot, as well as a robust security model.

__Extension__: Synonym for Addon.

__Jetpack__: A CommonJS-based framework used to power secure Mozilla
applications and extensions with Web technologies. Not to be confused
with the Jetpack Prototype, which is a completely different animal.

__Add-on SDK__: A toolchain and associated applications used to develop
packages.

__Jetpack Prototype__: A Firefox extension released in May 2009 which
explored using Web technologies to enhance the browser (e.g., HTML,
CSS and JavaScript), with the goal of allowing anyone who can build a
Web site to participate in making the Web a better place to work,
communicate and play. Not to be confused with Jetpack.

__Jetpack Core__: A small, self-contained set of Jetpack Chrome
Modules and Low-Level Modules that form the base
functionality for Jetpack. The Core can actually be "bootstrapped"
into any Mozilla application or extension.

__Jetpack Globals__: The set of global variables and objects provided
to all Cuddlefish Modules, such as `console` and `memory`. Includes
CommonJS globals like `require` and standard JavaScript globals such
as `Array` and `Math`.

<span class="aside">
For more information on Low-Level Modules, see the
[Low-Level Module Best Practices] appendix.
</span>

__Low-Level Module__: A module with the following properties:

  * Has "chrome" access to the Mozilla platform (e.g. `Components.classes`)
    and all Jetpack Globals.
  * Is reloadable without leaking memory.
  * Logs full exception tracebacks originating from client-provided
    callbacks (i.e., does not allow the exceptions to propagate into
    Mozilla platform code).
  * Can exist side-by-side with multiple instances and versions of
    itself.
  * Contains documentation on security concerns and threat modeling.

__Unprivileged Jetpack Module__: A CommonJS module that may be run
without unrestricted access to the Mozilla platform, and which may use
all applicable Jetpack Globals that don't require chrome privileges.

__Jetpack Module__: A CommonJS module that is either a Low-Level
Module or an Unprivileged Jetpack Module.

__Jetpack Loader__: An object capable of finding, evaluating, and
exposing CommonJS modules to each other in a given security context,
while providing each module with necessary Jetpack Globals and
enforcing security boundaries between the modules as necessary. It's
entirely possible for Loaders to create new Loaders.

__CFX__: A command-line build, testing, and packaging tool for
Jetpack-based code.

__Package__: A directory structure containing modules,
documentation, tests, and related metadata. If a package contains
a program and includes proper metadata, it can be built into
a Mozilla application or extension.

__Program__: A Jetpack Module named `main` that optionally exports
a `main()` function.  This module is intended either to start an application for
an end-user or add features to an existing application.

__Jetpack Platform Library__: A set of Low-Level Modules
that expose the functionality of the Mozilla Platform (Gecko).

  [Low-Level Module Best Practices]: #guide/best-practices
