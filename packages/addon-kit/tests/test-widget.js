const {Cc,Ci} = require("chrome");

exports.testConstructor = function(test) {

  const tabBrowser = require("tab-browser");

  test.waitUntilDone(30000);
  
  const widgets = require("widget");
  const url = require("url");
  const windowUtils = require("window-utils");

  let browserWindow = windowUtils.activeBrowserWindow;
  let doc = browserWindow.document;
  let AddonsMgrListener = browserWindow.AddonsMgrListener;

  function container() doc.getElementById("addon-bar");
  function widgetCount() container() ? container().getElementsByTagName("toolbaritem").length : 0;
  let widgetStartCount = widgetCount();
  function widgetNode(index) container() ? container().getElementsByTagName("toolbaritem")[index] : null;

  // Test basic construct/destroy
  AddonsMgrListener.onInstalling();
  let w = widgets.Widget({ id: "fooID", label: "foo", content: "bar" });
  AddonsMgrListener.onInstalled();
  test.assertEqual(widgetCount(), widgetStartCount + 1, "panel has correct number of child elements after widget construction");
  
  // test widget height
  test.assertEqual(widgetNode(0).firstChild.boxObject.height, 16, "widget has correct default height");
  
  AddonsMgrListener.onUninstalling();
  w.destroy();
  AddonsMgrListener.onUninstalled();
  w.destroy();
  test.pass("Multiple destroys do not cause an error");
  test.assertEqual(widgetCount(), widgetStartCount, "panel has correct number of child elements after destroy");
  
  // Test automatic widget destroy on unload
  let loader = test.makeSandboxedLoader();
  let widgetsFromLoader = loader.require("widget");
  let widgetStartCount = widgetCount();
  let w = widgetsFromLoader.Widget({ id: "fooID", label: "foo", content: "bar" });
  test.assertEqual(widgetCount(), widgetStartCount + 1, "widget has been correctly added");
  loader.unload();
  test.assertEqual(widgetCount(), widgetStartCount, "widget has been destroyed on module unload");
  
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
    function() widgets.Widget({id: "fooID", label: "foo"}),
    "No content or contentURL property found. Widgets must have one or the other.",
    "throws on no content");
  
  // Test empty content, no image
  test.assertRaises(
    function() widgets.Widget({id:"fooID", label: "foo", content: ""}),
    "No content or contentURL property found. Widgets must have one or the other.",
    "throws on empty content");

  // Test empty image, no content
  test.assertRaises(
    function() widgets.Widget({id:"fooID", label: "foo", image: ""}),
    "No content or contentURL property found. Widgets must have one or the other.",
    "throws on empty content");

  // Test empty content, empty image
  test.assertRaises(
    function() widgets.Widget({id:"fooID", label: "foo", content: "", image: ""}),
    "No content or contentURL property found. Widgets must have one or the other.",
    "throws on empty content");
  
  // Test duplicated ID
  let duplicateID = widgets.Widget({id: "foo", label: "foo", content: "bar"});
  test.assertRaises(
    function() widgets.Widget({id: "foo", label: "bar", content: "bar"}),
    /This widget ID is already used:/,
    "throws on duplicated id");
  duplicateID.destroy();
  
  // Test duplicate label, different ID
  let w1 = widgets.Widget({id: "id1", label: "foo", content: "bar"});
  let w2 = widgets.Widget({id: "id2", label: "foo", content: "bar"});
  w1.destroy();
  w2.destroy();
  
  // Test position restore on create/destroy/create
  // Create 3 ordered widgets
  let w1 = widgets.Widget({id: "first", label:"first", content: "bar"});
  let w2 = widgets.Widget({id: "second", label:"second", content: "bar"});
  let w3 = widgets.Widget({id: "third", label:"third", content: "bar"});
  // Remove the middle widget
  test.assertEqual(widgetNode(1).getAttribute("label"), "second", "second widget is the second widget inserted");
  w2.destroy();
  test.assertEqual(widgetNode(1).getAttribute("label"), "third", "second widget is removed, so second widget is now the third one");
  w2 = widgets.Widget({id: "second", label:"second", content: "bar"});
  test.assertEqual(widgetNode(1).getAttribute("label"), "second", "second widget is created again, at the same location");
  // Cleanup this testcase
  AddonsMgrListener.onUninstalling();
  w1.destroy();
  w2.destroy();
  w3.destroy();
  AddonsMgrListener.onUninstalled();
  
  // Test concurrent widget module instances on addon-bar hiding
  let loader = test.makeSandboxedLoader();
  let anotherWidgetsInstance = loader.require("widget");
  test.assert(container().collapsed, "UI is hidden when no widgets");
  AddonsMgrListener.onInstalling();
  let w1 = widgets.Widget({id: "foo", label: "foo", content: "bar"});
  // Ideally we would let AddonsMgrListener display the addon bar
  // But, for now, addon bar is immediatly displayed by sdk code
  // https://bugzilla.mozilla.org/show_bug.cgi?id=627484
  test.assert(!container().collapsed, "UI is already visible when we just added the widget");
  AddonsMgrListener.onInstalled();
  test.assert(!container().collapsed, "UI become visible when we notify AddonsMgrListener about end of addon installation");
  let w2 = anotherWidgetsInstance.Widget({id: "bar", label: "bar", content: "foo"});
  test.assert(!container().collapsed, "UI still visible when we add a second widget");
  AddonsMgrListener.onUninstalling();
  w1.destroy();
  AddonsMgrListener.onUninstalled();
  test.assert(!container().collapsed, "UI still visible when we remove one of two widgets");
  AddonsMgrListener.onUninstalling();
  w2.destroy();
  test.assert(!container().collapsed, "UI is still visible when we have removed all widget but still not called onUninstalled");
  AddonsMgrListener.onUninstalled();
  test.assert(container().collapsed, "UI is hidden when we have removed all widget and called onUninstalled");
  
  // Helper for testing a single widget.
  // Confirms proper addition and content setup.
  function testSingleWidget(widgetOptions) {
    // We have to display which test is being run, because here we do not
    // use the regular test framework but rather a custom one that iterates
    // the `tests` array.
    console.info("executing: " + widgetOptions.id);
    
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
    test.assertEqual(widgetCount(), 0, "widget in last test property cleaned itself up");
    if (!tests.length)
      test.done();
    else
      require("timer").setTimeout(tests.shift(), 0);
  }
  function doneTest() nextTest();

  // text widget
  tests.push(function testTextWidget() testSingleWidget({
    id: "text",
    label: "text widget",
    content: "oh yeah",
    contentScript: "self.postMessage(document.body.innerHTML);",
    contentScriptWhen: "end",
    onMessage: function (message) {
      test.assertEqual(this.content, message, "content matches");
      this.destroy();
      doneTest();
    }
  }));

  // html widget
  tests.push(function testHTMLWidget() testSingleWidget({
    id: "html",
    label: "html widget",
    content: "<div>oh yeah</div>",
    contentScript: "self.postMessage(document.body.innerHTML);",
    contentScriptWhen: "end",
    onMessage: function (message) {
      test.assertEqual(this.content, message, "content matches");
      this.destroy();
      doneTest();
    }
  }));

  // image url widget
  tests.push(function testImageURLWidget() testSingleWidget({
    id: "image",
    label: "image url widget",
    contentURL: require("self").data.url("test.html"),
    contentScript: "self.postMessage({title: document.title, " +
                   "tag: document.body.firstElementChild.tagName, " + 
                   "content: document.body.firstElementChild.innerHTML});",
    contentScriptWhen: "end",
    onMessage: function (message) {
      test.assertEqual(message.title, "foo", "title matches");
      test.assertEqual(message.tag, "P", "element matches");
      test.assertEqual(message.content, "bar", "element content matches");
      this.destroy();
      doneTest();
    }
  }));

  // web uri widget
  tests.push(function testWebURIWidget() testSingleWidget({
    id: "web",
    label: "web uri widget",
    contentURL: require("self").data.url("test.html"),
    contentScript: "self.postMessage({title: document.title, " +
                   "tag: document.body.firstElementChild.tagName, " + 
                   "content: document.body.firstElementChild.innerHTML});",
    contentScriptWhen: "end",
    onMessage: function (message) {
      test.assertEqual(message.title, "foo", "title matches");
      test.assertEqual(message.tag, "P", "element matches");
      test.assertEqual(message.content, "bar", "element content matches");
      this.destroy();
      doneTest();
    }
  }));

  // event: onclick + content
  tests.push(function testOnclickEventContent() testSingleWidget({
    id: "click",
    label: "click test widget - content",
    content: "<div id='me'>foo</div>",
    contentScript: "var evt = document.createEvent('HTMLEvents'); " +
                   "evt.initEvent('click', true, true ); " +
                   "document.getElementById('me').dispatchEvent(evt);",
    contentScriptWhen: "end",
    onClick: function() {
      test.pass("onClick called");
      this.destroy();
      doneTest();
    }
  }));

  // event: onmouseover + content
  tests.push(function testOnmouseoverEventContent() testSingleWidget({
    id: "mouseover",
    label: "mouseover test widget - content",
    content: "<div id='me'>foo</div>",
    contentScript: "var evt = document.createEvent('HTMLEvents'); " +
                   "evt.initEvent('mouseover', true, true ); " +
                   "document.getElementById('me').dispatchEvent(evt);",
    contentScriptWhen: "end",
    onMouseover: function() {
      test.pass("onMouseover called");
      this.destroy();
      doneTest();
    }
  }));

  // event: onmouseout + content
  tests.push(function testOnmouseoutEventContent() testSingleWidget({
    id: "mouseout",
    label: "mouseout test widget - content",
    content: "<div id='me'>foo</div>",
    contentScript: "var evt = document.createEvent('HTMLEvents'); " +
                   "evt.initEvent('mouseout', true, true ); " +
                   "document.getElementById('me').dispatchEvent(evt);",
    contentScriptWhen: "end",
    onMouseout: function() {
      test.pass("onMouseout called");
      this.destroy();
      doneTest();
    }
  }));

  // event: onclick + image
  tests.push(function testOnclickEventImage() testSingleWidget({
    id: "click",
    label: "click test widget - image",
    contentURL: require("self").data.url("moz_favicon.ico"),
    contentScript: "var evt = document.createEvent('HTMLEvents'); " +
                   "evt.initEvent('click', true, true ); " +
                   "document.body.firstElementChild.dispatchEvent(evt);",
    contentScriptWhen: "end",
    onClick: function() {
      test.pass("onClick called");
      this.destroy();
      doneTest();
    }
  }));

  // event: onmouseover + image
  tests.push(function testOnmouseoverEventImage() testSingleWidget({
    id: "mouseover",
    label: "mouseover test widget - image",
    contentURL: require("self").data.url("moz_favicon.ico"),
    contentScript: "var evt = document.createEvent('HTMLEvents'); " +
                   "evt.initEvent('mouseover', true, true ); " +
                   "document.body.firstElementChild.dispatchEvent(evt);",
    contentScriptWhen: "end",
    onMouseover: function() {
      test.pass("onMouseover called");
      this.destroy();
      doneTest();
    }
  }));

  // event: onmouseout + image
  tests.push(function testOnmouseoutEventImage() testSingleWidget({
    id: "mouseout",
    label: "mouseout test widget - image",
    contentURL: require("self").data.url("moz_favicon.ico"),
    contentScript: "var evt = document.createEvent('HTMLEvents'); " +
                   "evt.initEvent('mouseout', true, true ); " +
                   "document.body.firstElementChild.dispatchEvent(evt);",
    contentScriptWhen: "end",
    onMouseout: function() {
      test.pass("onMouseout called");
      this.destroy();
      doneTest();
    }
  }));

  // test multiple widgets
  tests.push(function testMultipleWidgets() {
    let w1 = widgets.Widget({id: "first", label: "first widget", content: "first content"});
    let w2 = widgets.Widget({id: "second", label: "second widget", content: "second content"});

    w1.destroy();
    w2.destroy();

    doneTest();
  });

  // test updating widget content
  let loads = 0;
  tests.push(function testUpdatingWidgetContent() testSingleWidget({
    id: "content",
    label: "content update test widget",
    content: "<div id='me'>foo</div>",
    contentScript: "self.postMessage(1)",
    contentScriptWhen: "ready",
    onMessage: function(message) {
      if (!this.flag) {
        this.content = "<div id='me'>bar</div>";
        this.flag = 1;
      }
      else {
        test.assertEqual(this.content, "<div id='me'>bar</div>");
        this.destroy();
        doneTest();
      }
    }
  }));

  // test updating widget contentURL
  let url1 = "data:text/html,<body>foodle</body>";
  let url2 = "data:text/html,<body>nistel</body>";
  
  tests.push(function testUpdatingContentURL() testSingleWidget({
    id: "content",
    label: "content update test widget",
    contentURL: url1,
    contentScript: "self.postMessage(document.location.href);",
    contentScriptWhen: "end",
    onMessage: function(message) {
      if (!this.flag) {
        test.assertEqual(this.contentURL.toString(), url1);
        test.assertEqual(message, url1);
        this.contentURL = url2;
        this.flag = 1;
      }
      else {
        test.assertEqual(this.contentURL.toString(), url2);
        test.assertEqual(message, url2);
        this.destroy();
        doneTest();
      }
    }
  }));

  // test tooltip
  tests.push(function testTooltip() testSingleWidget({
    id: "text",
    label: "text widget",
    content: "oh yeah",
    tooltip: "foo",
    contentScript: "self.postMessage(1)",
    contentScriptWhen: "ready",
    onMessage: function(message) {
      test.assertEqual(this.tooltip, "foo", "tooltip matches");
      this.destroy();
      doneTest();
    }
  }));

  // test tooltip fallback to label
  tests.push(function testTooltipFallback() testSingleWidget({
    id: "fallback",
    label: "fallback",
    content: "oh yeah",
    contentScript: "self.postMessage(1)",
    contentScriptWhen: "ready",
    onMessage: function(message) {
      test.assertEqual(this.tooltip, this.label, "tooltip fallbacks to label");
      this.destroy();
      doneTest();
    }
  }));

  // test updating widget tooltip
  let updated = false;
  tests.push(function testUpdatingTooltip() testSingleWidget({
    id: "tooltip",
    label: "tooltip update test widget",
    tooltip: "foo",
    content: "<div id='me'>foo</div>",
    contentScript: "self.postMessage(1)",
    contentScriptWhen: "ready",
    onMessage: function(message) {
      this.tooltip = "bar";
      test.assertEqual(this.tooltip, "bar", "tooltip gets updated");
      this.destroy();
      doneTest();
    }
  }));

  // test multiple windows
  tests.push(function testMultipleWindows() {
    tabBrowser.addTab("about:blank", { inNewWindow: true, onLoad: function(e) {
      let browserWindow = e.target.defaultView;
      let doc = browserWindow.document;
      function container() doc.getElementById("addon-bar");
      function widgetCount2() container() ? container().childNodes.length : 0;
      let widgetStartCount2 = widgetCount2();

      let w1Opts = {id:"first", label: "first widget", content: "first content"};
      let w1 = testSingleWidget(w1Opts);
      test.assertEqual(widgetCount2(), widgetStartCount2 + 1, "2nd window has correct number of child elements after first widget");

      let w2Opts = {id:"second", label: "second widget", content: "second content"};
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
  
  // test window closing
  tests.push(function testWindowClosing() {
    // 1/ Create a new widget
    let w1Opts = {
      id:"first", 
      label: "first widget", 
      content: "first content",
      contentScript: "self.port.on('event', function () self.port.emit('event'))"
    };
    let widget = testSingleWidget(w1Opts);
    let windows = require("windows").browserWindows;
    
    // 2/ Retrieve a WidgetView for the initial browser window
    let acceptDetach = false;
    let mainView = widget.getView(windows.activeWindow);
    test.assert(mainView, "Got first widget view");    
    mainView.on("detach", function () {
      // 8/ End of our test. Accept detach event only when it occurs after
      // widget.destroy()
      if (acceptDetach)
        doneTest();
      else
        test.fail("View on initial window should not be destroyed");
    });
    mainView.port.on("event", function () {
      // 7/ Receive event sent during 6/ and cleanup our test
      acceptDetach = true;
      widget.destroy();
    });
    
    // 3/ First: open a new browser window
    windows.open({
      url: "about:blank",
      onOpen: function(window) {
        // 4/ Retrieve a WidgetView for this new window
        let view = widget.getView(window);
        test.assert(view, "Got second widget view");
        view.port.on("event", function () {
          test.fail("We should not receive event on the detach view");
        });
        view.on("detach", function () {
          // The related view is destroyed
          // 6/ Send a custom event
          test.assertRaises(function () {
              view.port.emit("event");
            },
            /The widget has been destroyed and can no longer be used./,
            "emit on a destroyed view should throw");
          widget.port.emit("event");
        });
        
        // 5/ Destroy this window
        window.close();        
      }
    });
  });
  
  tests.push(function testAddonBarHide() {
    // Hide the addon-bar
    browserWindow.setToolbarVisibility(container(), false);
    
    // Then open a browser window and verify that the addon-bar remains hidden
    tabBrowser.addTab("about:blank", { inNewWindow: true, onLoad: function(e) {
      let browserWindow = e.target.defaultView;
      let doc = browserWindow.document;
      function container2() doc.getElementById("addon-bar");
      function widgetCount2() container2() ? container2().childNodes.length : 0;
      let widgetStartCount2 = widgetCount2();
      
      let w1Opts = {id:"first", label: "first widget", content: "first content"};
      let w1 = testSingleWidget(w1Opts);
      test.assertEqual(widgetCount2(), widgetStartCount2 + 1, "2nd window has correct number of child elements after widget creation");

      w1.destroy();
      test.assertEqual(widgetCount2(), widgetStartCount2, "2nd window has correct number of child elements after widget destroy");
      
      test.assert(container().collapsed, "1st window has an hidden addon-bar");
      test.assert(container2().collapsed, "2nd window has an hidden addon-bar");
      
      browserWindow.setToolbarVisibility(container(), true);
      
      closeBrowserWindow(browserWindow, function() {
        doneTest();
      });
    }});
  });

  // test widget.width
  tests.push(function testWidgetWidth() testSingleWidget({
    id: "text",
    label: "test widget.width",
    content: "test width",
    width: 200,
    contentScript: "self.postMessage(1)",
    contentScriptWhen: "ready",
    onMessage: function(message) {
      test.assertEqual(this.width, 200);

      let node = widgetNode(0);
      test.assertEqual(this.width, node.style.minWidth.replace("px", ""));
      test.assertEqual(this.width, node.firstElementChild.style.width.replace("px", ""));
      this.width = 300;
      test.assertEqual(this.width, node.style.minWidth.replace("px", ""));
      test.assertEqual(this.width, node.firstElementChild.style.width.replace("px", ""));

      this.destroy();
      doneTest();
    }
  }));

  // test click handler not respond to right-click
  let clickCount = 0;
  tests.push(function testNoRightClick() testSingleWidget({
    id: "click-content",
    label: "click test widget - content",
    content: "<div id='me'>foo</div>",
    contentScript: "var evt = document.createEvent('MouseEvents'); " +
                   "evt.initMouseEvent('click', true, true, window, " +
                   "  0, 0, 0, 0, 0, false, false, false, false, 2, null); " +
                   "document.getElementById('me').dispatchEvent(evt); " +
                   "evt = document.createEvent('HTMLEvents'); " +
                   "evt.initEvent('click', true, true ); " +
                   "document.getElementById('me').dispatchEvent(evt); " +
                   "evt = document.createEvent('HTMLEvents'); " +
                   "evt.initEvent('mouseover', true, true ); " +
                   "document.getElementById('me').dispatchEvent(evt);",
    contentScriptWhen: "end",
    onClick: function() clickCount++,
    onMouseover: function() {
      test.assertEqual(clickCount, 1, "right click wasn't sent to click handler");
      this.destroy();
      doneTest();
    }
  }));

  // kick off test execution
  doneTest();
};

exports.testPanelWidget1 = function testPanelWidget1(test) {
  const widgets = require("widget");

  let widget1 = widgets.Widget({
    id: "panel1",
    label: "panel widget 1",
    content: "<div id='me'>foo</div>",
    contentScript: "var evt = document.createEvent('HTMLEvents'); " +
                   "evt.initEvent('click', true, true ); " +
                   "document.body.dispatchEvent(evt);",
    contentScriptWhen: "end",
    panel: require("panel").Panel({
      contentURL: "data:text/html,<body>Look ma, a panel!</body>",
      onShow: function() {
        widget1.destroy();
        test.pass("panel displayed on click");
        test.done();
      }
    })
  });
  test.waitUntilDone();
};

exports.testPanelWidget2 = function testPanelWidget2(test) {
  const widgets = require("widget");
  test.assertRaises(
    function() {
      widgets.Widget({
        id: "panel2",
        label: "panel widget 2",
        panel: {}
      });
    },
    "The option \"panel\" must be one of the following types: null, undefined, object",
    "widget.panel must be a Panel object"
  );
};

exports.testPanelWidget3 = function testPanelWidget3(test) {
  const widgets = require("widget");
  let onClickCalled = false;
  let widget3 = widgets.Widget({
    id: "panel3",
    label: "panel widget 3",
    content: "<div id='me'>foo</div>",
    contentScript: "var evt = document.createEvent('HTMLEvents'); " +
                   "evt.initEvent('click', true, true ); " +
                   "document.body.firstElementChild.dispatchEvent(evt);",
    contentScriptWhen: "end",
    onClick: function() {
      onClickCalled = true;
      this.panel.show();
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

exports.testWidgetMessaging = function testWidgetMessaging(test) {
  test.waitUntilDone();
  let origMessage = "foo";
  const widgets = require("widget");
  let widget = widgets.Widget({
    id: "foo",
    label: "foo",
    content: "<bar>baz</bar>",
    contentScriptWhen: "end",
    contentScript: "self.on('message', function(data) { self.postMessage(data); }); self.postMessage('ready');",
    onMessage: function(message) {
      if (message == "ready")
        widget.postMessage(origMessage);
      else {
        test.assertEqual(origMessage, message);
        widget.destroy();
        test.done();
      }
    }
  });
};

exports.testWidgetViews = function testWidgetViews(test) {
  test.waitUntilDone();
  const widgets = require("widget");
  let widget = widgets.Widget({
    id: "foo",
    label: "foo",
    content: "<bar>baz</bar>",
    contentScriptWhen: "ready",
    contentScript: "self.on('message', function(data) self.postMessage(data)); self.postMessage('ready')",
    onAttach: function(view) {
      test.pass("WidgetView created");
      view.on("message", function () {
        test.pass("Got message in WidgetView");
        widget.destroy();
      });
      view.on("detach", function () {
        test.pass("WidgetView destroyed");
        test.done();
      });
    }
  });
  
};

exports.testWidgetViewsUIEvents = function testWidgetViewsUIEvents(test) {
  test.waitUntilDone();
  const widgets = require("widget");
  let view = null;
  let widget = widgets.Widget({
    id: "foo",
    label: "foo",
    content: "<div id='me'>foo</div>",
    contentScript: "var evt = document.createEvent('HTMLEvents'); " +
                   "evt.initEvent('click', true, true ); " +
                   "document.getElementById('me').dispatchEvent(evt);",
    contentScriptWhen: "ready",
    onAttach: function(attachView) {
      view = attachView;
      test.pass("Got attach event");
    },
    onClick: function (eventView) {
      test.assertEqual(view, eventView, 
                         "event first argument is equal to the WidgetView");
      let view2 = widget.getView(require("windows").browserWindows.activeWindow);
      test.assertEqual(view, view2, 
                         "widget.getView return the same WidgetView");
      widget.destroy();
      test.done();
    }
  });
};

exports.testWidgetViewsCustomEvents = function testWidgetViewsCustomEvents(test) {
  test.waitUntilDone();
  const widgets = require("widget");
  let widget = widgets.Widget({
    id: "foo",
    label: "foo",
    content: "<div id='me'>foo</div>",
    contentScript: "self.port.emit('event', 'ok');",
    contentScriptWhen: "ready",
    onAttach: function(view) {
      view.port.on("event", function (data) {
        test.assertEqual(data, "ok", 
                         "event argument is valid on WidgetView");
      });
    },
  });
  widget.port.on("event", function (data) {
    test.assertEqual(data, "ok", 
                     "event argument is valid on Widget");
    widget.destroy();
    test.done();
  });
};

exports.testWidgetViewsTooltip = function testWidgetViewsTooltip(test) {
  test.waitUntilDone();
  const widgets = require("widget");
  
  let widget = new widgets.Widget({
    id: "foo",
    label: "foo",
    content: "foo"
  });
  let view = widget.getView(require("windows").browserWindows.activeWindow);
  widget.tooltip = null;
  test.assertEqual(view.tooltip, "foo", 
                   "view tooltip defaults to base widget label");
  test.assertEqual(widget.tooltip, "foo", 
                   "tooltip defaults to base widget label");
  widget.destroy();
  test.done();
};

exports.testWidgetMove = function testWidgetMove(test) {
  test.waitUntilDone();
  
  let windowUtils = require("window-utils");
  let widgets = require("widget");
  
  let browserWindow = windowUtils.activeBrowserWindow;
  let doc = browserWindow.document;
  
  let label = "unique-widget-label";
  let origMessage = "message after node move";
  let gotFirstReady = false;
  
  let widget = widgets.Widget({
    id: "foo",
    label: label,
    content: "<bar>baz</bar>",
    contentScriptWhen: "ready",
    contentScript: "self.on('message', function(data) { self.postMessage(data); }); self.postMessage('ready');",
    onMessage: function(message) {
      if (message == "ready") {
        if (!gotFirstReady) {
          test.pass("Got first ready event");
          let widgetNode = doc.querySelector('toolbaritem[label="' + label + '"]');
          let parent = widgetNode.parentNode;
          parent.insertBefore(widgetNode, parent.firstChild);
          gotFirstReady = true;
        } else {
          test.pass("Got second ready event");
          widget.postMessage(origMessage);
        }
      }
      else {
        test.assertEqual(origMessage, message, "Got message after node move");
        widget.destroy();
        test.done();
      }
    }
  });
};

/*
The bug is exhibited when a widget with HTML content has it's content
changed to new HTML content with a pound in it. Because the src of HTML
content is converted to a data URI, the underlying iframe doesn't
consider the content change a navigation change, so doesn't load
the new content.
*/
exports.testWidgetWithPound = function testWidgetWithPound(test) {
  test.waitUntilDone();

  function getWidgetContent(widget) {
    let windowUtils = require("window-utils");
    let browserWindow = windowUtils.activeBrowserWindow;
    let doc = browserWindow.document;
    let widgetNode = doc.querySelector('toolbaritem[label="' + widget.label + '"]');
    test.assert(widgetNode, 'found widget node in the front-end');
    return widgetNode.firstChild.contentDocument.body.innerHTML;
  }

  let widgets = require("widget");
  let count = 0;
  let widget = widgets.Widget({
    id: "1",
    label: "foo",
    content: "foo",
    contentScript: "window.addEventListener('load', self.postMessage, false);",
    onMessage: function() {
      count++;
      if (count == 1) {
        widget.content = "foo#";
      }
      else {
        test.assertEqual(getWidgetContent(widget), "foo#", "content updated to pound?");
        widget.destroy();
        test.done();
      }
    }
  });
};

/******************* helpers *********************/

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

