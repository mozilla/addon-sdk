<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

<!-- contributed by Drew Willcoxon [adw@mozilla.com] -->
<!-- edited by Erik Vold [erikvvold@gmail.com] -->

The `window-utils` module provides helpers for accessing and tracking
application windows.  These windows implement the [`nsIDOMWindow`][nsIDOMWindow]
interface.

[nsIDOMWindow]: http://mxr.mozilla.org/mozilla-central/source/dom/interfaces/base/nsIDOMWindow.idl

### getXULWindow

Module provides `getXULWindow` function that can be used get access
[nsIXULWindow] for the given [nsIDOMWindow]\:
[nsIDOMWindow]:https://developer.mozilla.org/en/nsIDOMWindow
[nsIXULWindow]:https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsIXULWindow

    let { Ci } = require('chrome');
    let utils = require('api-utils/window-utils');
    let active = utils.activeBrowserWindow;
    active instanceof Ci.nsIXULWindow // => false
    utils.getXULWindow(active) instanceof Ci.nsIXULWindow // => true

### getBaseWindow

Module provides `getBaseWindow` function that can be used get access
[nsIBaseWindow] for the given [nsIDOMWindow]\:
[nsIDOMWindow]:https://developer.mozilla.org/en/nsIDOMWindow
[nsIBaseWindow]:http://mxr.mozilla.org/mozilla-central/source/widget/nsIBaseWindow.idl

    let { Ci } = require('chrome');
    let utils = require('api-utils/window-utils');
    let active = utils.activeBrowserWindow;
    active instanceof Ci.nsIBaseWindow // => false
    utils.getBaseWindow(active) instanceof Ci.nsIBaseWindow // => true

### open

Module exports `open` function that may be used to open top level
(application) windows. Function takes `uri` of the window document as a first
argument and optional hash of `options` as second argument.

    let { open } = require('api-utils/window-utils');
    let window = open('data:text/html,Hello Window');

Following options may be provided to used to configure created window behavior:

- `parent`
If provided must be `nsIDOMWindow` and will be used as parent for the created
window.

- `name`
Optional name that will assigned to the window.

- `features`
Hash of option that will be serialized to features string. See
[features documentation](https://developer.mozilla.org/en/DOM/window.open#Position_and_size_features)
for more details.

    let { open } = require('api-utils/window-utils');
    let window = open('data:text/html,Hello Window', {
      name: 'jetpack window',
      features: {
        chrome: true,
        width: 200,
        height: 50,
        popup: true
      }
    });


### backgroundify

Module exports `backgroundify` function that takes `nsIDOMWindow` and
removes it from the application's window registry, so that they won't appear
in the OS specific window lists for the application.

    let { backgroundify, open } = require('api-utils/window-utils');
    let bgwin = backgroundify(open('data:text/html,Hello backgroundy'));

If optional `options.close` is `false` unregistered window won't automatically
be closed on application quit, preventing application from quiting. While this
is possible you should make sure to close all such windows manually:

    let { backgroundify, open } = require('api-utils/window-utils');
    let bgwin = backgroundify(open('data:text/html,Foo', {
      close: false
    }));

### createFrame

Module exports `createFrame` function that takes `nsIDOMDocument` of the
privileged document (which is either top level window or document from chrome)
and creates a `browser` element in it's `documentElement`:

    let { newFrame, open } = require('api-utils/window-utils');
    let window = open('data:text/html,Foo');
    let frame = newFrame(window.document);

Optionally `newFrame` can be passed set of `options` to configure frame
even further. Following option are supported:

- type
String that defines access type of the document loaded into it. Defaults to
`'content'`. For more details and other possible values see
[documentation on MDN](https://developer.mozilla.org/en/XUL/Attribute/browser.type)

- uri
URI of the document to be loaded into created frame. Defaults to `about:blank`.

- remote
If `true` separate process will be used for this frame, also in such case all
the following options are ignored.

- allowAuth
Whether to allow auth dialogs. Defaults to `false`.

- allowJavascript
Whether to allow Javascript execution. Defaults to `false`.

- allowPlugins
Whether to allow plugin execution. Defaults to `false`.

    let { newFrame, open } = require('api-utils/window-utils');
    let window = open('data:text/html,top');
    let frame = newFrame(window.document, {
      uri: 'data:text/html,<script>alert("Hello")</script>',
      allowJavascript: true
    });


<api name="WindowTracker">
@class
`WindowTracker` objects make it easy to "monkeypatch" windows when a program is
loaded and "un-monkeypatch" those windows when the program is unloaded.  For
example, if a Firefox add-on needs to add a status bar icon to all browser
windows, it can use a single `WindowTracker` object to gain access to windows
when they are opened and closed and also when the add-on is loaded and unloaded.

When a window is opened or closed, a `WindowTracker` notifies its delegate
object, which is passed to the constructor.  The delegate is also notified of
all windows that are open at the time that the `WindowTracker` is created and
all windows that are open at the time that the `WindowTracker` is unloaded.  The
caller can therefore use the same code to act on all windows, regardless of
whether they are currently open or are opened in the future, or whether they are
closed while the parent program is loaded or remain open when the program is
unloaded.

When a window is opened or when a window is open at the time that the
`WindowTracker` is created, the delegate's `onTrack()` method is called and
passed the window.

When a window is closed or when a window is open at the time that the
`WindowTracker` is unloaded, the delegate's `onUntrack()` method is called and
passed the window.  (The `WindowTracker` is unloaded when its its `unload()`
method is called, or when its parent program is unloaded, disabled, or
uninstalled, whichever comes first.)

**Example**

    var delegate = {
      onTrack: function (window) {
        console.log("Tracking a window: " + window.location);
        // Modify the window!
      },
      onUntrack: function (window) {
        console.log("Untracking a window: " + window.location);
        // Undo your modifications!
      }
    };
    var winUtils = require("window-utils");
    var tracker = new winUtils.WindowTracker(delegate);

<api name="WindowTracker">
@constructor
  A `WindowTracker` object listens for openings and closings of application
  windows.
@param delegate {object}
  An object that implements `onTrack()` and `onUntrack()` methods.
@prop onTrack {function}
  A function to be called when a window is open or loads, with the window as the
  first and only argument.
@prop [onUntrack] {function}
  A function to be called when a window unloads, with the window as the first
  and only argument.
</api>
</api>

<api name="windowIterator">
@function
  An iterator for windows currently open in the application.

**Example**

    var winUtils = require("window-utils");
    for (window in winUtils.windowIterator())
      console.log("An open window! " + window.location);

</api>

<api name="closeOnUnload">
@function
  Marks an application window to be closed when the program is unloaded.
@param window {window}
  The window to close.
</api>
