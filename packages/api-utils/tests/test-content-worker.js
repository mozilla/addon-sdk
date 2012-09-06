/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use stirct";

const { Cc, Ci } = require("chrome");
const { setTimeout } = require("api-utils/timer");
const { Loader, Require, override } = require("test-harness/loader");
const { Worker } = require('api-utils/content/worker');
const xulApp = require("api-utils/xul-app");

function makeWindow(contentURL) {
  let content =
    '<?xml version="1.0"?>' +
    '<window ' +
    'xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul">' +
    '<iframe id="content" type="content" src="' +
      encodeURIComponent(contentURL) + '"/>' +
    '<script>var documentValue=true;</script>' +
    '</window>';
  var url = "data:application/vnd.mozilla.xul+xml;charset=utf-8," +
            encodeURIComponent(content);
  var features = ["chrome", "width=10", "height=10"];

  return Cc["@mozilla.org/embedcomp/window-watcher;1"].
         getService(Ci.nsIWindowWatcher).
         openWindow(null, url, null, features.join(","), null);
}

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
    window.close();
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
    window.close();
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
    window.close();
    test.done();
  });
  worker.port.emit('addon-to-content', 'first argument', 'second', 'third');
}

exports['test:post-json-values-only'] = function(test) {
  let window = makeWindow("data:text/html;charset=utf-8,");
  test.waitUntilDone();
  
  window.addEventListener("load", function onload() {
    window.removeEventListener("load", onload, true);

    let worker =  Worker({
        window: window.document.getElementById("content").contentWindow,
        contentScript: 'new ' + function WorkerScope() {
          self.on('message', function (message) {
            self.postMessage([ message.fun === undefined,
                               typeof message.w,
                               message.w && "port" in message.w,
                               message.w.url,
                               Array.isArray(message.array),
                               JSON.stringify(message.array)]);
          });
        }
      });

    // Validate worker.onMessage
    let array = [1, 2, 3];
    worker.on('message', function (message) {
      test.assert(message[0], "function becomes undefined");
      test.assertEqual(message[1], "object", "object stays object");
      test.assert(message[2], "object's attributes are enumerable");
      test.assertEqual(message[3], "about:blank", "jsonable attributes are accessible");
      // See bug 714891, Arrays may be broken over compartements:
      test.assert(message[4], "Array keeps being an array");
      test.assertEqual(message[5], JSON.stringify(array),
                       "Array is correctly serialized");
      window.close();
      test.done();
    });
    worker.postMessage({ fun: function () {}, w: worker, array: array });

  }, true);

};


exports['test:emit-json-values-only'] = function(test) {
  let window = makeWindow("data:text/html;charset=utf-8,");
  test.waitUntilDone();
  
  window.addEventListener("load", function onload() {
    window.removeEventListener("load", onload, true);
  
    let win = window.document.getElementById("content").contentWindow;
    let worker =  Worker({
        window: win,
        contentScript: 'new ' + function WorkerScope() {
          // Validate self.on and self.emit
          self.port.on('addon-to-content', function (fun, w, obj, array) {
            self.port.emit('content-to-addon', [
                            fun === null,
                            typeof w,
                            "port" in w,
                            w.url,
                            "fun" in obj,
                            Object.keys(obj.dom).length,
                            Array.isArray(array),
                            JSON.stringify(array)
                          ]);
          });
        }
      });
    
    // Validate worker.port
    let array = [1, 2, 3];
    worker.port.on('content-to-addon', function (result) {
      test.assert(result[0], "functions become null");
      test.assertEqual(result[1], "object", "objects stay objects");
      test.assert(result[2], "object's attributes are enumerable");
      test.assertEqual(result[3], "about:blank", "json attribute is accessible");
      test.assert(!result[4], "function as object attribute is removed");
      test.assertEqual(result[5], 0, "DOM nodes are converted into empty object");
      // See bug 714891, Arrays may be broken over compartments:
      test.assert(result[6], "Array keeps being an array");
      test.assertEqual(result[7], JSON.stringify(array),
                       "Array is correctly serialized");
      window.close();
      test.done();
    });

    let obj = {
      fun: function () {},
      dom: window.document.createElement("div")
    };
    worker.port.emit("addon-to-content", function () {}, worker, obj, array);

  }, true);
}

exports['test:content is wrapped'] = function(test) {
  let contentURL = 'data:text/html;charset=utf-8,<script>var documentValue=true;</script>';
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
        window.close();
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
        window.close();
        test.done();
      }
    });

  }, true);

}

exports['test:nothing is leaked to content script'] = function(test) {
  let window = makeWindow();
  test.waitUntilDone();

  window.addEventListener("load", function onload() {
    window.removeEventListener("load", onload, true);

    let worker =  Worker({
      window: window,
      contentScript: 'new ' + function WorkerScope() {
        self.postMessage([
          "ContentWorker" in window,
          "UNWRAP_ACCESS_KEY" in window,
          "getProxyForObject" in window
        ]);
      },
      contentScriptWhen: 'ready',
      onMessage: function(list) {
        test.assert(!list[0], "worker API contrustor isn't leaked");
        test.assert(!list[1], "Proxy API stuff isn't leaked 1/2");
        test.assert(!list[2], "Proxy API stuff isn't leaked 2/2");
        window.close();
        test.done();
      }
    });

  }, true);

}

exports['test:ensure console.xxx works in cs'] = function(test) {
  test.waitUntilDone(5000);

  // Create a new module loader in order to be able to create a `console`
  // module mockup:
  let loader = Loader(module, {
    console: {
      log: hook.bind("log"),
      info: hook.bind("info"),
      warn: hook.bind("warn"),
      error: hook.bind("error"),
      debug: hook.bind("debug"),
      exception: hook.bind("exception")
    }
  });
  let require = loader.require;

  // Intercept all console method calls
  let calls = [];
  function hook(msg) {
    test.assertEqual(this, msg,
                     "console.xxx(\"xxx\"), i.e. message is equal to the " +
                     "console method name we are calling");
    calls.push(msg);
  }

  // Finally, create a worker that will call all console methods
  let window = makeWindow();
  window.addEventListener("load", function onload() {
    window.removeEventListener("load", onload, true);

    let worker =  require('content/worker').Worker({
      window: window,
      contentScript: 'new ' + function WorkerScope() {
        console.log("log");
        console.info("info");
        console.warn("warn");
        console.error("error");
        console.debug("debug");
        console.exception("exception");
        self.postMessage();
      },
      onMessage: function() {
        // Ensure that console methods are called in the same execution order
        test.assertEqual(JSON.stringify(calls),
                         JSON.stringify(["log", "info", "warn", "error", "debug", "exception"]),
                         "console has been called successfully, in the expected order");
        window.close();
        test.done();
      }
    });
  }, true);

}


exports['test:setTimeout can\'t be cancelled by content'] = function(test) {
  let contentURL = 'data:text/html;charset=utf-8,<script>var documentValue=true;</script>';
  let window = makeWindow(contentURL);
  test.waitUntilDone();

  window.addEventListener("load", function onload() {
    window.removeEventListener("load", onload, true);

    let worker =  Worker({
      window: window.document.getElementById("content").contentWindow,
      contentScript: 'new ' + function WorkerScope() {
        let id = setTimeout(function () {
          self.postMessage("timeout");
        }, 100);
        unsafeWindow.eval("clearTimeout("+id+");");
      },
      contentScriptWhen: 'ready',
      onMessage: function(msg) {
        test.assert(msg,
          "content didn't managed to cancel our setTimeout");
        window.close();
        test.done();
      }
    });

  }, true);

}

exports['test:setTimeout are unregistered on content unload'] = function(test) {
  let contentURL = 'data:text/html;charset=utf-8,foo';
  let window = makeWindow(contentURL);
  test.waitUntilDone();

  window.addEventListener("load", function onload() {
    window.removeEventListener("load", onload, true);

    let iframe = window.document.getElementById("content");
    let originalWindow = iframe.contentWindow;
    let worker =  Worker({
      window: iframe.contentWindow,
      contentScript: 'new ' + function WorkerScope() {
        document.title = "ok";
        let i = 0;
        setInterval(function () {
          document.title = i++;
        }, 10);
      },
      contentScriptWhen: 'ready'
    });

    // Change location so that content script is destroyed,
    // and all setTimeout/setInterval should be unregistered.
    // Wait some cycles in order to execute some intervals.
    setTimeout(function () {
      // Bug 689621: Wait for the new document load so that we are sure that
      // previous document cancelled its intervals
      iframe.addEventListener("load", function onload() {
        iframe.removeEventListener("load", onload, true);
        let titleAfterLoad = originalWindow.document.title;
        // Wait additional cycles to verify that intervals are really cancelled
        setTimeout(function () {
          test.assertEqual(iframe.contentDocument.title, "final",
                           "New document has not been modified");
          test.assertEqual(originalWindow.document.title, titleAfterLoad,
                           "Nor previous one");

          window.close();
          test.done();
        }, 100);
      }, true);
      iframe.setAttribute("src", "data:text/html;charset=utf-8,<title>final</title>");
    }, 100);

  }, true);

}

exports['test:check window attribute in iframes'] = function(test) {
  let window = makeWindow();
  test.waitUntilDone();

  // Wait for top-level chrome window loading
  window.addEventListener("load", function onload() {
    window.removeEventListener("load", onload, true);

    // Create a first iframe and wait for its loading
    let contentWin = window.document.getElementById("content").contentWindow;
    let contentDoc = contentWin.document;
    let iframe = contentDoc.createElement("iframe");

    iframe.addEventListener("load", function onload() {
      iframe.removeEventListener("load", onload, true);

      // Create a second iframe inside the first one and wait for its loading
      let iframeDoc = iframe.contentWindow.document;
      let subIframe = iframeDoc.createElement("iframe");

      subIframe.addEventListener("load", function onload() {
        subIframe.removeEventListener("load", onload, true);

        // And finally create a worker against this second iframe
        let worker =  Worker({
          window: subIframe.contentWindow,
          contentScript: 'new ' + function WorkerScope() {
            self.postMessage([
              window.top !== window,
              frameElement,
              window.parent !== window,
              top.location.href,
              parent.location.href,
            ]);
          },
          onMessage: function(msg) {
            test.assert(msg[0], "window.top != window");
            test.assert(msg[1], "window.frameElement is defined");
            test.assert(msg[2], "window.parent != window");
            test.assertEqual(msg[3], contentWin.location.href,
                             "top.location refers to the toplevel content doc");
            test.assertEqual(msg[4], iframe.contentWindow.location.href,
                             "parent.location refers to the first iframe doc");
            window.close();
            test.done();
          }
        });

      }, true);
      subIframe.setAttribute("src", "data:text/html;charset=utf-8,bar");
      iframeDoc.body.appendChild(subIframe);

    }, true);
    iframe.setAttribute("src", "data:text/html;charset=utf-8,foo");
    contentDoc.body.appendChild(iframe);

  }, true);

}

exports['test:check window attribute in toplevel documents'] = function(test) {
  let window = makeWindow();
  test.waitUntilDone();

  window.addEventListener("load", function onload() {
    window.removeEventListener("load", onload, true);

    let contentWin = window.document.getElementById("content").contentWindow;

    let worker =  Worker({
      window: contentWin,
      contentScript: 'new ' + function WorkerScope() {
        self.postMessage([
          window.top === window,
          frameElement,
          window.parent === window
        ]);
      },
      onMessage: function(msg) {
        test.assert(msg[0], "window.top == window");
        test.assert(!msg[1], "window.frameElement is null");
        test.assert(msg[2], "window.parent == window");
        window.close();
        test.done();
      }
    });

  }, true);

}
