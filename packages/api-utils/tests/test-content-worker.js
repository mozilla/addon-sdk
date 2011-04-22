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
  
  // As window has just being created, its document is still loading, 
  // and we have about:blank document before the expected one
  test.assertEqual(window.document.location.href, "about:blank", 
                   "window starts by loading about:blank");
  
  // We need to wait for the load/unload of temporary about:blank
  // or our worker is going to be automatically destroyed
  window.addEventListener("load", function onload() {
    window.removeEventListener("load", onload, true);
    
    test.assertNotEqual(window.document.location.href, "about:blank", 
                        "window is now on the right document");
    
    let worker =  Worker({
      window: window,
      contentScript: 'new ' + function WorkerScope() {
        // window is accessible
        let myLocation = window.location.toString();
        self.on('message', function(data) {
          if (data == 'hi!')
            self.postMessage('bye!');
        });
      },
      contentScriptWhen: 'ready',
      onMessage: function(msg) {
        test.assertEqual('bye!', msg);
        test.assertEqual(worker.url, window.document.location.href, 
                         "worker.url still works");
        test.done();
      }
    });
    
    test.assertEqual(worker.url, window.document.location.href, 
                     "worker.url works");
    worker.postMessage('hi!');
    
  }, true);
  
}

exports['test:emit'] = function(test) {
  let window = makeWindow();
  test.waitUntilDone();
  
  let worker =  Worker({
      window: window,
      contentScript: 'new ' + function WorkerScope() {
        // Validate self.on and self.emit
        self.on('addon-to-content', function (data) {
          self.emit('content-to-addon', data);
        });
        
        // Check for global pollution
        if (typeof on != "undefined")
          postMessage("`on` is in globals");
        if (typeof once != "undefined")
          postMessage("`once` is in globals");
        if (typeof emit != "undefined")
          postMessage("`emit` is in globals");
        
      },
      onMessage: function(msg) {
        test.fail("Got an unexpected message : "+msg);
      }
    });
  
  // Validate worker.port
  worker.port.on('content-to-addon', function (data) {
    test.assertEqual(data, "event data");
    test.done();
  });
  worker.port.emit('addon-to-content', 'event data');
  
}

exports['test:emit hack message'] = function(test) {
  let window = makeWindow();
  test.waitUntilDone();
  
  let worker =  Worker({
      window: window,
      contentScript: 'new ' + function WorkerScope() {
        // Validate self.on and self.emit
        self.on('message', function (data) {
          self.emit('message', data);
        });
      },
      onMessage: function(msg) {
        test.fail("Got an unexpected message : "+msg);
      },
      onError: function(e) {
        test.fail("Got exception: "+e);
      }
    });
  
  // Events `mesage` are routed to port when they come from content script
  // but they behave exactly like postMessage when they come from addon
  worker.port.on('message', function (data) {
    test.assertEqual(data, "event data");
    test.done();
  });
  worker.on('message', function (data) {
    test.fail("Got an unexpected message : "+msg);
  });
  worker.port.emit('message', 'event data');
  
}

