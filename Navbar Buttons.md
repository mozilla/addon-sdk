This Button component is the foundation of mostly all the new UI
components we're going to introduce in jetpack.

## Requirements

* two button modes: _'Toggle'_ and _'Action'_
* toggle mode has two visual states, on & off
* when the button is in 'toggle' mode, the API allows developers
to react to this change.
* when the API is in 'action' mode, the API allows developers
to assign a callback to handle the event created when a user clicks on the button.
* following UI specs, the size of a button can be only 16x16
(default), 32x16 or 64x16.
* button has an icon and a label. However, in default Firefox
settings label for button are hidden.
* button can be disabled
* button can have a badge to display text (around 3, 4 characters, 
typically numbers), or a small icons from a preset
(e.g. "warning" type, etc) see [badge mockup](#badge).

## API

The API follows the standard convention we have in jetpack for
the high level APIs.

```js
    const { Button } = require("sdk/ui");

    // Minimal "action" button
    let actionButton = Button({
      id: "my-button",
      label: "My Button",
      // Only local resource.
      // Without scheme takes the file from `data` folder
      icon: "./action.png"
    });

    // Minimal "toggle" button
    let toggleButton = Button({
      id: "another-button",
      label: "Another Button",
      icon: "./toggle.png",
      // `type` takes "button" (default) or "checkbox"
      type: "checkbox" // it's consistent with web and XUL
    });

    actionButton.on("click", function() {
      // do something when the button is clicked
    });

    toggleButton.on("change", function() {
      // do something when the checked status of
      // the button is changed
    }

    toggleButton.on("click", function() {
      // this is fired before "change" event when the state
      // is not changed yet
    });

    actionButton.on("change", function() {
      // never fired, it's an action button
    });

    // It's also possible use a set of icons with different
    // resolution, so Firefox will use the one that fit more
    let detailedButton = Button({
      id: "detailed-button",
      label: "A detailed button",
      // any size is allowed, the button will choose the one that fit
      // depends by the area where the button is (toolbar, panel) and
      // the pixel's ratio of the device (e.g. HiDPI devices)
      icon: {
        "16": "./icon-16.png",
        "32": "./icon-32.png",
        "48": "./icon-48.png"
      }
    });

    // a more complex button
    let drinkButton = Button({
      id: "drink-button",
      label: "Drink Beer",
      icon: "./beer.png",
      // default value, could be omitted
      type: "button",
      // `disabled` can be set in the options too
      disabled: true,
      // `size` can takes:
      // "small" (16, default), "medium" (32), "large" (64)
      size: "medium",
      // badge will display up to around four characters
      badge: {
        text: "+1",
        color: "#5fc24f" // any CSS color syntax is valid
      },
      // like other jetpack API, we can set the
      // listener directly in the object's
      // options
      onClick: function() {
        // update the badge text each click
        let drinkNumber = +this.badge.text;
        let badgeText = "+" + (drinkNumber + 1);
        let badgeColor = (drinkNumber > 10) ? "#fb2500" : "#5fc24f";

        this.badge = {text: badgeText, color: badgeColor};
      }
    });

    // it should be possible trigger the click programmatically too,
    // as for the panel it will emit the event on the button for the active window.
    drinkButton.click();

    // Once `size` is set, it can't be change, it's read-only. Therefore this code
    // will throw an exception
    drinkButton.size = "small";
```

### One Button, multiple states

The examples above doesn't take in account multiple states -
mostly – but only the global state. When a `Button` is created,
is automatically added to all existing windows, and also to any
future windows. A code like:

```js
    let drinkButton = Button({
      id: "drink-button",
      label: "Drink Beer",
      icon: "./beer.png",
      onClick: function() {
        let drinkNumber = +this.badge.text;
        let badgeText = "+" + (drinkNumber + 1);
        let badgeColor = (drinkNumber > 10) ? "#fb2500" : "#5fc24f";

        this.badge = {text: badgeText, color: badgeColor};
      }
    });
```

Will update all the badge's text and color of this button across 
all the windows. Plus, the new window will inherit that; so if a
window is opened after the button was clicked three times, the
badge on this new window will have `3` as text.

Sometimes this is useful, especially for button that represent a 
functionality across the whole browser. Other times it's
preferable having a more fine granularity, and be able to set –
and get – the property for a specific window, or tab.

Therefore we have a set of "states", or more properly a "states
chain":

- General State
  - Window State
      - Tab State

The _General State_ are the properties set in the options given
to the constructor, or set directly to the button's instance,
like the examples above. The _Window State_ and the _Tab State_
are set by the developer, in order to have some properties (e.g. 
text, badge, icon) only for a specific window, or tab. Because
it's a chain, the _Tab State_ takes the precedence over _Window
State_, and _Window State_ take the precedence over _General
State_. See the example above:

```js
const tabs = require("sdk/tabs");

tabs.on("active", function(tab) {
  // get the `state` of `drinkButton` for this tab.
  // if there is no state for this tab, it returns
  // the `state` for the tab's window if any.
  // Otherwise, the general state

  let state = drinkButton.stateFor(tab);

  // do something with the `state`
});
```

The `state` is also passed automatically to the event's handler, 
as first parameter:

```js
    let drinkButton = Button({
      id: "drink-button",
      label: "Drink Beer",
      icon: "./beer.png",
      onClick: function(state) {
        // `state` contains a snapshot of the properties
        // of the button clicked, it's similar to:
        // let state = this.stateFor(tabWhereTheButtonWasClicked);

        let drinkNumber = +state.badge.text;
        let badgeText = "+" + (drinkNumber + 1);
        let badgeColor = (drinkNumber > 10) ? "#fb2500" : "#5fc24f";

        let newState = {
          badge: {text: badgeText, color: badgeColor}
        };

        // setting a new state is not destructive
        // so there is no need to specify all the
        // properties, only the one changed.

        // here the state is applied to the active Tab,
        // it means the badge color and text would be
        // displayed only on this tab, when is active
        this.state(tabs.activeTab, newState);
      }
    });

    let drinkButton = Button({
      id: "drink-button",
      label: "Drink Beer",
      icon: "./beer.png",
      type: "checkbox",
      onChange: function(state) {
        if (state.checked) {
          let newState = {
            image: "./coffee.png",
            label: "Drink Coffee"
          };
        } else {
          let newState = {
            image: "./beer.png",
            label: "Drink Beer"
          };
        }

        // set the new icon only for the active window
        this.state(windows.activeWindow, newState);
      }
    });
```

## Notes

- The `badge` API here described are "nice to have" for the first
iteration.

## Discussions

- https://etherpad.mozilla.org/navbar-buttons

## Mockups

### Buttons
![Buttons Mockup](http://people.mozilla.com/~shorlander/files/addons-in-toolbar-i01/images/01.png)

### Badge
![Badge Mockup](http://people.mozilla.com/~mferretti/files/addons-in-toolbar/badge-mockup.png)