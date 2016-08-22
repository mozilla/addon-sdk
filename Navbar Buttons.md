# Navbar Buttons - [Bug 907374](https://bugzilla.mozilla.org/show_bug.cgi?id=907374)

This Button component is the foundation of mostly all the new UI
components we're going to introduce in jetpack.

## Requirements

* Two button types: _'Toggle'_ and _'Action'_
* Toggle buttons have two visual states, on & off
* Toggle button allows developers to react to on / off state
changes.
* Action button allows developers to react on user clicks.
* Following UI specs, the size of a button can be only 16x16
(default), 32x16 or 64x16.
* Button has an icon and a label. However, in default Firefox
settings label for buttons are hidden.
* Button can be disabled
* Button can have a badge to display text (around 3, 4 characters,
typically numbers), or a small icons from a preset (e.g.
"warning" type, etc) see [badge mockup](#badge).

## API

The API follows the standard convention we have in SDK for the
high level APIs.

```js
    const { ActionButton, ToggleButton } = require("sdk/ui");

    // Minimal "action" button
    let actionButton = ActionButton({
      id: "my-button",
      label: "My Button",
      // Only local resource.
      // Without scheme takes the file from `data` folder
      icon: "./action.png"
    });


    // Minimal "toggle" button
    let toggleButton = ToggleButton({
      id: "another-button",
      label: "Another Button",
      icon: "./toggle.png"
    });

    actionButton.on("click", function() {
      // do something when the button is clicked
    });

    toggleButton.on("change", function() {
      // do something when the checked status of 
      // the button is changed
    }

    toggleButton.on("click", function() {
      // this is fired before state is change
      // Associated "change" event will happen afterwards
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
    // will throw an exception in strict mode or will have no effect in non strict mode.
    drinkButton.size = "small";
```

### Button contexts & locations

Buttons created via this API will be placed in the browser UI.
SDK will provide specific places context constants in which
buttons may be placed. Users of the API can declare desired
context at the instantiation:

```js
    let { ActionButton, ToggleButton, Navbar } = require("sdk/ui");
    let actionButton = ActionButton({
      id: "my-button",
      label: "My Button",
      // Only local resource.
      // Without scheme takes the file from `data` folder
      icon: "./action.png",
      context: Navbar
    });

    let toggleButton = ToggleButton({
      id: "another-button",
      label: "Another Button",
      icon: "./toggle.png",
      context: Navbar
    });
```

Note that above case use of `context` attribute is redundant  as 
a default context is `Navbar`. However there will be more
contexts that may affect look and feel and placement of these
buttons, see [Location Bar Buttons][] for more details.

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

Sometimes this is useful, especially when button triggers
functionality associated with an whole browser. Other times it
maybe preferable to have a more granular control, to set and get 
properties for a specific window, or tab.

Therefore we have a set of "states", or more properly a "states
chain":

- Common State
  - Window State
      - Tab State

The _Global State_ are the properties set in the options given
to a constructor, or set directly on the button instance, like
in examples above. The _Window State_ and the _Tab State_ are
set by the developer, in order to have some properties (e.g.
text, badge, icon) only for a specific window, or tab. Because
it's a chain, the _Tab State_ takes the precedence over _Window
State_, and _Window State_ take the precedence over _Global
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
    let drinkButton = ActionButton({
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

    let drinkButton = ToggleButton({
      id: "drink-button",
      label: "Drink Beer",
      icon: "./beer.png",
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

- The `badge` API here described are "nice to have" and may not be
present in first cut.

## Mockups

### Buttons
![Buttons Mockup](http://people.mozilla.com/~shorlander/files/addons-in-toolbar-i01/images/01.png)

### Badge
![Badge Mockup](http://people.mozilla.com/~mferretti/files/addons-in-toolbar/badge-mockup.png)

[Location Bar Buttons]:https://github.com/mozilla/addon-sdk/wiki/JEP-Location-Bar-Buttons-2
