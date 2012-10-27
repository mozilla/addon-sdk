<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

# CommonJS Modules #

[CommonJS](http://wiki.commonjs.org/wiki/CommonJS) is the underlying
infrastructure for both the SDK and the add-ons you build using the SDK.

A CommonJS **module** is a piece of reusable JavaScript: it exports certain
objects which are thus made available to dependent code. To facilitate this
CommonJS defines:

* an object called `exports` which contains all the objects which a CommonJS
module wants to make available to other modules

* a function called `require` which a module can use to import the `exports`
object of another module.

![CommonJS modules](static-files/media/commonjs-modules.png)

## CommonJS Modules in the Add-on SDK ##

Except for [scripts that interact directly with web content](dev-guide/guides/content-scripts/index.html),
all the JavaScript code you'll write or use when developing add-ons using
the SDK is part of a CommonJS module, including:

* **core SDK modules**: the JavaScript modules which the SDK provides, such as
[`panel`](modules/sdk/panel.html) or [page-mod](modules/sdk/page-mod.html)

* **modules in your add-on**: each of the JavaScript files in your add-ons "lib" directory.

* **community-developed modules**: reusable modules developed and maintained
outside the SDK, but usable by SDK-based add-ons.

### SDK Core Modules ###

Modules supplied with the SDK can be found in the "lib" directory under
the SDK root.

<ul class="tree">
  <li>addon-sdk
    <ul>
      <li>app-extension</li>
      <li>bin</li>
      <li>data</li>
      <li>doc</li>
      <li>examples</li>
      <li><span class="highlight">lib</span>
<div class="annotation">
All the modules provided by the SDK are stored under "lib".
</div>
        <ul>
          <li><span class="highlight">sdk</span>
<div class="annotation">
All modules that are specifically intended for users of the SDK are stored in the "sdk" directory.
</div>
            <ul>
              <li><span class="highlight">clipboard.js</span>
<div class="annotation">
High-level modules like <code>clipboard</code> are directly underneath the "sdk" directory.
</div></li>
              <li><span class="highlight">core</span>
<div class="annotation">
Subdirectories of "sdk" are used to group related low-level modules.
</div>
                <ul>
                  <li class="highlight"><span class="highlight">heritage.js</span>
<div class="annotation">
Low-level modules like <code>heritage</code> and <code>namespace</code> are always stored under a subdirectory of "sdk".
</div></li>
                  <li><span class="highlight">namespace.js</span>
<div class="annotation">
Low-level modules like <code>heritage</code> and <code>namespace</code> are always stored under a subdirectory of "sdk".
</div></li>
                </ul>
              </li>
            </ul>
          </li>
          <li><span class="highlight">toolkit</span>
<div class="annotation">
Very generic, platform-agnostic modules that are shared with other
projects are stored in "toolkit".
</div></li>
        </ul>
      </li>
      <li>python-lib</li>
      <li>test</li>
    </ul>
  </li>
</ul>

<div style="clear:both"></div>

<pre>
ls packages
</pre>

You will see something like this:

<pre>
addon-kitapi-utilstest-harness
</pre>


### Modules in Your Add-on ###

At a minimum, an SDK-based add-on consists of a single module
named `main.js`, but you can factor your add-on's code into a collection
of [separate CommonJS modules](dev-guide/tutorials/reusable-modules.html).

### Community-developed Modules ###

## Using "require()" ##



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





## Packages in the SDK ##

Navigate to the root of your SDK installation and list the contents of
the "packages" directory:

<pre>
ls packages
</pre>

You will see something like this:

<pre>
addon-kitapi-utilstest-harness
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
[collection](modules/sdk/platform/xpcom.html) and
[url](modules/sdk/url.html). Many add-ons are likely to
want to use modules from this category.

* building blocks for higher level modules, such as
[event/core](modules/sdk/event/core.html),
[event/target](modules/sdk/event/target.html),
[heritage](modules/sdk/core/heritage.html), and
[namespace](modules/sdk/core/namespace.html). You're more
likely to use these if you are building your own modules that
implement new APIs, thus extending the SDK itself.

* privileged modules that expose powerful low-level capabilities
such as [xhr](modules/sdk/net/xhr.html) and
[xpcom](modules/sdk/platform/xpcom.html). You can use these
modules in your add-on if you need to, but should be aware that
the cost of privileged access is the need to take more elaborate
security precautions. In many cases these modules have simpler,
more restricted analogs in the high-level addon-kit package (for
example, [tabs](modules/sdk/tabs.html) or
[request](modules/sdk/request.html)).

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