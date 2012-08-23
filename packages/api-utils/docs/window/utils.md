<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

The `window/utils` module provides helper functions for working with
application windows.

### getInnerId

Returns the ID of the given window's current inner window.

### getOuterId

Returns the ID of the given window's outer window.

### getXULWindow

Module provides `getXULWindow` function that can be used get access
[nsIXULWindow](https://developer.mozilla.org/en/nsIDOMWindow) for the given
[nsIDOMWindow](https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsIXULWindow):

    let { Ci } = require('chrome');
    let utils = require('api-utils/window/utils');
    let active = utils.activeBrowserWindow;
    active instanceof Ci.nsIXULWindow // => false
    utils.getXULWindow(active) instanceof Ci.nsIXULWindow // => true

### getBaseWindow

Module provides `getBaseWindow` function that can be used get access
[nsIBaseWindow](http://mxr.mozilla.org/mozilla-central/source/widget/nsIBaseWindow.idl)
for the given [nsIDOMWindow](https://developer.mozilla.org/en/nsIDOMWindow):

    let { Ci } = require('chrome');
    let utils = require('api-utils/window/utils');
    let active = utils.activeBrowserWindow;
    active instanceof Ci.nsIBaseWindow // => false
    utils.getBaseWindow(active) instanceof Ci.nsIBaseWindow // => true

### open

Module exports `open` function that may be used to open top level
(application) windows. Function takes `uri` of the window document as a first
argument and optional hash of `options` as second argument.

    let { open } = require('api-utils/window/utils');
    let window = open('data:text/html,Hello Window');

Following options may be provided to configure created window behavior:

- `parent`
If provided must be `nsIDOMWindow` and will be used as parent for the created
window.

- `name`
Optional name that will be assigned to the window.

- `features`
Hash of options that will be serialized to features string. See
[features documentation](https://developer.mozilla.org/en/DOM/window.open#Position_and_size_features)
for more details.

        let { open } = require('api-utils/window/utils');
        let window = open('data:text/html,Hello Window', {
          name: 'jetpack window',
          features: {
            width: 200,
            height: 50,
            popup: true
          }
        });

### backgroundify

Module exports `backgroundify` function that takes `nsIDOMWindow` and
removes it from the application's window registry, so that they won't appear
in the OS specific window lists for the application.

    let { backgroundify, open } = require('api-utils/window/utils');
    let bgwin = backgroundify(open('data:text/html,Hello backgroundy'));

Optionally more configuration options via second `options` argument. If
`options.close` is `false` unregistered window won't automatically
be closed on application quit, preventing application from quitting. While this
is possible you should make sure to close all such windows manually:

    let { backgroundify, open } = require('api-utils/window/utils');
    let bgwin = backgroundify(open('data:text/html,Foo'), {
      close: false
    });

### isBrowser

Returns true if the given window is a Firefox browser window.
(i.e windows with chrome://browser/content/browser.xul document)
