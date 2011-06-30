"use stirct";

const { Cc, Ci } = require('chrome');
function makeWindow(contentURL) {
  let content =
    '<?xml version="1.0"?>' +
    '<window ' +
    'xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul">' +
    '<iframe id="content" type="content" src="' +
      encodeURIComponent(contentURL) + '"/>' +
    '<script>var documentValue=true;</script>' +
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
        self.port.on('addon-to-content', function (data) {
          self.port.emit('content-to-addon', data);
        });
        
        // Check for global pollution
        //if (typeof on != "undefined")
        //  self.postMessage("`on` is in globals");
        if (typeof once != "undefined")
          self.postMessage("`once` is in globals");
        if (typeof emit != "undefined")
          self.postMessage("`emit` is in globals");
        
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
        // Validate self.port
        self.port.on('message', function (data) {
          self.port.emit('message', data);
        });
        // We should not receive message on self, but only on self.port
        self.on('message', function (data) {
          self.postMessage('message', data);
        });
      },
      onError: function(e) {
        test.fail("Got exception: "+e);
      }
    });
  
  worker.port.on('message', function (data) {
    test.assertEqual(data, "event data");
    test.done();
  });
  worker.on('message', function (data) {
    test.fail("Got an unexpected message : "+msg);
  });
  worker.port.emit('message', 'event data');
  
}

exports['test:n-arguments emit'] = function(test) {
  let window = makeWindow();
  test.waitUntilDone();
  
  let worker =  Worker({
      window: window,
      contentScript: 'new ' + function WorkerScope() {
        // Validate self.on and self.emit
        self.port.on('addon-to-content', function (a1, a2, a3) {
          self.port.emit('content-to-addon', a1, a2, a3);
        });
      }
    });
  
  // Validate worker.port
  worker.port.on('content-to-addon', function (arg1, arg2, arg3) {
    test.assertEqual(arg1, "first argument");
    test.assertEqual(arg2, "second");
    test.assertEqual(arg3, "third");
    test.done();
  });
  worker.port.emit('addon-to-content', 'first argument', 'second', 'third');
}

exports['test:post-json-values-only'] = function(test) {
  let window = makeWindow();
  test.waitUntilDone();
  
  let worker =  Worker({
      window: window,
      contentScript: 'new ' + function WorkerScope() {
        self.on('message', function (message) {
          self.postMessage([ message.fun === undefined,
                             typeof message.w,
                             "port" in message.w,
                             message.w.url ]);
        });
      }
    });

  // Validate worker.onMessage
  worker.on('message', function (message) {
    test.assertEqual(message[0], true, "function becomes undefined");
    test.assertEqual(message[1], "object", "object stays object");
    test.assertEqual(message[2], true, "object's attributes are enumerable");
    test.assertEqual(message[3], "about:blank", "jsonable attributes are accessible");
    test.done();
  });
  worker.postMessage({ fun: function () {}, w: worker });
};

exports['test:emit-json-values-only'] = function(test) {
  let window = makeWindow();
  test.waitUntilDone();
  
  let worker =  Worker({
      window: window,
      contentScript: 'new ' + function WorkerScope() {
        // Validate self.on and self.emit
        self.port.on('addon-to-content', function (fun, w, obj) {
          self.port.emit('content-to-addon', [
                          fun === null,
                          typeof w,
                          "port" in w,
                          w.url,
                          "fun" in obj,
                          Object.keys(obj.dom).length
                        ]);
        });
      }
    });
  
  // Validate worker.port
  worker.port.on('content-to-addon', function (result) {
    test.assertEqual(result[0], true, "functions become null");
    test.assertEqual(result[1], "object", "objects stay objects");
    test.assertEqual(result[2], true, "object's attributes are enumerable");
    test.assertEqual(result[3], "about:blank", "json attribute is accessible");
    test.assertEqual(result[4], false, "function as object attribute is removed");
    test.assertEqual(result[5], 0, "DOM nodes are converted into empty object");
    test.done();
  });
  let obj = {
    fun: function () {},
    dom: window.document.documentElement
  };
  worker.port.emit('addon-to-content', function () {}, worker, obj);
}

exports['test:content is wrapped'] = function(test) {
  let contentURL = 'data:text/html,<script>var documentValue=true;</script>';
  let window = makeWindow(contentURL);
  test.waitUntilDone();

  window.addEventListener("load", function onload() {
    window.removeEventListener("load", onload, true);

    let worker =  Worker({
      window: window.document.getElementById("content").contentWindow,
      contentScript: 'new ' + function WorkerScope() {
        self.postMessage(!window.documentValue);
      },
      contentScriptWhen: 'ready',
      onMessage: function(msg) {
        test.assert(msg,
          "content script has a wrapped access to content document");
        test.done();
      }
    });

  }, true);

}

exports['test:chrome is unwrapped'] = function(test) {
  let window = makeWindow();
  test.waitUntilDone();

  window.addEventListener("load", function onload() {
    window.removeEventListener("load", onload, true);

    let worker =  Worker({
      window: window,
      contentScript: 'new ' + function WorkerScope() {
        self.postMessage(window.documentValue);
      },
      contentScriptWhen: 'ready',
      onMessage: function(msg) {
        test.assert(msg,
          "content script has an unwrapped access to chrome document");
        test.done();
      }
    });

  }, true);

}
