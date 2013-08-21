## Proposal

It should be possible to create menuitems for browser windows on Firefox and Fennec.

### Use Cases

Sidebars and Toolbars require menuitems in the (View - > Sidebar/Toolbar) menu.  DevTools require a menuitem in Tools -> Web Developer.  Firefox itself, and many add-ons, provide toolbarbutton-menus for which other add-ons would like to extend (example: the Bookmarks toolbar button).

## Implementation

The design would closely match that for Context Menuitems, but leave out all of the extra context related events and message passing.

### API

#### Constructors

##### Menuitem

* options
  * `String` label: the text displayed in the menuitem.
  * `Array` context: describes menu which the menuitem will live under.  In the array, the first valid parent in the array will be used.
  * `Boolean` [diabled]: this should be `false` if you want the menuitem to be displayed and unclickable.
  * `Boolean` [visible]: this should be `false` if you want the menuitem to be hidden, default is `true`.

###### Properties

  * `String` id  (only getter): the id for the menuitem.
  * `String` label (only getter): the text displayed in the menuitem.
  * `Boolean` disabled (getter and setter): the enabled state of the menuitem.
  * `Boolean` visible (getter and setter): the visible state of the menuitem.

##### Methods

 * destroy: destroys the menuitem

###### Events

* click

### Examples

#### Using `Menuitem` constants for `attachTo`

```javascript
var { Menuitem } = require('sdk/ui');

var menuitem = Menuitem({
  label: "Not Checked",
  menu: [ Menuitem.FILE_MENU, Menuitem.APP_MENU ],
  onClick: function() {
    // do something..
  }
})
```

#### Using Strings in `menu`

```javascript
var { Menuitem } = require('sdk/ui');

var menuitem = Menuitem({
  label: "Not Checked",
  menu: [ 'file', 'application' ],
  onClick: function() {
    // do something..
  }
})
```

## Prior Art

* https://github.com/voldsoftware/menuitems-jplib
