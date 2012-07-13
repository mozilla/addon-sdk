<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

Provides an API for creating javascript sandboxes and for executing scripts
in them.

### Create a sandbox ###

For the starting point you need to create a sandbox:

    const { sandbox, evaluate, load } = require("api-utils/sandbox");
    let scope = sandbox('http://example.com');

Argument passed to the sandbox defines it's privileges. Argument may be an URL
string, in which case sandbox will get exact same privileges as a scripts
loaded from that URL. Argument also could be a DOM window object, to inherit
privileges from the window being passed. Finally if argument is omitted or is
`null` sandbox will have a chrome privileges giving it access to all the XPCOM
components. Optionally `sandbox` function can be passed a second optional
argument (See [sandbox documentation on MDN](https://developer.mozilla.org/en/Components.utils.Sandbox#Optional_parameter)
for details).

### Evaluate code ###

Module provides `evaluate` function that allows executing code in the given
sandbox:

    evaluate(scope, 'var a = 5;');
    evaluate(scope, 'a + 2;');      //=> 7

More details about evaluated script may be passed via optional arguments that
may improve an exception reporting:

    // Evaluate code as if it was loaded from 'http://foo.com/bar.js' and
    // start from 2nd line.
    evaluate(scope, 'a ++', 'http://foo.com/bar.js', 2);

Version of JavaScript can be also specified via optional argument:

    evaluate(scope, 'let b = 2;', 'bar.js', 1, '1.5');
    // throws cause `let` is not defined in JS 1.5.

### Loading scripts ###

API provides limited API for loading scripts right form the local URLs,
but data: URLs are supported.

    load(scope, 'resource://path/to/my/script.js');
    load(scope, 'file:///path/to/script.js');
    load(scope, 'data:,var a = 5;');