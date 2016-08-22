# Anchored Panels - [Bug 907450](https://bugzilla.mozilla.org/show_bug.cgi?id=907450)

## Requirements

* Content of panels is composed from HTML content located in the add-ons data folder.
* Panels can be shown programmatically
* Panels are always visually anchored to their related button

## API

No additional component are required for this, maybe some helper functions to
simplify a user workflow. With [Navbar Buttons](./Navbar Buttons.md) it's as
simple as:

```js
let { Panel } = require("sdk/panel");
let { ToggleButton } = require("sdk/panel");

let button = ToggleButton({
  id: "panel-button",
  image: "./icon.png",
  label: "My Panel Button"
});

let panel = Panel({ /*...*/ })

button.on("change", button => {
  if (button.checked) panel.show({ position: button })
  else panel.hide()
})
panel.on("show", () => button.checked = true)
panel.on("hide", () => button.checked = false)
```

That is going to works for [Location bar buttons](./Location Bar Buttons.md) as well
since they're no different.

To reduce boilerplate to a user we can provide polymorphic function to take care of it:

```js
let { Panel } = require("sdk/panel");
let { ToggleButton } = require("sdk/panel");

let anchor = method();

anchor.define(ToggleButton, function(button, panel) {
  // show / hide panel based depending on the state of
  // button.
  button.on("change", button => {
    if (button.checked) panel.show({ position: button })
    else panel.hide()
  })
  // Update button state depending on the button type
  panel.on("show", () => button.checked = true);
  panel.on("hide", () => button.checked = false);
});

anchor.define(ActionButton, function(button, panel) {
  button.on("click", button => panel.show({ position: button })
})

anchor(button, button);
```

Note that in the example above for sake of simplicity anchoring assumes
to deal with a panel, but approach could be enhanced even further to
enable general anchoring for example to anchor buttons with a sidebar
or widget with a panel etc...  All the new UI components can be made
compatible to anchoring gradually without changing any of the existing
UI components.


## Mockup

<img src="http://people.mozilla.com/~shorlander/files/addons-in-toolbar-i01/images/08.png">