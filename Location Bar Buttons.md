# Location Bar Buttons - [Bug 907379](https://bugzilla.mozilla.org/show_bug.cgi?id=907379)

Location bar buttons are regular buttons described by a
[Navbar Buttons][] API, but used in specific `context` that
implies semantic and visual differences.

1. These buttons are placed inside the Location bar (see the
[Mockup](#mockup)) instead of Navigation bar.
2. Limited size of location bar implies fixed "small" (16px)
`size` for its buttons. Attempts to use different size are
simply ignored and buttons of 16px are rendered (maybe
warnings are dumped and nothing is rendered).
3. Button in the location bar, unlike ones in the navbar, when
`disabled` (field is set to `true`) simply are not displayed.
4. Button in the location bar are associated to a content document
under that URL.

### Disabled buttons in Location Bar

Disabling button in the location bar means that given button is
not relevant in the given page context, there for it is not displayed. For example this behaviour can be observed on a "New
Tab" page, where the bookmark button (star icon) is not present, 
since bookmarking that page makes no sense.

So to summarise, disabling button in the context of location bar 
means not relevant and there for not displayed, until enabled
again.

### Context sensitivity

In contrast to button placed in the navigation bar, button
placed in the location bar implies `context` of the page under
the given location. Logically this button must be given
`context` of pages reflecting when it is relevant. To do that
button must be given a `context` of [MatchPattern][] (already
known from page-mod API):

```js
    const { ActionButton } = require("sdk/ui);
    const { MatchPattern } = require("page-mod/match-pattern);

    let patternButton = ActionButton({
      id: "drink-button",
      // Button is only enabled, there for present on pages that
      // match "*.mozilla.org" pattern.
      context: MatchPattern("*.mozilla.org"),
      label: "Drink a Beer",
      image: "./beer.png"
    });

    patternButton.on("click", function() {
      console.log("Drink a Beer right now!");
    });
```

Note that in example above `MatchPattern` was used to specify
context, although it's redundant and pattern string or regexp
could be used directly.

Since button is given a `context` of specific pages it will only
be present on pages that matches that `context`.

### States

Location bar buttons are just a regular buttons, there for their
behaviour is the same, they comply to same "state chain" rules,
but again only present in a relevant page contexts.

```js
    let { ToogleButton } = require("sdk/ui");

    let readLater = ToggleButton({
      id: "read-button",
      // Note: this time we just duck typed pattern
      context "*",
      label: "read later",
      image: "./read-off.png",
      checked: false,
       // hidden by default, even if the `context` pattern is matched
      disabled: true,
      // Add remove item to a read list.
      onChange: function() { /* ... * / }
    });

    // This just illustrates how `disabled` works.
    require("sdk/tabs").on("ready", function(tab) {
      // In this case whether button is displayed or not depends on
      // the content of the page rather than URL. If button does not
      // relevant in the given `tab` context it's not displayed anyway
      // so updating state will have no effect.
      readLater.state(tab, {
        disabled: tab.contentType.indexOf("image/") === -1,
        checked: !isInReadmeList(tab.url)
      });
    });
```

Note that above example illustrates how state is set per tab,
but all other rules also apply. General state can also be set to 
disable/enable all of the buttons or check / uncheck them. State
updates can also be done at the window level. 


## Mockup

![mockup](http://people.mozilla.com/~shorlander/files/addons-in-toolbar-i01/images/addon-types.png)

## Existing Work

* ﻿http://digdug2k.wordpress.com/2013/07/18/the-new-pageactions-are-here/
* https://github.com/mfinkle/skeleton-addon-fxandroid/blob/master/bootstrap.js


[MatchPattern]:https://addons.mozilla.org/en-US/developers/docs/sdk/latest/modules/sdk/page-mod/match-pattern.html
[Navbar Buttons]:./Navbar Buttons.md
