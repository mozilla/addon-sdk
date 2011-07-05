<!-- contributed by Drew Willcoxon [adw@mozilla.com]  -->
<!-- edited by Noelle Murata [fiveinchpixie@gmail.com]  -->

The `context-menu` module lets you add items to Firefox's page context menu.


Introduction
------------

The `context-menu` API provides a simple, declarative way to add items to the
page's context menu.  You can add items that perform an action when clicked,
submenus, and menu separators.

Instead of manually adding items when particular contexts occur and then
removing them when those contexts go away, you *bind* items to contexts, and the
adding and removing is automatically handled for you.  Items are bound to
contexts in much the same way that event listeners are bound to events.  When
the user invokes the context menu, all of the items bound to the current context
are automatically added to the menu.  If no items are bound, none are added.
Likewise, any items that were previously in the menu but are not bound to the
current context are automatically removed from the menu.  You never need to
manually remove your items from the menu unless you want them to never appear
again.

For example, if your extension needs to add a context menu item whenever the
user visits a certain page, don't create the item when that page loads, and
don't remove it when the page unloads.  Rather, create your item only once and
supply a context that matches the target URL.


Specifying Contexts
-------------------

As its name implies, the context menu should be reserved for the occurrence of
specific contexts.  Contexts can be related to page content or the page itself,
but they should never be external to the page.

For example, a good use of the menu would be to show an "Edit Image" item when
the user right-clicks an image in the page.  A bad use would be to show a
submenu that listed all the user's tabs, since tabs aren't related to the page
or the node the user clicked to open the menu.

### The Page Context

First of all, you may not need to specify a context at all.  When an item does
not specify a context, the page context applies.

The *page context* occurs when the user invokes the context menu on a
non-interactive portion of the page.  Try right-clicking a blank spot in this
page, or on text.  Make sure that no text is selected.  The menu that appears
should contain the items "Back", "Forward", "Reload", "Stop", and so on.  This
is the page context.

The page context is appropriate when your item acts on the page as a whole.  It
does not occur when the user invokes the context menu on a link, image, or other
non-text node, or while a selection exists.

### Declarative Contexts

You can specify some simple, declarative contexts when you create a menu item by
setting the `context` property of the options object passed to its constructor,
like this:

    var cm = require("context-menu");
    cm.Item({
      label: "My Menu Item",
      context: cm.URLContext("*.mozilla.org")
    });

These contexts may be specified by calling the following constructors.  Each is
exported by the `context-menu` module.

<table>
  <tr>
    <th>Constructor</th>
    <th>Description</th>
  </tr>
  <tr>
    <td><code>
      PageContext()
    </code></td>
    <td>
      The page context.
    </td>
  </tr>
  <tr>
    <td><code>
      SelectionContext()
    </code></td>
    <td>
      This context occurs when the menu is invoked on a page in which the user
      has made a selection.
    </td>
  </tr>
  <tr>
    <td><code>
      SelectorContext(selector)
    </code></td>
    <td>
      This context occurs when the menu is invoked on a node that either matches
      <code>selector</code>, a CSS selector,  or has an ancestor that matches.
      <code>selector</code> may include multiple selectors separated by commas,
      e.g., <code>"a[href], img"</code>.
    </td>
  </tr>
  <tr>
    <td><code>
      URLContext(matchPattern)
    </code></td>
    <td>
      This context occurs when the menu is invoked on pages with particular
      URLs.  <code>matchPattern</code> is a match pattern string or an array of
      match pattern strings.  When <code>matchPattern</code> is an array, the
      context occurs when the menu is invoked on a page whose URL matches any of
      the patterns.  These are the same match pattern strings that you use with
      the <a href="packages/addon-kit/docs/page-mod.html"><code>page-mod</code></a>
      <code>include</code> property.
      <a href="packages/api-utils/docs/match-pattern.html">Read more about patterns</a>.
    </td>
  </tr>
  <tr>
    <td>
      array
    </td>
    <td>
      An array of any of the other types.  This context occurs when all contexts
      in the array occur.
    </td>
  </tr>
</table>

Menu items also have a `context` property that can be used to add and remove
declarative contexts after construction.  For example:

    var context = require("context-menu").SelectorContext("img");
    myMenuItem.context.add(context);
    myMenuItem.context.remove(context);

When a menu item is bound to more than one context, it appears in the menu when
all of those contexts occur.

### In Content Scripts

The declarative contexts are handy but not very powerful.  For instance, you
might want your menu item to appear for any page that has at least one image,
but declarative contexts won't help you there.

When you need more control control over the context in which your menu items are
shown, you can use content scripts.  Like other APIs in the SDK, the
`context-menu` API uses
[content scripts](dev-guide/addon-development/web-content.html) to let your
add-on interact with pages in the browser.  Each menu item you create in the
top-level context menu can have a content script.

A special event named `"context"` is emitted in your content scripts whenever
the context menu is about to be shown.  If you register a listener function for
this event and it returns true, the menu item associated with the listener's
content script is shown in the menu.

For example, this item appears whenever the context menu is invoked on a page
that contains at least one image:

    require("context-menu").Item({
      label: "This Page Has Images",
      contentScript: 'self.on("context", function (node) {' +
                     '  return !!document.querySelector("img");' +
                     '});'
    });

Note that the listener function has a parameter called `node`.  This is the node
in the page that the user context-clicked to invoke the menu.  You can use it to
determine whether your item should be shown.

You can both specify declarative contexts and listen for contexts in a content
script.  In that case, the declarative contexts are evaluated first.  If they
are not current, then your context listener is never called.

This example takes advantage of that fact.  The listener can be assured that
`node` will always be an image:

    require("context-menu").Item({
      label: "A Mozilla Image",
      context: contextMenu.SelectorContext("img"),
      contentScript: 'self.on("context", function (node) {' +
                     '  return /mozilla/.test(node.src);' +
                     '});'
    });

Your item is shown only when all declarative contexts are current and your
context listener returns true.


Handling Menu Item Clicks
-------------------------

In addition to using content scripts to listen for the `"context"` event as
described above, you can use content scripts to handle item clicks.  When the
user clicks your menu item, an event named `"click"` is emitted in the item's
content script.

Therefore, to handle an item click, listen for the `"click"` event in that
item's content script like so:

    require("context-menu").Item({
      label: "My Item",
      contentScript: 'self.on("click", function (node, data) {' +
                     '  console.log("Item clicked!");' +
                     '});'
    });

Note that the listener function has parameters called `node` and `data`.  `node`
is the node that the user context-clicked to invoke the menu.  You can use it
when performing some action.  `data` is the `data` property of the menu item
that was clicked.  Since only top-level menu items have content scripts, this
comes in handy for determining which item in a `Menu` was clicked:

    var cm = require("context-menu");
    cm.Menu({
      label: "My Menu",
      contentScript: 'self.on("click", function (node, data) {' +
                     '  console.log("You clicked " + data);' +
                     '});',
      items: [
        cm.Item({ label: "Item 1", data: "item1" }),
        cm.Item({ label: "Item 2", data: "item2" }),
        cm.Item({ label: "Item 3", data: "item3" })
      ]
    });

Often you will need to collect some kind of information in the click listener
and perform an action unrelated to content.  To communicate to the menu item
associated with the content script, the content script can call the
`postMessage` function attached to the global `self` object, passing it some
JSON-able data.  The menu item's `"message"` event listener will be called with
that data.

    require("context-menu").Item({
      label: "Edit Image",
      context: contextMenu.SelectorContext("img"),
      contentScript: 'self.on("click", function (node, data) {' +
                     '  self.postMessage(node.src);' +
                     '});',
      onMessage: function (imgSrc) {
        openImageEditor(imgSrc);
      }
    });


Updating a Menu Item's Label
----------------------------

Each menu item must be created with a label, but you can change its label later
using a couple of methods.

The simplest method is to set the menu item's `label` property.  This example
updates the item's label based on the number of times it's been clicked:

    var numClicks = 0;
    var myItem = require("context-menu").Item({
      label: "Click Me: " + numClicks,
      contentScript: 'self.on("click", self.postMessage);',
      onMessage: function () {
        numClicks++;
        this.label = "Click Me: " + numClicks;
        // Setting myItem.label is equivalent.
      }
    });

Sometimes you might want to update the label based on the context.  For
instance, if your item performs a search with the user's selected text, it would
be nice to display the text in the item to provide feedback to the user.  In
these cases you can use the second method.  Recall that your content scripts can
listen for the `"context"` event and if your listeners return true, the items
associated with the content scripts are shown in the menu.  In addition to
returning true, your `"context"` listeners can also return strings.  When a
`"context"` listener returns a string, it becomes the item's new label.

This item implements the aforementioned search example:

    var cm = require("context-menu");
    cm.Item({
      label: "Search Google",
      context: cm.SelectionContext(),
      contentScript: 'self.on("context", function () {' +
                     '  var text = window.getSelection().toString();' +
                     '  if (text.length > 20)' +
                     '    text = text.substr(0, 20) + "...";' +
                     '  return "Search Google for " + text;' +
                     '});'
    });

The `"context"` listener gets the window's current selection, truncating it if
it's too long, and includes it in the returned string.  When the item is shown,
its label will be "Search Google for `text`", where `text` is the truncated
selection.


More Examples
-------------

For conciseness, these examples create their content scripts as strings and use
the `contentScript` property.  In your own add-on, you will probably want to
create your content scripts in separate files and pass their URLs using the
`contentScriptFile` property.  See
[Working with Content Scripts](dev-guide/addon-development/web-content.html)
for more information.

Show an "Edit Page Source" item when the user right-clicks a non-interactive
part of the page:

    require("context-menu").Item({
      label: "Edit Page Source",
      contentScript: 'self.on("click", function (node, data) {' +
                     '  self.postMessage(document.URL);' +
                     '});',
      onMessage: function (pageURL) {
        editSource(pageURL);
      }
    });

Show an "Edit Image" item when the menu is invoked on an image:

    require("context-menu").Item({
      label: "Edit Image",
      context: contextMenu.SelectorContext("img"),
      contentScript: 'self.on("click", function (node, data) {' +
                     '  self.postMessage(node.src);' +
                     '});',
      onMessage: function (imgSrc) {
        openImageEditor(imgSrc);
      }
    });

Show an "Edit Mozilla Image" item when the menu is invoked on an image in a
mozilla.org or mozilla.com page:

    var cm = require("context-menu");
    cm.Item({
      label: "Edit Mozilla Image",
      context: [
        cm.URLContext(["*.mozilla.org", "*.mozilla.com"]),
        cm.SelectorContext("img")
      ],
      contentScript: 'self.on("click", function (node, data) {' +
                     '  self.postMessage(node.src);' +
                     '});',
      onMessage: function (imgSrc) {
        openImageEditor(imgSrc);
      }
    });

Show an "Edit Page Images" item when the page contains at least one image:

    require("context-menu").Item({
      label: "Edit Page Images",
      // This ensures the item only appears during the page context.
      context: contextMenu.PageContext(),
      contentScript: 'self.on("context", function (node) {' +
                     '  var pageHasImgs = !!document.querySelector("img");' +
                     '  return pageHasImgs;' +
                     '});' +
                     'self.on("click", function (node, data) {' +
                     '  var imgs = document.querySelectorAll("img");' +
                     '  var imgSrcs = [];' +
                     '  for (var i = 0 ; i < imgs.length; i++)' +
                     '    imgSrcs.push(imgs[i].src);' +
                     '  self.postMessage(imgSrcs);' +
                     '});',
      onMessage: function (imgSrcs) {
        openImageEditor(imgSrcs);
      }
    });

Show a "Search With" menu when the user right-clicks an anchor that searches
Google or Wikipedia with the text contained in the anchor:

    var cm = require("context-menu");
    var googleItem = cm.Item({
      label: "Google",
      data: "http://www.google.com/search?q="
    });
    var wikipediaItem = cm.Item({
      label: "Wikipedia",
      data: "http://en.wikipedia.org/wiki/Special:Search?search="
    });
    var searchMenu = cm.Menu({
      label: "Search With",
      context: contextMenu.SelectorContext("a[href]"),
      contentScript: 'self.on("click", function (node, data) {' +
                     '  var searchURL = data + node.textContent;' +
                     '  window.location.href = searchURL;' +
                     '});',
      items: [googleItem, wikipediaItem]
    });


<api name="Item">
@class
A labeled menu item that can perform an action when clicked.
<api name="Item">
@constructor
  Creates a labeled menu item that can perform an action when clicked.
@param options {object}
  An object with the following keys:
  @prop label {string}
    The item's label.  It must either be a string or an object that implements
    `toString()`.
  @prop [data] {string}
    An optional arbitrary value to associate with the item.  It must be either a
    string or an object that implements `toString()`.  It will be passed to
    click listeners.
  @prop [context] {value}
    If the item is contained in the top-level context menu, this declaratively
    specifies the context under which the item will appear; see Specifying
    Contexts above.  Ignored if the item is contained in a submenu.
  @prop [contentScript] {string,array}
    If the item is contained in the top-level context menu, this is the content
    script or an array of content scripts that the item can use to interact with
    the page.  Ignored if the item is contained in a submenu.
  @prop [contentScriptFile] {string,array}
    If the item is contained in the top-level context menu, this is the local
    file URL of the content script or an array of such URLs that the item can
    use to interact with the page.  Ignored if the item is contained in a
    submenu.
  @prop [onMessage] {function}
    If the item is contained in the top-level context menu, this function will
    be called when the content script calls `self.postMessage`.  It will be
    passed the data that was passed to `postMessage`.  Ignored if the item is
    contained in a submenu.
</api>

<api name="label">
@property {string}
  The menu item's label.  You can set this after creating the item to update its
  label later.
</api>

<api name="data">
@property {string}
  An arbitrary value associated with the menu item during creation.  Currently
  this property is read-only.
</api>

<api name="context">
@property {list}
  A list of declarative contexts for which the menu item will appear in the
  context menu.  Contexts can be added by calling `context.add()` and removed by
  called `context.remove()`.  This property is meaningful only for items
  contained in the top-level context menu.
</api>

<api name="contentScript">
@property {string,array}
  The content script or the array of content scripts associated with the menu
  item during creation.  This property is meaningful only for items contained in
  the top-level context menu.
</api>

<api name="contentScriptFile">
@property {string,array}
  The URL of a content script or the array of such URLs associated with the menu
  item during creation.  This property is meaningful only for items contained in
  the top-level context menu.
</api>

<api name="destroy">
@method
  Permanently removes the item from the top-level context menu.  If the item is
  not contained in the top-level context menu, this method does nothing.
</api>

<api name="message">
@event
If you listen to this event you can receive message events from content
scripts associated with this menu item. When a content script posts a
message using `self.postMessage()`, the message is delivered to the add-on
code in the menu item's `message` event.

@argument {value}
Listeners are passed a single argument which is the message posted
from the content script. The message can be any
<a href = "dev-guide/addon-development/web-content.html#json_serializable">JSON-serializable value</a>.
</api>

</api>

<api name="Menu">
@class
A labeled menu item that expands into a submenu.

<api name="Menu">
@constructor
  Creates a labeled menu item that expands into a submenu.
@param options {object}
  An object with the following keys:
  @prop label {string}
    The item's label.  It must either be a string or an object that implements
    `toString()`.
  @prop items {array}
    An array of menu items that the menu will contain.  Each must be an `Item`,
    `Menu`, or `Separator`.
  @prop [context] {value}
    If the menu is contained in the top-level context menu, this declaratively
    specifies the context under which the menu will appear; see Specifying
    Contexts above.  Ignored if the menu is contained in a submenu.
  @prop [contentScript] {string,array}
    If the menu is contained in the top-level context menu, this is the content
    script or an array of content scripts that the menu can use to interact with
    the page.  Ignored if the menu is contained in a submenu.
  @prop [contentScriptFile] {string,array}
    If the menu is contained in the top-level context menu, this is the local
    file URL of the content script or an array of such URLs that the menu can
    use to interact with the page.  Ignored if the menu is contained in a
    submenu.
  @prop [onMessage] {function}
    If the menu is contained in the top-level context menu, this function will
    be called when the content script calls `self.postMessage`.  It will be
    passed the data that was passed to `postMessage`.  Ignored if the item is
    contained in a submenu.
</api>

<api name="label">
@property {string}
  The menu's label.  You can set this after creating the menu to update its
  label later.
</api>

<api name="items">
@property {array}
  The menu items contained in the menu.  Currently the items in the menu cannot
  be changed by modifying this property.
</api>

<api name="context">
@property {list}
  A list of declarative contexts for which the menu will appear in the context
  menu.  Contexts can be added by calling `context.add()` and removed by called
  `context.remove()`.  This property is meaningful only for menus contained in
  the top-level context menu.
</api>

<api name="contentScript">
@property {string,array}
  The content script or the array of content scripts associated with the menu
  during creation.  This property is meaningful only for menus contained in the
  top-level context menu.
</api>

<api name="contentScriptFile">
@property {string,array}
  The URL of a content script or the array of such URLs associated with the menu
  during creation.  This property is meaningful only for menus contained in the
  top-level context menu.
</api>

<api name="destroy">
@method
  Permanently removes the menu from the top-level context menu.  If the menu is
  not contained in the top-level context menu, this method does nothing.
</api>

<api name="message">
@event
If you listen to this event you can receive message events from content
scripts associated with this menu item. When a content script posts a
message using `self.postMessage()`, the message is delivered to the add-on
code in the menu item's `message` event.

@argument {value}
Listeners are passed a single argument which is the message posted
from the content script. The message can be any
<a href = "dev-guide/addon-development/web-content.html#json_serializable">JSON-serializable value</a>.
</api>

</api>

<api name="Separator">
@class
A menu separator.  Separators can be contained only in `Menu`s, not in the
top-level context menu.
<api name="Separator">
@constructor
  Creates a menu separator.
</api>
</api>

<api name="PageContext">
@class
<api name="PageContext">
@constructor
  Creates a page context.  See Specifying Contexts above.
</api>
</api>

<api name="SelectionContext">
@class
<api name="SelectionContext">
@constructor
  Creates a context that occurs when a page contains a selection.  See
  Specifying Contexts above.
</api>
</api>

<api name="SelectorContext">
@class
<api name="SelectorContext">
@constructor
  Creates a context that matches a given CSS selector.  See Specifying Contexts
  above.
@param selector {string}
  A CSS selector.
</api>
</api>

<api name="URLContext">
@class
<api name="URLContext">
@constructor
  Creates a context that matches pages with particular URLs.  See Specifying
  Contexts above.
@param matchPattern {string,array}
  A [match pattern](packages/api-utils/docs/match-pattern.html) string or an array of
  match pattern strings.
</api>
</api>
