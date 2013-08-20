> _This JEP was implemented in [Bug 787072](https://bugzilla.mozilla.org/show_bug.cgi?id=787072) and [Bug 725409](https://bugzilla.mozilla.org/show_bug.cgi?id=725409)_

_This proposal is end now at **Applications version support** section, included._
_To be explicit, it's just about annotate the module with the proper information. There is no `cfx` changes considered in the first step, so from the section **Traverse the modules to collect metadata supports information** it's just for the record and future use._

This document describes proposal how a module can define its own metadata,
without needs to be part of a package (see also [packageless][]).
The proposal is focusing on applications supports, so only two main properties
are described, `stability` and `only-supports`, but metadata could be
used to add information like `author`, `version`, etc.

The module's metadata is a plain javascript object assigned to `module.metadata`
property:

```js
module.metadata = {
  "stability": "experimental",
  "engines": {
    "Firefox": "*"
  }
}
```

The `module.metadata` property should be set at the beginning of the file,
and only once. Therefore, `cfx` should raise an error at packaging time in the
following scenarios:

```js
// BAD
let metadata = {
  "stability": "experimental",
  "engines": {
    "Firefox": "*"
  }
}

module.metadata = metadata;

// BAD
let key = "metadata";

module[key] = {
  "stability": "experimental",
  "engines": {
    "Firefox": "*"
  }
};

// BAD
if (isSunday) {
  module.metadata = {
    "stability": "experimental",
    "engines": {
      "Firefox": "*"
    }
  }
}
else {
  module.metadata = {
    "stability": "experimental",
    "engines": {
      "Firefox": "*",
      "Fennec": "*"
    }
  }
}
```

We could also implement on JavaScript side a check in order to raise an error
at runtime if the property is assigned twice, and / or froze it after the
first assignment.

## Stability
The `stability` property is following the ratings below:
```
Stability ratings: 0-5

0 - Deprecated
1 - Experimental
2 - Unstable
3 - Stable
4 - Frozen
5 - Locked
```

These ratings are taken from: https://gist.github.com/1776425

We decided to be more explicit and use the text values instead of the number values.

## Applications support

The `engines` property defines an object with the application id and application version(s) that the
module supports. The name and syntax is familiar to node.js and npm users:

```js
module.metadata = {
  "engines": {
    "Firefox": "*"
  }
}
```

If the `module.metadata` is not present in a module, or the `engines`
property is missing, we'll assume the module has no specific platform issue,
therefore can be used in all platforms.

## Applications version support

In all the example above the applications' version is not specified. If we
need to limit a module for a specific application's version, we can define it
after the application id:

```js
module.metadata = {
  "engines": {
    "Firefox": ">=10 < 16",
    "Fennec": "13.0.0 - 15.0.0"
   }
}
```

Following a subset of the semantic version, where is compatible with Mozilla's application's version. Examples are [here](https://gist.github.com/4e802fecc7342d191972) (we do not support _Tilde Version Ranges_ and _URLs as Dependecies_).

## Traverse the modules to collect metadata supports information

The `cfx` should traverse all modules used in an add-on in order to collect
the `only-supports` information stored in the metadata, and warn the user if
there are some inconsistency, at packaging time.

For example, if module `A` claims to support both `Firefox` and `Fennec`,
and it depends by a module `B` that support only `Firefox`, the `cfx` should
raise a warning. The same is applied for the versions.

The `cfx` should also warn the developer in case is using a `deprecated`,
`experimental` or `Unstable` module.

**Note**: it's probably better if we reduce the warning only to `deprecated` modules, because the number of `experimental` and `unstable` in the Add-on SDK core add-on kit and api-utils are a lot. Maybe we could add a flag to cfx, similar to "use strict", that produce warning in everything is less than `"Stable"`.

## Building XPI for a specific application

The `only-supports` property should be applied to add-on's `package.json`
as well. In this way, the developer can tell to the `cfx` for which
applications the add-on is designed for.

If the `only-supports` specified in the `package.json` contains applications
or versions that are not matching or are not a subset of the `only-supports`
obtained from the modules, the `cfx` should warn the developer that the XPI
can't be created for that platform, and display the modules are not compatible.

Otherwise, the `cfx` should generate a XPI with a proper `install.rdf` that
is matching the applications specified in `package.json`.

## Expose several implementation for the same API

There is a scenario where this proposal is failing. When you create a module
that exposes different implementation based on a specific platform:

```js
// tabs module

module.metadata = {
  "engines": {
    "Firefox": "*",
    "Fennec": "*"
   }
}

const app = require("sdk/system/xul-app");

if (app.is("Fennec")) {
  module.exports = require("./fennec/tabs");
}
else {
  module.exports = require("./firefox/tabs");
}
```

That's really useful. The problem is, the `cfx` will see that the
module `tabs` claims compatibility for both `Firefox` and `Fennec`, and
therefore it's expecting that its dependencies are equally compatible with
them as well, that is not obviously the case.
What we need in this scenario, is telling to the cfx that one branch has to be
compatible only with fennec, and other with Firefox, so that if the `cfx`
will find in some deeper dependencies an inconsistency is able to report it.

Brian Warner suggest to mark the `require` line with a comment like that:

```js
// tabs module

module.metadata = {
  "engines": {
    "Firefox": "*",
    "Fennec": "*"
   }
}

const app = require("sdk/system/xul-app");

if (app.is("Fennec")) {
  module.exports = require("./fennec/tabs"); // META:need=["Fennec"]
}
else {
  module.exports = require("./firefox/tabs");  // META:need=["Firefox"]
}
```

Another approach could be tell to `cfx` that for this kind of "aggregation
module" the compatibility check should be ignored for the direct children:

```js
// tabs module
// "ignore-dependencies" is really a temporary name

module.metadata = {
  "engines": {
    "Firefox": "*",
    "Fennec": "*"
  },
  "ignore-dependencies": true
}

const app = require("sdk/system/xul-app");

if (app.is("Fennec")) {
  module.exports = require("./fennec/tabs");
}
else {
  module.exports = require("./firefox/tabs");
}
```

So, assuming a module called `tabUtils` will `require` the module `tabs`.
The `cfx` will:

1. check if the `only-supports` value of `tabUtils` area subset or are
matching the `only-supports` value of `tabs`

2. ignoring the check between `tabs` and `fennec/tabs` /  `firefox/tabs`

3. check if `fennec/tabs`'s dependencies are compatible with fennec (assuming
the module has `only-supports` property set to "Fennec")

4. check if `firefox/tabs`'s dependencies are compatible with firefox (assuming
the module has `only-supports` property set to "Firefox")

Unfortunately there is an edge case that this scenario doesn't cover. If the
module that aggregates the others (in our example, `tabs`) is using another
module:

```js
// tabs module

module.metadata = {
  "engines": {
    "Firefox": "*",
    "Fennec": "*"
   },
  "ignore-dependencies": true
}

const app = require("sdk/system/xul-app");
const base64 = require("sdk/base64");

if (app.is("Fennec")) {
  module.exports = require("./fennec/tabs");
}
else {
  module.exports = require("./firefox/tabs");
}

// use base64 for something
```

Let's say that `base64` was a neutral module (no `only-supports` property
defined), then we found that can't work in `Fennec`, and we change it to
support only `Firefox`. In that case, the `cfx` will not notified
the developer this problem, and will pass the check.

With the approach suggested by Brian, this scenario will be covered.

Personally, I'd like to avoid comments parsing, and adding them for each line
seems also too verbose and error prone. The idea to ignore the direct
dependencies seems to me cleaner, and maybe the edge case can be highlighted in
the documentation, where we can suggest how to create this "aggregation module",
that should contains only `xul-app` module and a module for each platform
specific implementation.

Another approach could be also modifying the `require` or using a
`loader plugin` in order to don't have this "aggregation module", but resolve
the platform specific dependencies issue in another way (for example using
the file system like Narwhal and GWT does). That was the original idea that was
dropped, but it's worthy to mention it.

## Bug

- https://bugzilla.mozilla.org/show_bug.cgi?id=725409

## Discussions

- https://jetpack.etherpad.mozilla.org/metadata-proposal

[packageless]:https://github.com/mozilla/addon-sdk/wiki/JEP-packageless
[bug metadata]:https://bugzilla.mozilla.org/show_bug.cgi?id=725409
