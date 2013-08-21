This component is based on [Button](./Navbar Buttons.md) and
inherits mostly all the capabilities. However, it has some
important differences:

1. It's placed inside the Location bar (see the [Mockup](#mockup))
instead of Navigation bar
2. The `size` property is fixed to "small" (16px), and can't be
changed
3. The `set` property is fixed to `undefined` and can't be changed.
4. Set the `disabled` property to `true` makes it disappear, where
set it to `false` makes it visible
5. It's URL (and tab) sensitive

I would like to spend few words about the points 4th and 5th.

### Disabling a Location Bar Button

In the Firefox UI, the buttons in the location bar are not meant
to be disabled: if they are not "enabled" they're not visible.
If you "force" the disabled attribute on these such buttons, the
look & feel will be still the same of when they're active – no
difference at all – but they're not reactive. That's because
they will never be disabled and visible at the same time, so
there is no need to have such visual feedback for the user to
indicate such status: if they're not enabled, then they're not
visible.

This can be also observed in "New Tab" document, where the
bookmark star icon is not visible, because that page is not
supposed to be bookmarked.

Disabled a Location Bar Button means is not visible in the
location bar.

### "URL (and tab) sensitive" means multiple states

Navbar Button shared the same state across multiple views: each
browser window opened has a view of the button, that reflect the
button's state.

However, Location Bar Buttons are different: they have multiple
states to shared across multiple views.

Let's take the bookmark button in the location bar: I can have
one window with three tabs, where two of them are point to the
same URL, and this URL is bookmarked. The bookmark button will
be "checked" in both of them, but not in the third tab, that has
a different, and individual, state. It means each tab has it own
state, even if they share the same view.
With two windows, I will have two views. And a different state
for each tab is loaded in the windows.
And we don't have to focus on URL only: the same can be applied
to "RSS feed" button, where is visible only if the page's
content displayed in the tab has an RSS feed.

## Proposal

This proposal is based on top of the
[The Canonical Jetpack API proposal for Button](./Navbar Buttons.md),
and takes in account the differences exposed above.

```js
    /*
    * Location bar button
    */

    // See Navbar Button examples too

    // maybe `PageButton` instead of `LocationButton`?
    // it would be more consistent with `PageMod` too
    const { LocationButton } = require("sdk/button/location"); // or maybe `sdk/ui`?

    let patternButton = LocationButton({
      id: "drink-button",
      // it will be visible only to "*.mozilla.org"
      // see `page-mod`. It should be mandatory too.
      include: "*.mozilla.org",
      label: "Drink a Beer",
      image: data.url("beer.png")
    });

    patternButton.on("click", function() {
      console.log("Drink a Beer right now!");
    });

    // The button above will be automatically visible if the `include` rule is
    // matched, and hidden otherwise.
    // Let's create a button that is enabled only if we loaded an image (with
    // bug 671305 fixed, that should works)

    let imageButton = LocationButton({
      id: "drink-button",
      include: "*.mozilla.org",
      label: "Drink a Beer",
      image: data.url("beer.png"),
       // hidden by default, even if the `include` pattern is matched
      disabled: true
    });

    // this code will run on purpose on all URLs, not only the "*.mozilla.org"
    // ones, to show how `disabled` works.
    require("sdk/tabs").on("ready", function(tab) {
      // `disabled` works only if the match-pattern of `include` is satisfied.
      // it means that if the current tab's URL is not matching '*.mozilla.org',
      // then the button won't be displayed even if dev tries to set `disabled`
      // to `false`. In that case we could either raise an exception, or
      // simply keep the `disabled` property value to `true`.
      //
      // This is useful for scenario like the "RSS feed" button, that is
      // displayed based on the content of the page rather than the URL only.
      // It doesn't change the base shared state for `disabled`, only the
      // one related to the tab given
      imageButton.tabs(tab).disabled = tab.contentType.indexOf("image/") === -1;
    });
```

### Notes

The `tabs` collection of `LocationButton` / `PageButton` gives
to the add-on devs the flexibility to set the status of a button
per tab. The information not specified are inherited from the
global state of the button. That should be enough to replicate
any kind of button in location bar Firefox UI has already.

## Discussions

- https://etherpad.mozilla.org/locationbar-button

## Mockup

![mock](http://people.mozilla.com/~shorlander/files/addons-in-toolbar-i01/images/addon-types.png)

## Existing Work

* http://digdug2k.wordpress.com/2013/07/18/the-new-pageactions-are-here/
* https://github.com/mfinkle/skeleton-addon-fxandroid/blob/master/bootstrap.js
