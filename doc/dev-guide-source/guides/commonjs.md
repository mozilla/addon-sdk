<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

# CommonJS, Packages, and the SDK #

CommonJS is the underlying infrastructure for both the SDK and the add-ons
you build using the SDK.

The [CommonJS group](http://wiki.commonjs.org/wiki/CommonJS) defines
specifications for **modules** and **packages**.

## CommonJS Modules ##

A CommonJS **module** is a piece of reusable JavaScript: it exports certain
objects which are thus made available to dependent code. To facilitate this
CommonJS defines:

* an object called `exports` which contains all the objects which a CommonJS
module wants to make available to other modules

* a function called `require` which a module can use to import the `exports`
object of another module.

![CommonJS modules](static-files/media/commonjs-modules.png)

The SDK
[freezes](https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Object/freeze)
the `exports` object returned by `require`. So a if you import a module using
`require`, you can't change the properties of the object returned:

    self = require("self");
    // Attempting to define a new property
    // will fail, or throw an exception in strict mode
    self.foo = 1;
    // Attempting to modify an existing property
    // will fail, or throw an exception in strict mode
    self.data = "foo";

## CommonJS Packages ##

A CommonJS **package** is a structure which can wrap a collection of related
modules: this makes it easier to distribute, install and manage modules.

Minimally, a package must include a package descriptor file named
`package.json`: this file contains information about the package such as a short
description, the authors, and the other packages it depends on.

Packages must also follow a particular directory structure, which is the
structure `cfx init` created for your add-on.

## CommonJS and the Add-on SDK ##

<img class="image-right" src="static-files/media/commonjs-wikipanel.png"
alt="CommonJS wikipanel">

* The JavaScript modules which the SDK provides are CommonJS modules, and they
are collected into CommonJS packages.

* The JavaScript components of an add-on constitute one or more
CommonJS modules, and a complete add-on is a CommonJS package.

According to the CommonJS specification, if a module called `main` exists in a
CommonJS package, that module will be evaluated as soon as your program is
loaded. For an add-on, that means that the `main` module will be evaluated as
soon as Firefox has enabled the add-on.

Because an add-on is a CommonJS package it's possible to include more than one
module in an add-on, and to make your modules available to any code that want
to use them.

## Packages in the SDK ##

Navigate to the root of your SDK installation and list the contents of
the "packages" directory:

<pre>
ls packages
</pre>

You will see something like this:

<pre>
addon-kit	api-utils	test-harness
</pre>

So the modules which implement the SDK's APIs are
collected into three packages, `addon-kit`, `api-utils` and `test-harness`.

### <a name="addon-kit">addon-kit</a> ###

Modules in the `addon-kit` package implement high-level APIs for
building add-ons:

* creating user interfaces
* interacting with the web
* interacting with the browser

These modules are "supported": meaning that they are stable, and that
we'll avoid making incompatible changes to them unless absolutely
necessary.

They are documented in the "High-Level APIs" section
of the sidebar.

### <a name="api-utils">api-utils</a> ###

Modules in the `api-utils` package implement low-level APIs. These
modules fall roughly into three categories:

* fundamental utilities such as
[collection](packages/api-utils/collection.html) and
[url](packages/api-utils/url.html). Many add-ons are likely to
want to use modules from this category.

* building blocks for higher level modules, such as
[base](packages/api-utils/base.html) and
[namespace](packages/api-utils/namespace.html). You're more
likely to use these if you are building your own modules that
implement new APIs, thus extending the SDK itself.

* privileged modules that expose powerful low-level capabilities
such as [xhr](packages/api-utils/xhr.html) and
[xpcom](packages/api-utils/xpcom.html). You can use these
modules in your add-on if you need to, but should be aware that
the cost of privileged access is the need to take more elaborate
security precautions. In many cases these modules have simpler,
more restricted analogs in the high-level addon-kit package (for
example, [tabs](packages/addon-kit/tabs.html) or
[request](packages/addon-kit/request.html)).

<div class="warning">
<p>These modules are still in active development,
and we expect to make incompatible changes to them in future releases.
</p>
If you use these modules in your add-on you may need to rewrite your
code when upgrading to a newer release of the SDK.
</div>

They are documented in the "Low-Level APIs" section of the sidebar.

### test-harness ###

Modules in this packages are used internally by the SDK's test code.
