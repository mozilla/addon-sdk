<!-- contributed by Irakli Gozalishvili [gozala@mozilla.com]  -->

Some add-ons may wish to define keyboard shortcuts for certain operations. This
module exposes API to create those.

<api name="create">
@function

Module exports `create` method allowing users to create a general keyboard
shortcuts.

@param bindings {Object}
Function takes `bindings` object as an argument that is a map of
key bindings. Property names of the given `bindings` object represents unique
identifiers (application wide) for the keyboard binding, that is described by
a value of that property.

_Please note: Bindings with conflicting identifier names will be just ignored,
so please make sure that no other binding has a same name._

Each property of the `bindings` object has to contain either `key` or
`keycode` property and optionally `modifiers` property.

  @prop [key] {String}
  The `key` property is used to specify the key that must be pressed. However,
  there will also be cases where you want to refer to keys that cannot be
  specified with a character (such as the Enter key or the function keys). The
  key attribute can only be used for printable characters. Another property,
  `keycode` can be used for non-printable characters.

  @prop [keycode] {String}
    The `keycode` attribute should be set to a special code which represents the
    key you want. A table of the keys can be found under the [following link]
    (https://developer.mozilla.org/en/XUL_Tutorial/Keyboard_Shortcuts#Keycode_attribute).
    _Please note: Not all of the keys are available on all keyboards._
  @prop [modifiers] {String[]}
    The modifiers that must be pressed are indicated with the array of modifier
    keys. Following list of modifier keys are supported:

    - "alt"
      The user must press the Alt key. On the Macintosh, this is the Option key.
    - "control"
      The user must press the Control key.
    - "meta"
      The user must press the Meta key. This is the Command key on the
      Macintosh.
    - "shift"
      The user must press the Shift key.
    - "accel"
      The user must press the special accelerator key. The key used for
      keyboard shortcuts on the user's platform. Usually, this would be the
      value you would use.
  @prop  [onInvoke] {function}
  The callback function that is called after keyboard shortuct is invoked.

## Example ##

    // Define keyboard shortcuts for showing and hiding a custom panel.
    var keybindings = require("key-bindings");
    keybindings.create({
      "openSamplePanel": {
        modifiers: ["accel"],
        key: "p",
        onInvoke: openSamplePanel
      },
      "hideSamplePanel": {
        modimodifiers: ["accel", "shift"],
        key: "p",
        onInvoke: hideSamplePanel
      }
    });

</api>
<api name="bindings">
@property {Object}

Map of all the bindings that are already registered. The map may be used to
make sure that no other binding with conflicting name or key combination is
registered already.
</api>

[Mozilla keyboard planning FAQ]:http://www.mozilla.org/access/keyboard/
[keyboard shortcuts]:https://developer.mozilla.org/en/XUL_Tutorial/Keyboard_Shortcuts

