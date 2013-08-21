# Introduction

This project has two interleaved goals: to show add-on
developers that Mozilla is working to improve some of the most
basic needs of all add-on developers, and to greatly reduce the
problems that can be caused by add-ons trying to integrate with
the Firefox UI in the most basic of ways, by adding a button to
the Navigation bar.

### Project Goal

Provide a set of simple, usable APIs that cover the most common
Add-on use cases for integrating with the Firefox UI.

### Mockups

Stephen Horlander [created mockups](http://people.mozilla.com/~shorlander/files/addons-in-toolbar-i01/addons-in-toolbar.html)
for these UI pieces last year:

[<img src="http://people.mozilla.com/~shorlander/files/addons-in-toolbar-i01/images/addon-types.png">](http://people.mozilla.com/~shorlander/files/addons-in-toolbar-i01/addons-in-toolbar.html)

### Related APIs

[Erik Vold](https://github.com/erikvold/) has implemented a very popular
module that adds buttons into the [navigation bar](https://github.com/erikvold/toolbarbutton-jplib/).

### APIs

* [Toggle / Action Buttons](./Navbar Buttons.md) buttons that either
  trigger an action or toggle an on/off state. These buttons are the
  basic UI piece that anchors most other APIs.

* [Location Bar Buttons](./Location Bar Buttons.md) buttons or anchored
  panels that appear by default inside the location field.

* [Anchored Panels](./Anchored Panels.md) a button / panel combination.

* [Toolbars](./Toolbars.md) a toggle button / toolbar combination.

* [Sidebars](./Sidebars.md) a toggle button / sidebar combination.

### Project Dependencies

In order for Firefox to correctly support overflow of add-on items in the
navigation toolbar, we need to work with the Firefox's team to ensure that
our work lines up well with changes they are making to how customization
and overflow work as part of the Australis project.

