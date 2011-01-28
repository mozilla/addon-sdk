/*
Locate anchors for annotations and prepare to display the annotations.

For each annotation, if its URL matches this page,
- get the ancestor whose ID matches the ID in the anchor
- look for a <p> element whose content contains the anchor text

That's considered a match: then we:
- highlight the anchor element
- add an 'annotated' class to tell the selector to skip this element
- embed the annottion text as a new attribute

For all annotated elements:
- bind 'mouseenter' and 'mouseleave' events to the element, to send 'show'
and 'hide' messages back to the add-on.
*/

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

/*
Since there is no onDetach event for panels, we listen for the window's
unload event and send the add-on a detach message.
*/
window.addEventListener('unload', function() {
    postMessage(['detach']);
  },
  false);

function createAnchor(annotation) {
  annotationAnchorAncestor = $('#' + annotation.ancestorId);
  annotationAnchor = $(annotationAnchorAncestor).parent().find(
                     ':contains(' + annotation.anchorText + ')').last();
  $(annotationAnchor).addClass('annotated');
  $(annotationAnchor).attr('annotation', annotation.annotationText);
}
