# XPI Generation #

<span class="aside">
Note that some parts of the following text have been simplified to
allow you get a better idea of what's going on when a XPI is created.
</span>

Running `cfx xpi` in the directory of any package that contains a program
will bundle the package and all its dependencies
into a standalone XPI. This document explains how this process
works under the hood.

Source Packages
---------------

We start out with a simplified `packages` directory with three
packages, structured like so:

<pre>
</pre>

Note that our `packages` directory could actually contain more
packages, too. This doesn't affect the generated XPI, however, because
only packages cited as dependencies by `aardvark`'s `package.json` will
ultimately be included in the XPI.

The XPI Template
----------------

The Add-on SDK also contains a directory that contains a template for
a XPI file:

<pre>
</pre>

A template different than the default can be specified via the
`cfx` tool's `--templatedir` option.

The Generated XPI
-----------------

When we run `cfx xpi` to build the `aardvark` package into an extension,
`aardvark`'s dependencies are calculated, and a XPI file is generated that
combines all required packages, the XPI template, and a few other
auto-generated files:

<pre>
</pre>

It can be observed from the listing above that the `barbeque` package's `lib`
directory will be mapped to `resource://guid-barbeque-lib/` when the XPI is
loaded.

Similarly, the `lib` directories of `api-utils` and `aardvark` will be
mapped to `resource://guid-api-utils-lib/` and
`resource://guid-aardvark-lib/`, respectively.

In an actual XPI built by the SDK, the string `"guid"` in these
examples is a unique identifier that the SDK prepends to all
`resource:` URIs to namespace the XPI's resources so they don't
collide with anything else, including other extensions built by the
SDK and containing the same packages. This GUID is built from the
[Program ID](dev-guide/addon-development/program-id.html).

By default, the generated XPI contains every module from each package that is
referenced by the addon, even the modules that aren't used (such as the
`notifications` module if the addon is only using `page-mod`). By running
`cfx xpi --strip-xpi` instead, the SDK will produce a "stripped" XPI, that
only includes the modules that are actually used, resulting in a smaller XPI
file. (Note: `--strip-xpi` is currently experimental; when this feature is
sufficiently mature, it will simply be made the default, and the `cfx` option
will be removed.)
