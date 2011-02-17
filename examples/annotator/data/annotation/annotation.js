/*
Initialize annotation content.
*/

self.on('message', function(message) {
  $('#annotation').text(message);
});
