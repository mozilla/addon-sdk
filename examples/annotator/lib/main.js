// Import the modules we need.
const contextMenu = require('context-menu');
const panels = require('panel');
const widgets = require('widget');
const data = require('self').data;
const simpleStorage = require('simple-storage');
const pageMod = require('page-mod');
const privateBrowsing = require('private-browsing');
const notifications = require("notifications");

/*
Global variables
* Boolean to indicate whether the add-on is switched on or not
* Array for all workers associated with the 'selector' page mod
* Array for all workers associated with the 'annotator' page mod
*/
var annotatorIsOn = false;
var selectors = [];
var annotators = [];

/*
The add-on is active if it is on AND private browsing is off
*/
function addonIsActive() {
  return (annotatorIsOn && !privateBrowsing.isActive);
}

function detachWorker(worker, workerArray) {
  var index = workerArray.indexOf(worker);
  if(index != -1) {
    workerArray.splice(index, 1);
  }
}

/*
Function to tell the selector page mod that the add-on has become (in)active
*/
function activateSelectors() {
  selectors.forEach(
    function (selector) {
      selector.postMessage(addonIsActive());
  })
}

/*
Update the annotators: call this whenever the set of annotations changes
*/
function updateAnnotators() {
  annotators.forEach(
    function (annotators) {
    annotators.postMessage(simpleStorage.storage.array);
  });
}

/*
Toggle activation: update the on/off state and notify the selectors.
Toggling activation is disabled when private browsing is on.
*/
function toggleActivation() {
  if (privateBrowsing.isActive) {
    return false;
  }
  annotatorIsOn = !annotatorIsOn;
  activateSelectors();
  return addonIsActive();
}

/*
Constructor for an Annotation object
*/
function Annotation(annotationText, anchor) {
  this.annotationText = annotationText;
  this.url = anchor[0];
  this.ancestorId = anchor[1];
  this.anchorText = anchor[2];
}

/*
Function to deal with a new annotation.
Create a new annotation object, store it, and
notify all the annotators of the change.
*/
function handleNewAnnotation(annotationText, anchor) {
  var newAnnotation = new Annotation(annotationText, anchor);
  simpleStorage.storage.array.push(newAnnotation);
  updateAnnotators();
}

exports.main = function(options, callbacks) {

  if (!simpleStorage.storage.array)
    simpleStorage.storage.array = [];
/*
The annotationEditor panel is the UI component used for creating
new annotations. It contains a text area for the user to
enter the annotation.

When we are ready to display the editor we assign its 'anchor' property
and call its show() method.

Its content script sends the content of the text area to the add-on
when the user presses the return key.

When we receives this message we create a new annotation using the anchor
and the text the user entered, store it, and hide the panel.
*/
  annotationEditor = panels.Panel({
    width: 200,
    height: 180,
    contentURL: data.url('editor/annotation-editor.html'),
    contentScriptFile: data.url('editor/annotation-editor.js'),
    contentScriptWhen: 'ready',
    onMessage: function(message) {
      if (message)
        handleNewAnnotation(message, this.anchor);
      annotationEditor.hide();
    },
    onShow: function() {
      this.postMessage('focus');
    }
  });

/*
The annotation panel is the UI component that displays an annotation.

When we are ready to show it we assign its 'content' attribute to contain
the annotation text, and that gets sent to the content process in onShow().
*/
  annotation = panels.Panel({
    width: 200,
    height: 180,
    contentURL: data.url('annotation/annotation.html'),
    contentScriptFile: [data.url('jquery-1.4.2.min.js'), data.url('annotation/annotation.js')],
    contentScriptWhen: 'ready',
    onShow: function() {
      this.postMessage(this.content);
    }
  });

/*
The annotationList panel is the UI component that lists all the annotations
the user has entered.

On its 'show' event we pass it the array of annotations.

The content script creates the HTML elements for the annotations, and
intercepts clicks on the links, passing them back to the add-on to open them
in the browser.
*/
  annotationList = panels.Panel({
    width: 480,
    height: 320,
    contentURL: data.url('list/annotation-list.html'),
    contentScriptFile: [data.url('jquery-1.4.2.min.js'),
                        data.url('list/annotation-list.js')],
    contentScriptWhen: 'ready',
    onShow: function() {
      this.postMessage(simpleStorage.storage.array);
    },
    onMessage: function(message) {
      require('tabs').open(message);
    }
  })

/*
The selector page-mod enables the user to select page elements to annotate.

It is attached to all pages but only operates if the add-on is active.

The content script highlights any page elements which can be annotated. If the
user clicks a highlighted element it sends a message to the add-on containing
information about the element clicked, which is called the anchor of the
annotation.

When we receive this message we assign the anchor to the annotationEditor and
display it.
*/
  selector = pageMod.PageMod({
    include: ['*'],
    contentScriptWhen: 'ready',
    contentScriptFile: [data.url('jquery-1.4.2.min.js'),
                        data.url('selector.js')],
    onAttach: function(worker) {
      worker.postMessage(addonIsActive());
      worker.on('message', function(message) {
        switch(message[0]) {
          case 'show':
            annotationEditor.anchor = message[1];
            annotationEditor.show();
            break;
          case 'detach':
            detachWorker(this, selectors);
            break;
        }
      })
      selectors.push(worker);
    }
  });

/*
The annotator page-mod locates anchors on web pages and prepares for the
annotation to be displayed.

It is attached to all pages, and when it is attached we pass it the complete
list of annotations. It looks for anchors in its page. If it finds one it
highlights the anchor and binds mouseenter/mouseout events to 'show' and 'hide'
messages to the add-on.

When the add-on receives the 'show' message it assigns the annotation text to
the annotation panel and shows it.

Note that the annotator is active whether or not the add-on is active:
'inactive' only means that the user can't create new add-ons, they can still
see old ones.
*/
  annotator = pageMod.PageMod({
    include: ['*'],
    contentScriptWhen: 'ready',
    contentScriptFile: [data.url('jquery-1.4.2.min.js'),
                        data.url('annotator.js')],
    onAttach: function(worker) {
      if(simpleStorage.storage.array) {
        worker.postMessage(simpleStorage.storage.array);
      }
      worker.on('message', function(message) {
        switch(message[0]) {
          case 'show':
            annotation.content = message[1];
            annotation.show();
            break;
          case 'hide':
            annotation.content = null;
            annotation.hide();
            break;
          case 'detach':
            detachWorker(this, annotators);
            break;
        }
      });
      annotators.push(worker);
    }
  });

/*
The widget provides a mechanism to switch the selector on or off, and to
view the list of annotations.

The selector is switched on/off with a left-click, and the list of annotations
is displayed on a right-click.
*/
  widget = widgets.Widget({
    label: 'Annotator',
    contentURL: data.url('widget/pencil-off.jpg'),
    contentScriptWhen: 'ready',
    contentScriptFile: [data.url('jquery-1.4.2.min.js'),
                        data.url('widget/widget.js')],
    onMessage: function(message) {
      if (message == 'left-click') {
        toggleActivation()?
                          widget.contentURL=data.url('widget/pencil-on.jpg')
                         :widget.contentURL=data.url('widget/pencil-off.jpg');
      }
      else if (message == 'right-click') {
        annotationList.show();
      }
    }
  });

/*
We listen for private browsing start/stop events to change the widget icon
and to notify the selectors of the change in state.
*/
  privateBrowsing.on('start', function() {
    widget.contentURL=data.url('widget/pencil-off.jpg');
    activateSelectors();
  });

  privateBrowsing.on('stop', function() {
    if (addonIsActive()) {
      widget.contentURL=data.url('widget/pencil-on.jpg');
      activateSelectors();
    }
  });

/*
We listen for the OverQuota event from simple-storage.
If it fires we just notify the user and delete the most
recent annotations until we are back in quota.
*/
  simpleStorage.on("OverQuota", function () {
    notifications.notify({
      title: 'Storage space exceeded',
      text: 'Removing recent annotations'});
    while (simpleStorage.quotaUsage > 1)
      simpleStorage.storage.array.pop();
  });

}
