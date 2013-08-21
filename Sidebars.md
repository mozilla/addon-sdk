## Proposal

It should be possible to create sidebars for browser windows 
which can have remote or local content loaded into them.

### Mockup

<img src="http://people.mozilla.com/~shorlander/files/addons-in-toolbar-i01/images/05.png">

### Use Cases

Sidebars are UI real estate, just like Toolbars are, the main 
difference is that a Sidebar is meant to take more real estate, 
and therefore contain a different sort of content.  A Sidebar is 
more likely to contain data or communication content and have 
fewer controls than would be found in a toolbar for example.

* Displaying streams of data (social feed, rss, twitter, etc).
Example Firefox Social
* Adding controls. Example Firebug, Devtools
* Displaying tab related information

## Implementation

The design would closely match that for Widgets, being 1-many, 
in other words one instance of a Sidebar would control multiple 
XUL elements which implement the sidebar on specific windows.

Note: Currently Firefox Sidebars are reloaded when shown, and 
closed when they are hidden, so initially Jetpack Sidebars will 
work the same way and if can implement deviations from this 
behavior at a later time.

### API

#### Constructors

##### Freebies

* A navbar button will be created for free with sidebars.
* A menuitem in relevant sidebar menus.  These are used to reflect 
state and provide an interface for users to show/hide the 
sidebar.

##### Sidebar

* options
  * [id]: a unique identifier, this can be optional
  * icon: a icon descriptor
  * url: a remote or local url of content for the sidebar
  * title: a title used for the sidebar and the menuitem
  * [position]?: `top`, `bottom`, `left`, `right`
  * [length]?: this can be done at a later time, it would control the height/width.
  * onShow/onHide/onDetach/onAttach

###### Properties

* id: the sidebar id (this won't contain the id prefix that will 
be used)
* title: the title displayed for the sidebar
* url: the url for the sidebar
* image: an image for the associated toolbar button.

###### Methods

* show/hide
* destroy
* on/once/off

###### Events

* show/hide
* attach/detach?

### Examples

`lib/main.js`:

```js
    const { Sidebar } = require('sdk/ui');

    let sidebar = Sidebar({
      id: 'twitter-sidebar',
      url: require('self').data.url('twitter.html'), // Has access to a `addon` global to communicate with the addon
      title: 'Twitter'
    });
    sidebar.on('attach', function(worker) {
      worker.port.on('message', functionmsg() {
        console.log(msg); // Logs 'Hello World!'
      });
      worker.port.emit('message', 'Hello');
    })
    sidebar.show(); // shows in most recent window
    sidebar.hide();  // hides in most recent window
```

`data/twitter.html`

    <script>
    addon.port.on('message', function(msg) {
      addon.port.emit('message', msg + " World!")
    })
    </script>

### Dependencies & Requirements

* [Navbar Button](./Navbar Buttons.md)

## Prior Art

* https://wiki.mozilla.org/Labs/Jetpack/JEP/16

## Comments

* [Discuss this JEP further on this etherpad page](https://etherpad.mozilla.org/jetpack-sidebar).

