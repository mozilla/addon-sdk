# Displaying Annotations #

In this chapter we'll use a page-mod to locate elements of Web pages that have
annotations associated with them, and a panel to display the annotations.

## Annotator page-mod ##

### Annotator Content Script ###

The content script for the 'annotator' page-mod is initialized with a list
of all the annotations that the user has created. 

When a page is loaded the annotator searches the DOM for elements that match
annotations. If it finds any it binds functions to that element's
[mouseenter](http://api.jquery.com/mouseenter/) and
[mouseleave](http://api.jquery.com/mouseleave/) events to send messages to the
main add-on code asking it to show or hide the annotation.

Like the selector, the annotator also listens for the window's `unload` event
and on unload sends a 'detach' message to the main add-on code, so the add-on
can clean it up.

The complete content script is here:

    self.on('message', function onMessage(annotations) {
      annotations.forEach(
        function(annotation) {
          if(annotation.url == document.location.toString()) {
            createAnchor(annotation);
          }
      })

      $('.annotated').css('border', 'solid 3px yellow');

      $('.annotated').bind('mouseenter', function(event) {
        postMessage(['show', $(this).attr('annotation')]);
        event.stopPropagation();
        event.preventDefault();
      });

      $('.annotated').bind('mouseleave', function() {
        postMessage(['hide']);
      });
    })

    window.addEventListener('unload', function() {
      postMessage(['detach']);
    }, false);

    function createAnchor(annotation) {
      annotationAnchorAncestor = $('#' + annotation.ancestorId);
      annotationAnchor = $(annotationAnchorAncestor).parent().find(
                         ':contains(' + annotation.anchorText + ')').last();
      $(annotationAnchor).addClass('annotated');
      $(annotationAnchor).attr('annotation', annotation.annotationText);
    }

Save this in `data` as 'annotator.js'.

### Updating main.js ###

First, initialize an array to hold workers associated with the annotator's
content scripts:

    var annotators = [];

In the `main` function, add the code to create the annotator:

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

When a new page is loaded the function assigned to `onAttach` is called. This
function:

* initializes the content script instance with the current set of
annotations

* provides a handler for messages from that content script, handling the three
messages - 'show', 'hide' and 'detach' - that the content script might send

* adds the worker to an array, so we it can send messages back later.

Then in the module's scope implement a function to update the annotator's
workers, and edit `handleNewAnnotation` to call it when the user enters a new
annotation:

    function updateAnnotators() {
      annotators.forEach(
        function (annotators) {
        annotators.postMessage(simpleStorage.storage.array);
      });
    }

<p>

    function handleNewAnnotation(annotationText, anchor) {
      var newAnnotation = new Annotation(annotationText, anchor);
      simpleStorage.storage.array.push(newAnnotation);
      updateAnnotators();
    }

