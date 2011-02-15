"use stirct";

const { Cc, Ci } = require('chrome');
function makeWindow() {
  let content =
    '<?xml version="1.0"?>' +
    '<window ' +
    'xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul">' +
    '<iframe id="content" type="content"/>' +
    '</window>';
  var url = "data:application/vnd.mozilla.xul+xml," +
            encodeURIComponent(content);
  var features = ["chrome", "width=10", "height=10"];

  return Cc["@mozilla.org/embedcomp/window-watcher;1"].
         getService(Ci.nsIWindowWatcher).
         openWindow(null, url, null, features.join(","), null);
}

const { Worker } = require('content/worker');
exports['test:sample'] = function(test) {
  let window = makeWindow();
  test.waitUntilDone();
  let worker =  Worker({
    window: window,
    contentScript: 'new ' + function WorkerScope() {
      // window is accessible
      let myLocation = window.location.toString();
      self.on('message', function(data) {
        if (data == 'hi!')
          postMessage('bye!');
      });
    },
    onMessage: function(msg) {
      test.assertEqual('bye!', msg);
      test.assertEqual(worker.url, window.document.location.href);
      test.done();
    }
  });
  worker.postMessage('hi!');
  
  // As window has just being created, its document is still loading, 
  // and we have about:blank document before the expected one
  test.assertEqual(worker.url, "about:blank");
  test.assertEqual(worker.url, window.document.location.href);
}

