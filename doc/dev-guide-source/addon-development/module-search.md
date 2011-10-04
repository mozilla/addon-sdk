# Module Search #

## require(what?) ##

The Add-on SDK uses [CommonJS](dev-guide/addon-development/commonjs.html)
modules, in which all functionality is acquired by using the `require()`
function. The first argument to `require()` is a "module name" which roughly
indicates what kind of functionality is desired.

CommonJS does not specify how implementations are supposed to map these
module names to actual code. As with any programming environment, a set of
conventions have developed, and are encouraged/enforced by each runtime
system.

The module-search logic needs to provide features like:

* support for "packages": groups of related modules that are bundled together
  for easy distribution
* easy and concise use of "stdlib" modules like `panel` and `page-mod` in
  `packages/addon-kit/lib`, perhaps searching multiple packages for a module
  with the right name
* "absolute" imports: minimize searching (and ambiguity) by specifying
  exactly which package contains the module of interest
* relative imports: when two related modules live in the same directory, they
  should be able to import each other without concern about namespace
  collisions with other, unrelated modules

## Packages ##

Modules are split up into separate "packages", such as the "addon-kit"
package shipped with the SDK. Each module lives in exactly one package. Each
packages is a directory with a `package.json` file that contains metadata
about the package.

As described in the
[Package Specification](dev-guide/addon-development/package-spec.html), code
modules are usually placed in the `lib/` subdirectory of a package, but the
`directories` key can be used to override this (e.g. to put the modules in
the package's root directory instead of `lib/`). The `dependencies` key is
used to indicate other packages that should be searched for modules (when
searching is done at all, see below), and the SDK automatically adds
`addon-kit` to the `.dependencies` list for the top-level addon package.

Certain packages (such as those distributed via [NPM](http://npmjs.org/), the
Node Package Manager) hide their internal structure begin a single "entry
point". This is indicated by a `main` key in `package.json` that points to a
module (e.g. `"main": "lib/main.js"`).

When the SDK starts any operation (`cfx test`, `cfx run`, or `cfx xpi`), it
builds a list of all known packages. This list includes the top-level addon
itself (i.e. the current working directory when `cfx` was invoked), all the
subdirectories of the SDK's `packages/` directory (including `addon-kit`),
and all subdirectories of each entry in the `--package-path`. Each package
must have a unique name, otherwise `cfx` will raise an error.

## SDK Search Rules ##

The Add-on SDK's CommonJS loader uses a set of rules to get from the
`require()` module name to a file of code. There are two setup steps:

* First, determine the package that owns the module doing the `require()`.
  This is called "FROM-PACKAGE" and is used for relative imports and
  searches. Likewise, "FROM-MODULE" is the on-disk location of the module
  doing the `require()`.
* Second, build a list of packages to be searched, in case a search is called
  for. This list always starts with FROM-PACKAGE, then the list of
  `.dependencies` from FROM-PACKAGE's `package.json` is appended. For
  example, if package A has a `package.json` with a `.dependencies` key that
  includes modules B and C, the search-path for A will contain [A, B, C]. If
  the package does not have a `.dependencies`, then any search will first
  check FROM-PACKAGE, then will check all known packages (in alphabetical
  order).

Then the lookup logic works as follows:

1. If the module-name starts with `./` or `../` then this is a "relative
   import". These imports always find modules from the same package as the
   importer (i.e. from FROM-PACKAGE). `./bar` will always point to a module
   in the same directory as FROM-MODULE, and `../up` goes up a directory.
   Some examples:
    * FROM-MODULE=`packages/pkg-one/lib/foo.js`: `require("./bar")` will
      locate `packages/pkg-one/lib/bar.js`
    * FROM-MODULE=`packages/pkg-one/lib/foo.js`: `require("./sub/baz")` will
      locate `packages/pkg-one/lib/sub/baz.js`
    * FROM-MODULE=`packages/pkg-one/lib/sub/abc.js`: `require("../def")` will
      load `packages/pkg-one/lib/def.js`
    * FROM-MODULE=`packages/pkg-one/lib/sub/abc.js`: `require("../misc/ghi")` w
      will load `packages/pkg-one/lib/misc/ghi.js`
    * If the module cannot be found by these rules, an error is raised.
2. If the module-name contains a slash "`/`" but does not start with a
   period, such as `require("A/misc/foo")`, the loader interprets the first
   component ("A") as a package name. If there is such a package, it
   interprets the rest of the name ("misc/foo") as a module path relative to
   the top of the package. This uses the `.directories` key, so for packages
   that use `lib/`, this will look for e.g. `packages/A/lib/misc/foo.js`. If
   the first component does not match a known package name, processing
   continues with the package-search below.
3. If the module-name does not contain a slash "`/`", the loader
   attempts to interpret it as a package name (intending to use that
   package's "entry point"). If there is a package with that name, the `main`
   property is consulted, interpreted as a filename relative to the
   `package.json` file, and the resulting module is loaded. If there is no
   package by that name, processing continues with the package-search below.
4. The module-name (either a single component, or multiple components
   joined by slashes) is used as the subject of a package-search. Each package
   in the search list is checked to see if the named module is present, and
   the first matching module is loaded. For example, if
   FROM-MODULE=`packages/A/lib/sub/foo.js`, and `packages/A/package.json` has
   a `.dependencies` of `[B,C]`, the search-path will contain `[A,B,C]`. If
   foo.js does `require("bar/baz")`, the loader will look first for
   `packages/A/lib/bar/baz.js`, then `packages/B/lib/bar/baz.js`, then finally
   `packages/C/lib/bar/baz.js`.
5. If no module is found by those steps, an error is raised.
