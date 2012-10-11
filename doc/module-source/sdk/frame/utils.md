<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

The `frame/utils` module provides helper functions for working with platform
internals like [frames](https://developer.mozilla.org/en/XUL/iframe) and
[browsers](https://developer.mozilla.org/en/XUL/browser).

### create

Module exports `create` function that takes `nsIDOMDocument` of the
[privileged document](https://developer.mozilla.org/en/Working_with_windows_in_chrome_code)
and creates a `browser` element in it's `documentElement`:

    let { open } = require('api-utils/window/utils');
    let { create } = require('api-utils/frame/utils');
    let window = open('data:text/html,Foo');
    let frame = create(window.document);

Optionally `create` can be passed set of `options` to configure created frame
even further. Following options are supported:

- `type`
String that defines access type of the document loaded into it. Defaults to
`'content'`. For more details and other possible values see
[documentation on MDN](https://developer.mozilla.org/en/XUL/Attribute/browser.type)

- `uri`
URI of the document to be loaded into created frame. Defaults to `about:blank`.

- `remote`
If `true` separate process will be used for this frame, also in such case all
the following options are ignored.

- `allowAuth`
Whether to allow auth dialogs. Defaults to `false`.

- `allowJavascript`
Whether to allow Javascript execution. Defaults to `false`.

- `allowPlugins`
Whether to allow plugin execution. Defaults to `false`.

Execution of scripts may easily be enabled:

    let { open } = require('api-utils/window/utils');
    let { create } = require('api-utils/frame/utils');
    let window = open('data:text/html,top');
    let frame = create(window.document, {
      uri: 'data:text/html,<script>alert("Hello")</script>',
      allowJavascript: true
    });

