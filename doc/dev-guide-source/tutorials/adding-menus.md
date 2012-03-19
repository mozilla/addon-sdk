<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

# Add a Menu Item to Firefox #

<span class="aside">
To follow this tutorial you'll need to have
[installed the SDK](dev-guide/tutorials/installation.html)
and learned the
[basics of `cfx`](dev-guide/tutorials/getting-started-with-cfx.html).
</span>

The SDK doesn't yet provide an API to add new menu items to Firefox.
But it's extensible by design, so anyone can build and publish
modules for add-on developers to use. Luckily, Erik Vold has written
a [`menuitems`](https://github.com/erikvold/menuitems-jplib) package
that enables us to add menu items.

## Installing `menuitems` ##

First we'll download `menuitems` from
[https://github.com/erikvold/menuitems-jplib](https://github.com/erikvold/menuitems-jplib/zipball/51080383cbb0fe2a05f8992a8aae890f4c014176).

Next, extract it under the SDK's `packages` directory:

<pre>
cd packages
tar -xf ../erikvold-menuitems-jplib-d80630c.zip
</pre>

Now if you run `cfx docs` you'll see a new section appear in the sidebar
labeled "Third-Party APIs", which contains the `menuitems` package.
The modules it contains are listed below it: you'll
see that `menuitems` contains a single module, also
called `menuitems`.

Click on the module name and you'll see API documentation for the module. Click
on the package name and you'll see basic information about the package.

One important entry in the package page lists the package's dependencies:

<pre>
Dependencies             api-utils, vold-utils
</pre>

This tells us that we need to install the `vold-utils` package,
which we can do by downloading it from
[https://github.com/erikvold/vold-utils-jplib](https://github.com/voldsoftware/vold-utils-jplib/zipball/1b2ad874c2d3b2070a1b0d43301aa3731233e84f)
and adding it under the `packages` directory alongside `menuitems`.

## Using `menuitems` ##

We can use the `menuitems` module in exactly the same way we use built-in
modules.

The documentation for the `menuitems` module tells us to we create a menu
item using `MenuItem()`. Of the options accepted by `MenuItem()`, we'll use
this minimal set:

* `id`: identifier for this menu item
* `label`: text the item displays
* `command`: function called when the user selects the item
* `menuid`: identifier for the item's parent element
* `insertbefore`: identifier for the item before which we want our item to
appear

Next, create a new add-on. Make a directory called 'clickme' wherever you
like, navigate to it and run `cfx init`. Open `lib/main.js` and replace its contents
with this:

    var menuitem = require("menuitems").Menuitem({
      id: "clickme",
      menuid: "menu_ToolsPopup",
      label: "Click Me!",
      onCommand: function() {
        console.log("clicked");
      },
      insertbefore: "menu_pageInfo"
    });

Next, we have to declare our dependency on the `menuitems` package.
In your add-on's `package.json` add the line:

<pre>
"dependencies": "menuitems"
</pre>

Note that due to
[bug 663480](https://bugzilla.mozilla.org/show_bug.cgi?id=663480), if you
add a `dependencies` line to `package.json`, and you use any modules from
built-in packages like [`addon-kit`](packages/addon-kit/index.html), then
you must also declare your dependency on that built-in package, like this:

<pre>
"dependencies": ["menuitems", "addon-kit"]
</pre>

Now we're done. Run the add-on and you'll see the new item appear in the
`Tools` menu: select it and you'll see `info: clicked` appear in the
console.

## Caveats ##

Eventually we expect the availability of a rich set of third party packages
will be one of the most valuable aspects of the SDK. Right now they're a great
way to use features not supported by the supported APIs without the
complexity of using the low-level APIs, but there are some caveats you should
be aware of:

* our support for third party packages is still fairly immature. One
consequence of this is that it's not always obvious where to find third-party
packages, although some are collected in the
[Jetpack Wiki](https://wiki.mozilla.org/Jetpack/Modules)

* because third party modules typically use low-level APIs, they may be broken
by new releases of Firefox.
