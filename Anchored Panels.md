## Requirements

* the content of panels is composed from HTML content located in
the add-ons data folder.
* panels can be shown programmatically
* panels are always visually anchored to their related button

## API

I believe we don't need an additional component for that, but
some sugar syntax.
Once the [Navbar Buttons](./Navbar Buttons.md) are implemented,
we could have:

```js
const { data } = require("sdk/self");

let panel = require("sdk/panel").Panel();

let myButton = require("sdk/button").Button({
  id: "panel-button",
  image: data.url("icon.png"),
  label: "My Panel Button",
  type: "checked"
});

myButton.on("click", function() {
    // the status need to be "pressed"
    this.checked = true;

    // we can use the panel positioning API to display the
    // panel anchored to the button
    panel.show({position: myButton});
});

panel.on("hide", function() {
    // when the panel is hide, we have to "unpress" the button
    myButton.checked = false;
});
```

That would works for [Location bar buttons](./Location Bar Buttons.md)
too. Of course we could implement a `panel` property to buttons as
shortcut, as widget does:

```js
const { data } = require("sdk/self");

let panel = require("sdk/panel").Panel();

let myButton = require("sdk/button").Button({
  id: "panel-button",
  image: data.url("icon.png"),
  label: "My Panel Button",
  panel: panel
});
```

That basically does similar work of the previous code, under the
hood.

## Discussions

- https://etherpad.mozilla.org/anchored-panels

## Mockup

<img src="http://people.mozilla.com/~shorlander/files/addons-in-toolbar-i01/images/08.png">
