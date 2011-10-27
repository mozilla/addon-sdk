# CommonJS, Modules, Packages, and the SDK #

CommonJS is the underlying infrastructure for both the SDK modules and add-ons
themselves.

The [CommonJS group](http://wiki.commonjs.org/wiki/CommonJS) defines
specifications for **modules** and **packages**.

## CommonJS Modules ##

A CommonJS **module** is a piece of reusable JavaScript: it exports certain
objects which are thus made available to dependent code. To facilitate this
CommonJS defines:

* an object called `exports` which contains all the objects which a CommonJS
module wants to make available to other modules

* a function called `require` which a module can use to import the `exports`
object of another module. The "wikipanel" add-on uses `require` to import the
SDK modules it uses.

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

So in terms of CommonJS objects the wikipanel add-on consists of a package
that contains a single module called `main`, and which imports two SDK
modules.

Because an add-on is a CommonJS package it's possible to include more than one
module in an add-on, and to make your modules available to any code that want
to use them.

In the next section we'll see how you can use the SDK implement and test your
own [reusable modules](dev-guide/addon-development/implementing-reusable-module.html).
