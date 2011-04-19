/*
The selector locates elements that are suitable for annotation and enables
the user to select them.

On 'mouseenter' events associated with <p> elements:
- if the selector is active and the element is not already annotated
- find the nearest ancestor which has an id attribute: this is supposed to
make identification of this element more accurate
- highlight the element
- bind 'click' for the element to send a message back to the add-on, including
all the information associated with the anchor.
*/

var matchedElement = null;
var originalBgColor = null;
var active = false;

function resetMatchedElement() {
  if (matchedElement) {
    $(matchedElement).css('background-color', originalBgColor);
    $(matchedElement).unbind('click.annotator');
  }
}

self.on('message', function onMessage(activation) {
  active = activation;
  if (!active) {
    resetMatchedElement();
  }
});

$('*').mouseenter(function() {
  if (!active || $(this).hasClass('annotated')) {
    return;
  }
  resetMatchedElement();
  ancestor = $(this).closest("[id]");
  matchedElement = $(this).first();
  originalBgColor = $(matchedElement).css('background-color');
  $(matchedElement).css('background-color', 'yellow');
  $(matchedElement).bind('click.annotator', function(event) {
    event.stopPropagation();
    event.preventDefault();
    postMessage({
      kind: 'show',
      anchor: [
        document.location.toString(),
        $(ancestor).attr("id"),
        $(matchedElement).text()
      ]
   });
  });
});

$('*').mouseout(function() {
  resetMatchedElement();
});
