var windowUtils = require("window-utils");
var timer = require("timer");

function makeEmptyWindow() {
  var xulNs = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
  var blankXul = ('<?xml version="1.0"?>' +
                  '<?xml-stylesheet href="chrome://global/skin/" ' +
                  '                 type="text/css"?>' +
                  '<window xmlns="' + xulNs + '">' +
                  '</window>');
  var url = "data:application/vnd.mozilla.xul+xml," + escape(blankXul);
  var features = ["chrome", "width=10", "height=10"];

  var ww = Cc["@mozilla.org/embedcomp/window-watcher;1"]
           .getService(Ci.nsIWindowWatcher);
  return ww.openWindow(null, url, null, features.join(","), null);
}

exports.testCloseOnUnload = function(test) {
  var timesClosed = 0;
  var fakeWindow = {
    _listeners: [],
    addEventListener: function(name, func, bool) {
      this._listeners.push(func);
    },
    close: function() {
      timesClosed++;
      this._listeners.forEach(
        function(func) { 
          func({target: fakeWindow.document});
        });
      this._listeners = [];
    },
    document: {
      get defaultView() { return fakeWindow; }
    }
  };

  var loader = test.makeSandboxedLoader();
  loader.require("window-utils").closeOnUnload(fakeWindow);
  test.assertEqual(timesClosed, 0,
                   "window not closed when registered.");
  loader.require("unload").send();
  test.assertEqual(timesClosed, 1,
                   "window closed on module unload.");

  timesClosed = 0;
  loader.require("window-utils").closeOnUnload(fakeWindow);
  test.assertEqual(timesClosed, 0,
                   "window not closed when registered.");
  fakeWindow.close();
  test.assertEqual(timesClosed, 1,
                   "window closed when close() called.");
  loader.require("unload").send();
  test.assertEqual(timesClosed, 1,
                   "window not closed again on module unload.");
  loader.unload();  
};

exports.testWindowWatcher = function(test) {
  var myWindow;
  var finished = false;

  var delegate = {
    onTrack: function(window) {
      if (window == myWindow) {
        test.pass("onTrack() called with our test window");
        timer.setTimeout(function() { myWindow.close(); }, 1);
      }
    },
    onUntrack: function(window) {
      if (window == myWindow) {
        test.pass("onUntrack() called with our test window");
        timer.setTimeout(function() {
                           if (!finished) {
                             finished = true;
                             myWindow = null;
                             wt.unload();
                             test.done();
                           } else
                             test.fail("finishTest() called multiple times.");
                         }, 1);
      }
    }
  };

  var wt = new windowUtils.WindowTracker(delegate);
  myWindow = makeEmptyWindow();
  test.waitUntilDone(5000);
};
