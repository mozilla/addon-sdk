# Implementing the Widget #

We want the widget to do two things:

* On a left-click, the widget should activate or deactivate the annotator.
* On a right-click, the widget should display a list of all the annotations
the user has created.

Because the widget's `click` event does not distinguish left and right mouse
clicks, we'll use a content script to capture the click events and send the
corresponding message back to our add-on.

The widget will have two icons: one to display when it's active, one to display
when it's inactive.

So there are three files we'll need to create: the widget's content script and
its two icons.

Inside the `data` subdirectory create another subdirectory `widget`. We'll
keep the widget's files here. (Note that this isn't mandatory: you could just
keep them all under `data`.  But it seems tidier this way.)

## The Widget's Content Script ##

The widget's content script just listens for left- and right- mouse clicks and
posts the corresponding message to the add-on code:

    this.addEventListener('click', function(event) {
      if(event.button == 0 && event.shiftKey == false)
        postMessage('left-click');

      if(event.button == 2 || (event.button == 0 && event.shiftKey == true))
        postMessage('right-click');
        event.preventDefault();
    }, true);

Save this in your `data/widget` directory as `widget.js`.

## The Widget's Icons ##

You can copy the widget's icons from here:

<img style="margin-left:40px; margin-right:20px;" src="media/annotator/pencil-on.jpg" alt="Active Annotator">
<img style="margin-left:20px; margin-right:20px;" src="media/annotator/pencil-off.jpg" alt="Inactive Annotator">

(Or make your own if you're feeling creative.) Save them in your `data/widget` directory.

## main.js ##

Now in the `lib` directory open `main.js` and replace its contents with this:

    const widgets = require('widget');
    const data = require('self').data;

    var annotatorIsOn = false;

    function toggleActivation() {
      annotatorIsOn = !annotatorIsOn;
      return annotatorIsOn;
    }

    exports.main = function(options, callbacks) {

      widget = widgets.Widget({
        label: 'Annotator',
        contentURL: data.url('widget/pencil-off.jpg'),
        contentScriptWhen: 'ready',
        contentScriptFile: data.url('widget/widget.js'),
        onMessage: function(message) {
          if (message == 'left-click') {
            console.log('activate/deactivate');
            toggleActivation()?
                              widget.contentURL=data.url('widget/pencil-on.jpg')
                             :widget.contentURL=data.url('widget/pencil-off.jpg');
          }
          else if (message == 'right-click') {
            console.log('show annotation list');
          }
        }
      });
    }

The annotator is inactive by default. It creates the widget and responds to
messages from the widget's content script by toggling its activation state.
Since we don't have any code to display annotations yet, we just log the
right-click events to the console.

Now from the `annotator` directory type `cfx run`. You should see the widget
in the add-on bar:

<div align="center">
<img src="media/annotator/widget-icon.png" alt="Widget Icon">
</div>
<br>

Left- and right-clicks should produce the appropriate debug output, and a
left-click should also change the widget icon to signal that it is active.

Next we'll add the code to
[create annotations](#guide/addon-development/annotator/creating).