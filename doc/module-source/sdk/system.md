<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

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

<api name="exit">
@function

Ends the process with the specified `code`. If omitted, exit uses the
'success' code 0. To exit with failure use `1`.

@param code {integer}
  To exit with failure, set this to `1`. To exit with success, omit this
  argument.

</api>

<api name="pathFor">
@function

Returns the path of the "special" directory or file
associated with the given `id`. For list of possible `id`s please see
["Getting_files in special directories"](https://developer.mozilla.org/en-US/docs/Code_snippets/File_I_O#Getting_files_in_special_directories).

For example:

    // get firefox profile path
    let profilePath = require('system').pathFor('ProfD');
    // get OS temp files directory (/tmp)
    let temps = require('system').pathFor('TmpD');
    // get OS desktop path for an active user (~/Desktop on linux
    // or C:\Documents and Settings\username\Desktop on windows).
    let desktopPath = require('system').pathFor('Desk');

@param id {String}
  The ID of the special directory.
@returns {String}
  The path to the directory.

</api>

<api name="platform">
@function
Get the type of operating system you're running on.
This will be one of the values listed as
[OS_TARGET](https://developer.mozilla.org/en-US/docs/OS_TARGET),
converted to lower case.

@returns {String}
The type of operating system.

</api>

<api name="architecture">
@function
Get the processor architecture you're running on.
This will be one of: `"arm"``, `"ia32"`, or `"x64"`.

@returns {String}
The processor architecture.
</api>

<api name="compiler">
@function
Get the compiler used to build the host application.
For example: `"msvc"`, `"n32"`, `"gcc2"`, `"gcc3"`, `"sunc"`, `"ibmc"`

@returns {String}
The compiler.
</api>

<api name="build">
@function
Get an identifier for the specific build: this is useful if you're
trying to target individual nightly builds.
See [nsIXULAppInfo's `appBuildID`](https://developer.mozilla.org/en-US/docs/Using_nsIXULAppInfo#Version).

@returns {String}
  The specific build identifier, derived from the build date.
  For example: `"2004051604"`

</api>

<api name="id">
@function
Get the UUID for the host application. For example, `"{ec8030f7-c20a-464f-9b0e-13a3a9e97384}"`
for Firefox.

See [nsIXULAppInfo's `ID`](https://developer.mozilla.org/en-US/docs/Using_nsIXULAppInfo#ID).

This has traditionally been in the form
`"{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}"` but for some applications it may
be `"appname@vendor.tld"`.

@returns {String}
  The UUID as a string.

</api>

<api name="name">
@function
Get a human-readable name for the host application. For example, "Firefox".

@returns {String}
The application's name.

</api>

<api name="version">
@function
Get the version of the host application.

See [nsIXULAppInfo's `version`](https://developer.mozilla.org/en-US/docs/Using_nsIXULAppInfo#Version).

@returns {String}
The host application's version.
</api>

<api name="platformVersion">
@function

Get the version of XULRunner that underlies the host application.

See [nsIXULAppInfo's `platformVersion`](https://developer.mozilla.org/en-US/docs/Using_nsIXULAppInfo#Platform_version).

@returns {String}
The version of XULRunner.

</api>

<api name="vendor">
@function
The name of the host application's vendor, for example: `"Mozilla"`.

@returns {String}
The host application's vendor.

</api>
