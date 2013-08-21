## Proposal

It should be possible to create toolbars for browser windows 
which can have widgets or xul elements added to it.

### Mockup

<img src="http://people.mozilla.com/~shorlander/files/addons-in-toolbar-i01/images/04.png">

### Use Cases

Toolbars in general merely provide UI real estate for other UI 
elements like widgets or buttons.  The main advantage over a 
Panel is that multiple toolbars can be active at the same time, 
and they don't overlap other UI elements.

* Displaying a toolbar with no UI association.
* Associating a Widget to a toolbar.
* Associating a Button to a toolbar.
* Adding Buttons to the toolbar.
* Adding Widgets to the toolbar.

## Implementation

The design would closely match that for Widgets, being 1-many, 
in other words one instance of a `Toolbar` would control 
multiple XUL elements which implement the toolbar on specific 
windows.

### Dependencies & Requirements 

### API

#### Constructors

##### Toolbar

* options
  * id: to define an id to be used for the underlying XUL
	  elements
  * position: to set the position to be top or bottom (possibly
 		left and right?)

###### Methods

* appendChild: to add elements on all windows
* on/once/off: for event listening on all windows
* show/hide: to show hide the toolbar in all windows
* destroy: erases the toolbar

###### Events

* destroy
* show
* hide

#### Example with Widget

    const { Widget } = require('sdk/widget');
    const { Toolbar } = require('sdk/ui/toolbar');

    let toolbar = Toolbar({
      id: 'yahoo-search-toolbar'
    });
    toolbar.appendChild(Widget({
      contentURL: "https://yahoo.com/firefox/toolbar.html",
      width: "100%"
    }));

    if (require('self').loadReason == 'install')
      toolbar.show(); // shows the toolbar


#### Example with Button

    const { Button } = require('sdk/ui/button');
    const { Toolbar } = require('sdk/ui/toolbar');

    let toolbar = Toolbar({
      id: 'yahoo-button-toolbar'
    });
    toolbar.appendChild(Button({
      image: "https://yahoo.com/firefox/toolbar.png"
    }));

## Comments

* [Discuss this JEP further on this etherpad page](https://etherpad.mozilla.org/jetpack-toolbar).