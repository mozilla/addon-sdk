let { Cc, Ci } = require("chrome");
let panels = require('panel');
let URL = require("url").URL;
let tests = {}, panels, Panel;

tests.testPanel = function(test) {
  test.waitUntilDone();
  let panel = Panel({
    contentURL: "about:buildconfig",
    contentScript: "postMessage(1); on('message', function() postMessage(2));",
    onMessage: function (message) {
      switch(message) {
        case 1:
          test.pass("The panel was loaded.");
          panel.postMessage('');
          break;
        case 2:
          test.pass("The panel posted a message and received a response.");
          panel.destroy();
          test.done();
          break;
      }
    }
  });
};

tests.testShowHidePanel = function(test) {
  test.waitUntilDone();
  let panel = Panel({
    contentScript: "postMessage('')",
    contentScriptWhen: "ready",
    onMessage: function (message) {
      panel.show();
    },
    onShow: function () {
      test.pass("The panel was shown.");
      panel.hide();
    },
    onHide: function () {
      panel.destroy();
      test.pass("The panel was hidden.");
      test.done();
    }
  });
};

tests.testResizePanel = function(test) {
  test.waitUntilDone();

  // These tests fail on Linux if the browser window in which the panel
  // is displayed is not active.  And depending on what other tests have run
  // before this one, it might not be (the untitled window in which the test
  // runner executes is often active).  So we make sure the browser window
  // is focused by focusing it before running the tests.  Then, to be the best
  // possible test citizen, we refocus whatever window was focused before we
  // started running these tests.

  let activeWindow = Cc["@mozilla.org/appshell/window-mediator;1"].
                     getService(Ci.nsIWindowMediator).
                     getMostRecentWindow(null);
  let browserWindow = Cc["@mozilla.org/appshell/window-mediator;1"].
                      getService(Ci.nsIWindowMediator).
                      getMostRecentWindow("navigator:browser");

  function onFocus() {
    browserWindow.removeEventListener("focus", onFocus, true);

    let panel = Panel({
      contentScript: "postMessage('')",
      contentScriptWhen: "ready",
      height: 10,
      width: 10,
      onMessage: function (message) {
        panel.show();
      },
      onShow: function () {
        panel.resize(100,100);
        panel.hide();
      },
      onHide: function () {
        test.assert((panel.width == 100) && (panel.height == 100),
          "The panel was resized.");
        activeWindow.focus();
        test.done();
      }
    });
  }

  if (browserWindow === activeWindow) {
    onFocus();
  }
  else {
    browserWindow.addEventListener("focus", onFocus, true);
    browserWindow.focus();
  }
};

tests.testHideBeforeShow = function(test) {
  test.waitUntilDone();
  let showCalled = false;
  let panel = Panel({
    onShow: function () {
      showCalled = true;
    },
    onHide: function () {
      test.assert(!showCalled, 'must not emit show if was hidden before');
      test.done();
    }
  });
  panel.show();
  panel.hide();
};

tests.testSeveralShowHides = function(test) {
  test.waitUntilDone();
  let hideCalled = 0;
  let panel = panels.Panel({
    contentURL: "about:buildconfig",
    onShow: function () {
      panel.hide();
    },
    onHide: function () {
      hideCalled++;
      if (hideCalled < 3)
        panel.show();
      else {
        test.pass("onHide called three times as expected");
        test.done();
      }
    }
  });
  panel.on('error', function(e) {
    test.fail('error was emitted:' + e.message + '\n' + e.stack);
  });
  panel.show();
};

function makeEventOrderTest(options) {
  let expectedEvents = [];

  return function(test) {
    let panel = panels.Panel({ contentURL: "about:buildconfig" });

    function expect(event, cb) {
      expectedEvents.push(event);
      panel.on(event, function() {
        test.assertEqual(event, expectedEvents.shift());
        if (cb)
          require("timer").setTimeout(cb, 1);
      });
      return {then: expect};
    }

    test.waitUntilDone();
    options.test(test, expect, panel);
  }
}

tests.testWaitForInitThenShowThenDestroy = makeEventOrderTest({
  test: function(test, expect, panel) {
    expect('inited', function() { panel.show(); }).
      then('show', function() { panel.destroy(); }).
      then('hide', function() { test.done(); });
  }
});

tests.testShowThenWaitForInitThenDestroy = makeEventOrderTest({
  test: function(test, expect, panel) {
    panel.show();
    expect('inited').
      then('show', function() { panel.destroy(); }).
      then('hide', function() { test.done(); });
  }
});

tests.testShowThenHideThenDestroy = makeEventOrderTest({
  test: function(test, expect, panel) {
    panel.show();
    expect('show', function() { panel.hide(); }).
      then('hide', function() { panel.destroy(); test.done(); });
  }
});

tests.testContentURLOption = function(test) {
  const URL_STRING = "about:buildconfig";
  const HTML_CONTENT = "<html><title>Test</title><p>This is a test.</p></html>";

  let (panel = Panel({ contentURL: URL_STRING })) {
    test.pass("contentURL accepts a string URL.");
    test.assert(panel.contentURL instanceof URL,
                "contentURL is a URL object.");
    test.assertEqual(panel.contentURL.toString(), URL_STRING,
                "contentURL stringifies to the string to which it was set.");
  }

  let url = URL(URL_STRING);
  let (panel = Panel({ contentURL: url })) {
    test.pass("contentURL accepts a URL object.");
    test.assert(panel.contentURL instanceof URL,
                "contentURL is a URL object.");
    test.assertEqual(panel.contentURL.toString(), url.toString(),
                "contentURL stringifies to the URL to which it was set.");
  }

  let dataURL = "data:text/html," + encodeURIComponent(HTML_CONTENT);
  let (panel = Panel({ contentURL: dataURL })) {
    test.pass("contentURL accepts a data: URL.");
  }
  
  let (panel = Panel({})) {
    test.assert(panel.contentURL == null,
                "contentURL is undefined.");
  }

  test.assertRaises(function () Panel({ contentURL: "foo" }),
                    "The `contentURL` option must be a URL.",
                    "Panel throws an exception if contentURL is not a URL.");
};

let panelSupported = true;

try {
  panels = require("panel");
  Panel = panels.Panel;
}
catch(ex if ex.message == [
    "The panel module currently supports only Firefox.  In the future ",
    "we would like it to support other applications, however.  Please see ",
    "https://bugzilla.mozilla.org/show_bug.cgi?id=jetpack-panel-apps ",
    "for more information."
  ].join("")) {
  panelSupported = false;
}

if (panelSupported) {
  for (let test in tests)
    exports[test] = tests[test];
}
else {
  exports.testPanelNotSupported = function(test) {
    test.pass("The panel module is not supported on this app.");
  }
}
