const {Cc,Ci} = require("chrome");

exports.testConstructor = function(test) {

  const tabBrowser = require("tab-browser");

  test.waitUntilDone(30000);

  tabBrowser.addTab("about:blank", { inNewWindow: true, onLoad: function(e) {
    const widgets = require("widget");
    const url = require("url");

    let browserWindow = e.target.defaultView;
    let doc = browserWindow.document;

    function container() doc.getElementById("addon-bar");
    function widgetCount() container() ? container().getElementsByTagName("toolbaritem").length : 0;
    let widgetStartCount = widgetCount();
    function widgetNode(index) container() ? container().getElementsByTagName("toolbaritem")[index] : null;

    // Test basic construct/destroy
    let w = widgets.Widget({ label: "foo", content: "bar" });
    test.assertEqual(widgetCount(), widgetStartCount + 1, "panel has correct number of child elements after widget construction");

    w.destroy();
    w.destroy();
    test.pass("Multiple destroys do not cause an error");
    test.assertEqual(widgetCount(), widgetStartCount, "panel has correct number of child elements after destroy");

    // Test nothing
    test.assertRaises(
      function() widgets.Widget({}),
      "The widget must have a non-empty label property.",
      "throws on no properties");

    // Test no label
    test.assertRaises(
      function() widgets.Widget({content: "foo"}),
      "The widget must have a non-empty label property.",
      "throws on no label");

    // Test empty label
    test.assertRaises(
      function() widgets.Widget({label: "", content: "foo"}),
      "The widget must have a non-empty label property.",
      "throws on empty label");

    // Test no content or image
    test.assertRaises(
      function() widgets.Widget({label: "foo"}),
      "No image or content property found. Widgets must have one or the other.",
      "throws on no content");

    // Test empty content, no image
    test.assertRaises(
      function() widgets.Widget({label: "foo", content: ""}),
      "No image or content property found. Widgets must have one or the other.",
      "throws on empty content");

    // Test empty image, no content
    test.assertRaises(
      function() widgets.Widget({label: "foo", image: ""}),
      "No image or content property found. Widgets must have one or the other.",
      "throws on empty content");

    // Test empty content, empty image
    test.assertRaises(
      function() widgets.Widget({label: "foo", content: "", image: ""}),
      "No image or content property found. Widgets must have one or the other.",
      "throws on empty content");

    /**
     * Helper for testing a single widget.
     * Confirms proper addition and content setup.
     */
    function testSingleWidget(widgetOptions) {
      let startCount = widgetCount();
      let widget = widgets.Widget(widgetOptions);
      let node = widgetNode(startCount);
      test.assert(node, "widget node at index");
      test.assertEqual(node.tagName, "toolbaritem", "widget element is correct");
      test.assertEqual(widget.width + "px", node.style.minWidth, "widget width is correct");
      test.assertEqual(widgetCount(), startCount + 1, "container has correct number of child elements");
      let content = node.firstElementChild;
      test.assert(content, "found content");
      test.assertMatches(content.tagName, /iframe|image/, "content is iframe or image");
      return widget;
    }

    // Array of widgets to test
    // and a function to test them.
    let tests = [];
    function nextTest() {
      if (!tests.length) {
        closeBrowserWindow(browserWindow, function() {
          test.done();
        });
      }
      else
        require("timer").setTimeout(tests.shift(), 0);
    }
    function doneTest() nextTest();

    // text widget
    tests.push(function() testSingleWidget({
      label: "text widget",
      content: "oh yeah",
      onReady: function(widget, e) {
        test.assertEqual(e.target.body.innerHTML, widget.content, "content matches");
        widget.destroy();
        doneTest();
      }
    }));

    // html widget
    tests.push(function() testSingleWidget({
      label: "html widget",
      content: "<div>oh yeah</div>",
      onReady: function(widget, e) {
        test.assertEqual(e.target.body.innerHTML, widget.content, "content matches");
        widget.destroy();
        doneTest();
      }
    }));

    // image url widget
    tests.push(function() testSingleWidget({
      label: "image url widget",
      content: require("self").data.url("moz_favicon.ico"),
      onLoad: function(widget, e) {
        test.assertEqual(e.target.body.firstElementChild.tagName, "IMG", "tag name matches");
        test.assertEqual(e.target.body.firstElementChild.src, widget.content, "content matches");
        widget.destroy();
        doneTest();
      }
    }));

    // image widget
    tests.push(function() testSingleWidget({
      label: "image widget",
      image: require("self").data.url("moz_favicon.ico"),
      onLoad: function(widget, e) {
        test.assertEqual(e.target.body.firstElementChild.tagName, "IMG", "tag name matches");
        test.assertEqual(e.target.body.firstElementChild.src, require("self").data.url(widget.image), "content matches");
        widget.destroy();
        doneTest();
      }
    }));

    // web uri widget
    tests.push(function() testSingleWidget({
      label: "web uri widget",
      content: require("self").data.url("test.html"),
      onReady: function(widget, e) {
        test.assertEqual(e.target.title, "foo", "title matches");
        test.assertEqual(e.target.body.firstElementChild.tagName, "P", "element matches");
        test.assertEqual(e.target.body.firstElementChild.innerHTML, "bar", "element content matches");
        widget.destroy();
        doneTest();
      }
    }));

    // event: onclick + content
    tests.push(function() testSingleWidget({
      label: "click test widget - content",
      content: "<div id='me'>foo</div>",
      onReady: function(widget, e) {
        if (e.target.defaultView)
          sendMouseEvent({type:"click"}, "me", e.target.defaultView);
      },
      onClick: function(widget, e) {
        test.pass("onClick called");
        widget.destroy();
        doneTest();
      }
    }));

    // event: onmouseover + content
    tests.push(function() testSingleWidget({
      label: "mouseover test widget - content",
      content: "<div id='me'>foo</div>",
      onReady: function(widget, e) {
        sendMouseEvent({type:"mouseover"}, "me", e.target.defaultView);
      },
      onMouseOver: function(widget, e) {
        test.pass("onMouseOver called");
        widget.destroy();
        doneTest();
      }
    }));

    // event: onmouseout + content
    tests.push(function() testSingleWidget({
      label: "mouseout test widget - content",
      content: "<div id='me'>foo</div>",
      onReady: function(widget, e) {
        sendMouseEvent({type:"mouseout"}, "me", e.target.defaultView);
      },
      onMouseOut: function(widget, e) {
        test.pass("onMouseOut called");
        widget.destroy();
        doneTest();
      }
    }));

    // event: onclick + image
    tests.push(function() testSingleWidget({
      label: "click test widget - image",
      image: require("self").data.url("moz_favicon.ico"),
      onLoad: function(widget, e) {
        if (e.target.defaultView)
          sendMouseEvent({type:"click"}, null, e.target.defaultView);
      },
      onClick: function(widget, e) {
        test.pass("onClick called");
        widget.destroy();
        doneTest();
      }
    }));

    // event: onmouseover + image
    tests.push(function() testSingleWidget({
      label: "mouseover test widget - image",
      image: require("self").data.url("moz_favicon.ico"),
      onLoad: function(widget, e) {
        sendMouseEvent({type:"mouseover"}, null, e.target.defaultView);
      },
      onMouseOver: function(widget, e) {
        test.pass("onMouseOver called");
        widget.destroy();
        doneTest();
      }
    }));

    // event: onmouseout + image
    tests.push(function() testSingleWidget({
      label: "mouseout test widget - image",
      image: require("self").data.url("moz_favicon.ico"),
      onLoad: function(widget, e) {
        sendMouseEvent({type:"mouseout"}, null, e.target.defaultView);
      },
      onMouseOut: function(widget, e) {
        test.pass("onMouseOut called");
        widget.destroy();
        doneTest();
      }
    }));

    // test multiple widgets
    tests.push(function() {
      let w1 = widgets.Widget({label: "first widget", content: "first content"});
      let w2 = widgets.Widget({label: "second widget", content: "second content"});

      w1.destroy();
      w2.destroy();

      doneTest();
    });

    // test updating widget content
    let loads = 0;
    tests.push(function() testSingleWidget({
      label: "content update test widget",
      content: "<div id='me'>foo</div>",
      onReady: function(widget, e) {
        if (loads == 0) {
          widget.content = "<div id='me'>bar</div>";
          loads++;
        }
        else {
          test.assertEqual(widget.content, "<div id='me'>bar</div>");
          widget.destroy();
          doneTest();
        }
      }
    }));

    // test tooltip
    tests.push(function() testSingleWidget({
      label: "text widget",
      content: "oh yeah",
      tooltip: "foo",
      onReady: function(widget, e) {
        test.assertEqual(widget.tooltip, "foo", "tooltip matches");
        widget.destroy();
        doneTest();
      }
    }));

    // test tooltip fallback to label
    tests.push(function() testSingleWidget({
      label: "fallback",
      content: "oh yeah",
      onReady: function(widget, e) {
        test.assertEqual(widget.tooltip, widget.label, "tooltip fallbacks to label");
        widget.destroy();
        doneTest();
      }
    }));

    // test updating widget tooltip
    let updated = false;
    tests.push(function() testSingleWidget({
      label: "tooltip update test widget",
      tooltip: "foo",
      content: "<div id='me'>foo</div>",
      onReady: function(widget, e) {
        if (!updated) {
          widget.tooltip = "bar";
          updated = true;
        }
        else {
          test.assertEqual(widget.tooltip, "bar", "tooltip gets updated");
          widget.destroy();
          doneTest();
        }
      }
    }));

    // test multiple windows
    tests.push(function() {
      tabBrowser.addTab("about:blank", { inNewWindow: true, onLoad: function(e) {
        let browserWindow = e.target.defaultView;
        let doc = browserWindow.document;
        function container() doc.getElementById("addon-bar");
        function widgetCount2() container() ? container().childNodes.length : 0;
        let widgetStartCount2 = widgetCount2();

        let w1Opts = {label: "first widget", content: "first content"};
        let w1 = testSingleWidget(w1Opts);
        test.assertEqual(widgetCount2(), widgetStartCount2 + 1, "2nd window has correct number of child elements after first widget");

        let w2Opts = {label: "second widget", content: "second content"};
        let w2 = testSingleWidget(w2Opts);
        test.assertEqual(widgetCount2(), widgetStartCount2 + 2, "2nd window has correct number of child elements after second widget");

        w1.destroy();
        test.assertEqual(widgetCount2(), widgetStartCount2 + 1, "2nd window has correct number of child elements after first destroy");
        w2.destroy();
        test.assertEqual(widgetCount2(), widgetStartCount2, "2nd window has correct number of child elements after second destroy");

        closeBrowserWindow(browserWindow, function() {
          doneTest();
        });
      }});
    });

    // test the visibility keyboard shortcut
    tests.push(function() {
      // Test hide/show the widget bar
      function toggleUI() {
        let keyEvent = doc.createEvent("KeyEvents");
        let ctrlKey = false, metaKey = false, shiftKey = true, altKey = false, charCode = keyEvent.DOM_VK_U, keyCode = 0;
        if(/^Mac/.test(browserWindow.navigator.platform))
          metaKey = true;
        else
          ctrlKey = true;
        keyEvent.initKeyEvent("keypress", true, true, browserWindow, ctrlKey, altKey, shiftKey, metaKey, keyCode, charCode);
        doc.dispatchEvent(keyEvent);
      }

      test.assert(container().collapsed, "UI is not visible when no widgets");
      let w = widgets.Widget({label: "foo", content: "bar"});
      test.assert(container(), "UI exists when widgets are created");
      test.assertEqual(container().collapsed, false, "UI is visible by default");
      toggleUI(); 
      test.assertEqual(container().collapsed, true, "keyboard shortcut hides UI when visible");
      toggleUI(); 
      test.assertEqual(container().collapsed, false, "keyboard shortcut shows UI when hidden");
      w.destroy();
      doneTest();
    });

    // test widget.width
    tests.push(function() testSingleWidget({
      label: "test widget.width",
      content: "test width",
      width: 200,
      onReady: function(widget, e) {
        test.assertEqual(widget.width, 200);

        let node = widgetNode(0);
        test.assertEqual(widget.width, node.style.minWidth.replace("px", ""));
        test.assertEqual(widget.width, node.firstElementChild.style.width.replace("px", ""));
        widget.width = 300;
        test.assertEqual(widget.width, node.style.minWidth.replace("px", ""));
        test.assertEqual(widget.width, node.firstElementChild.style.width.replace("px", ""));

        widget.destroy();
        doneTest();
      }
    }));

    // kick off test execution
    doneTest();
  }});
};

exports.testPanelWidget = function testPanelWidget(test) {
  let widgets = require("widget");
  let widget1 = widgets.Widget({
    label: "panel widget 1",
    content: "<div id='me'>foo</div>",
    onLoad: function(widget, e) {
      sendMouseEvent({type:"click"}, "me", e.target.defaultView);
    },
    panel: require("panel").Panel({
      contentURL: "data:text/html,<body>Look ma, a panel!</body>",
      onShow: function() {
        widget1.destroy();
        test.pass("panel displayed on click");
        test.done();
      }
    })
  });

  test.assertRaises(
    function() {
      widgets.Widget({
        label: "panel widget 2",
        panel: {}
      });
    },
    "The option \"panel\" must be one of the following types: null, undefined, object",
    "widget.panel must be a Panel object"
  );

  let onClickCalled = false;
  let widget3 = widgets.Widget({
    label: "panel widget 3",
    content: "<div id='me'>foo</div>",
    onLoad: function(widget, e) {
      sendMouseEvent({type:"click"}, "me", e.target.defaultView);
    },
    onClick: function(widget) {
      onClickCalled = true;
      widget.panel.show();
    },
    panel: require("panel").Panel({
      contentURL: "data:text/html,<body>Look ma, a panel!</body>",
      onShow: function() {
        test.assert(
          onClickCalled,
          "onClick called on click for widget with both panel and onClick"
        );
        widget3.destroy();
        test.done();
      }
    })
  });

  test.waitUntilDone();
};

/******************* helpers *********************/

// Helper for getting the active window
this.__defineGetter__("activeWindow", function activeWindow() {
  return Cc["@mozilla.org/appshell/window-mediator;1"].
         getService(Ci.nsIWindowMediator).
         getMostRecentWindow("navigator:browser");
});

// Helper for calling code at window close
function closeBrowserWindow(window, callback) {
  require("timer").setTimeout(function() {
    window.addEventListener("unload", function() {
      window.removeEventListener("unload", arguments.callee, false);
      callback();
    }, false);
    window.close();
  }, 0);
}

// FROM: http://mxr.mozilla.org/mozilla-central/source/testing/mochitest/tests/SimpleTest/EventUtils.js

/**
 * Send a mouse event to the node with id aTarget. The "event" passed in to
 * aEvent is just a JavaScript object with the properties set that the real
 * mouse event object should have. This includes the type of the mouse event.
 * E.g. to send an click event to the node with id 'node' you might do this:
 *
 * sendMouseEvent({type:'click'}, 'node');
 */
function sendMouseEvent(aEvent, aTarget, aWindow) {
  if (['click', 'mousedown', 'mouseup', 'mouseover', 'mouseout'].indexOf(aEvent.type) == -1) {
    throw new Error("sendMouseEvent doesn't know about event type '"+aEvent.type+"'");
  }

  if (!aWindow) {
    aWindow = window;
  }

  // For events to trigger the UA's default actions they need to be "trusted"
  //aWindow.netscape.security.PrivilegeManager.enablePrivilege('UniversalBrowserWrite');

  var event = aWindow.document.createEvent('MouseEvent');

  var typeArg          = aEvent.type;
  var canBubbleArg     = true;
  var cancelableArg    = true;
  var viewArg          = aWindow;
  var detailArg        = aEvent.detail        || (aEvent.type == 'click'     ||
                                                  aEvent.type == 'mousedown' ||
                                                  aEvent.type == 'mouseup' ? 1 : 0);
  var screenXArg       = aEvent.screenX       || 0;
  var screenYArg       = aEvent.screenY       || 0;
  var clientXArg       = aEvent.clientX       || 0;
  var clientYArg       = aEvent.clientY       || 0;
  var ctrlKeyArg       = aEvent.ctrlKey       || false;
  var altKeyArg        = aEvent.altKey        || false;
  var shiftKeyArg      = aEvent.shiftKey      || false;
  var metaKeyArg       = aEvent.metaKey       || false;
  var buttonArg        = aEvent.button        || 0;
  var relatedTargetArg = aEvent.relatedTarget || null;

  event.initMouseEvent(typeArg, canBubbleArg, cancelableArg, viewArg, detailArg,
                       screenXArg, screenYArg, clientXArg, clientYArg,
                       ctrlKeyArg, altKeyArg, shiftKeyArg, metaKeyArg,
                       buttonArg, relatedTargetArg);

  var target = aTarget ? aWindow.document.getElementById(aTarget) :
                         aWindow.document;
  target.dispatchEvent(event);
}

// ADD NO TESTS BELOW THIS LINE! ///////////////////////////////////////////////

// If the module doesn't support the app we're being run in, require() will
// throw.  In that case, remove all tests above from exports, and add one dummy
// test that passes.
try {
  require("widget");
}
catch (err) {
  // This bug should be mentioned in the error message.
  let bug = "https://bugzilla.mozilla.org/show_bug.cgi?id=560716";
  if (err.message.indexOf(bug) < 0)
    throw err;
  for (let [prop, val] in Iterator(exports)) {
    if (/^test/.test(prop) && typeof(val) === "function")
      delete exports[prop];
  }
  exports.testAppNotSupported = function (test) {
    test.pass("context-menu does not support this application.");
  };
}

