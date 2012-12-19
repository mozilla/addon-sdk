<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

Provides an API for creating javascript sandboxes and for executing scripts
in them.

## Create a sandbox ##

For the starting point you need to create a sandbox:

    const { sandbox, evaluate, load } = require("api-utils/sandbox");
    let scope = sandbox('http://example.com');

The argument passed to the sandbox defines its privileges. The argument may be:

* a URL string, in which case the sandbox will get the same privileges as
a script loaded from that URL
* a DOM window object, to inherit privileges from the window being passed.
* omitted or `null`: then the sandbox will have chrome privileges giving it
access to all the XPCOM components.

Optionally the `sandbox` function can be passed a second argument
(See [sandbox documentation on MDN](https://developer.mozilla.org/en/Components.utils.Sandbox#Optional_parameter)
for details).

## Evaluate code ##

Module provides `evaluate` function that lets you execute code in the given
sandbox:

    evaluate(scope, 'var a = 5;');
    evaluate(scope, 'a + 2;');      //=> 7

More details about evaluated script may be passed via optional arguments that
may improve exception reporting:

    // Evaluate code as if it was loaded from 'http://foo.com/bar.js' and
    // start from 2nd line.
    evaluate(scope, 'a ++', 'http://foo.com/bar.js', 2);

Version of JavaScript can be also specified via an optional argument:

    evaluate(scope, 'let b = 2;', 'bar.js', 1, '1.5');
    // throws cause `let` is not defined in JS 1.5.

## Load scripts ##

This module provides a limited API for loading scripts from local URLs.
`data:` URLs are supported.

    load(scope, 'resource://path/to/my/script.js');
    load(scope, 'file:///path/to/script.js');
    load(scope, 'data:,var a = 5;');
