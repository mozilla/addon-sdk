<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

* static-args
* environment variables
* exit
* stdout
* pathFor
* platform
* architecture
* compiler
* build
* id
* name
* version
* vendor

<api name="staticArgs">
@property {Object}

The JSON object that was passed via
[`cfx --static-args`](dev-guide/cfx-tool.html#arguments).

For example, suppose your add-on includes code like this:

    var system = require("system");
    console.log(system.staticArgs.foo);

If you pass it a static argument named "foo" using `--static-args`, then
the value of "foo" will be written to the console:

<pre>
(addon-sdk)~/my-addons/system > cfx run --static-args="{ \"foo\": \"Hello\" }"
Using binary at '/Applications/Firefox.app/Contents/MacOS/firefox-bin'.
Using profile at '/var/folders/me/DVFDGavr5GDFGDtU/-Tmp-/tmpOCTgL3.mozrunner'.
info: system: Hello
</pre>

</api>

<api name="env">
@property {Object}

This object provides access to environment variables.

You can get the
value of an environment variable by accessing the property with that name:

    var system = require("system");
    console.log(system.env.PATH);

You can test whether a variable exists by checking whether a property with
that name exists:

    var system = require("system");
    if ('PATH' in system.env) {
      console.log("PATH is set");
    }

You can set a variable by setting the property:

    var system = require("system");
    system.env.FOO = "bar";
    console.log(system.env.FOO);

You can unset a variable by deleting the property:

    var system = require("system");
    delete system.env.FOO;

You **can't** enumerate environment variables.

</api>


