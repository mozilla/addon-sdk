<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

<!-- contributed by Irakli Gozalishvili [gozala@mozilla.com]  -->

Some add-ons may wish to define keyboard shortcuts for certain operations. This
module exposes an API to create those.

<api name="Hotkey">
@class

Module exports `Hotkey` constructor allowing users to create a `hotkey` for the
host application.

<api name="Hotkey">
@constructor
Creates a hotkey who's `onPress` listener method is invoked when key combination
defined by `hotkey` is pressed.

Please note: If more than one `hotkey` is created for the same key
combination, the listener is executed only on the last one created

@param options {Object}
  Options for the hotkey, with the following keys:

@prop combo {String}
Any function key: `"f1, f2, ..., f24"` or key combination in the format
of `'modifier-key'`:

      "accel-s"
      "meta-shift-i"
      "control-alt-d"

Modifier keynames:

- **shift**: The Shift key.
- **alt**: The Alt key. On the Macintosh, this is the Option key. On
  Macintosh this can only be used in conjunction with another modifier,
  since `Alt-Letter` combinations are reserved for entering special
  characters in text.
- **meta**: The Meta key. On the Macintosh, this is the Command key.
- **control**: The Control key.
- **accel**: The key used for keyboard shortcuts on the user's platform,
  which is Control on Windows and Linux, and Command on Mac. Usually, this
  would be the value you would use.

@prop onPress {Function}
Function that is invoked when the key combination `hotkey` is pressed.

</api>
<api name="destroy">
@method
Stops this instance of `Hotkey` from reacting on the key combinations. Once
destroyed it can no longer be used.
</api>
</api>

## Example ##

    // Define keyboard shortcuts for showing and hiding a custom panel.
    var { Hotkey } = require("hotkeys");

    var showHotKey = Hotkey({
      combo: "accel-shift-o",
      onPress: function() {
        showMyPanel();
      }
    });
    var hideHotKey = Hotkey({
      combo: "accel-alt-shift-o",
      onPress: function() {
        hideMyPanel();
      }
    });

[Mozilla keyboard planning FAQ]:http://www.mozilla.org/access/keyboard/
[keyboard shortcuts]:https://developer.mozilla.org/en/XUL_Tutorial/Keyboard_Shortcuts
