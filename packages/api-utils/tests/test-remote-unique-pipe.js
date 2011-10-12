let { Ci, Cc, Cu } = require("chrome");
let remote = require("remote-unique-pipe");

exports.testSimple = function (test) {
  test.waitUntilDone();
  let wm = Cc['@mozilla.org/appshell/window-mediator;1']
           .getService(Ci.nsIWindowMediator);
  let browserWindow = wm.getMostRecentWindow("navigator:browser");
  let tabBrowser = browserWindow.Browser || browserWindow.gBrowser;
  let tab = tabBrowser.selectedTab;
  let browser = tab.browser;
  let pipe = remote.loadRemoteScript(browser, "data:text/javascript," + 
                                              "Pipe.emit('foo', 'bar');");
  pipe.on("foo", function (bar) {
    test.assertEqual(bar, "bar");
    test.done();
  });
}

exports.testTwoWays = function (test) {
  test.waitUntilDone();
  let wm = Cc['@mozilla.org/appshell/window-mediator;1']
           .getService(Ci.nsIWindowMediator);
  let browserWindow = wm.getMostRecentWindow("navigator:browser");
  let tabBrowser = browserWindow.Browser || browserWindow.gBrowser;
  let tab = tabBrowser.selectedTab;
  let browser = tab.browser;
  let pipe = remote.loadRemoteScript(browser, "data:text/javascript," + 
                                              "Pipe.on('2nd', function (bar) {" +
                                              "  Pipe.emit('3rd', bar);" +
                                              "});" +
                                              "Pipe.emit('1st', 'foo');");
  pipe.on("1st", function (foo) {
    test.assertEqual(foo, "foo");
    pipe.emit("2nd", "bar");
  });
  pipe.on("3rd", function (bar) {
    test.assertEqual(bar, "bar");
    test.done();
  });
}

exports.testDistinctPipes = function (test) {
  test.waitUntilDone();
  let wm = Cc['@mozilla.org/appshell/window-mediator;1']
           .getService(Ci.nsIWindowMediator);
  let browserWindow = wm.getMostRecentWindow("navigator:browser");
  let tabBrowser = browserWindow.Browser || browserWindow.gBrowser;
  let tab = tabBrowser.selectedTab;
  let browser = tab.browser;
  let pipe1 = remote.loadRemoteScript(browser, "data:text/javascript," + 
                                               "Pipe.on('evt', function (foo) {" +
                                               "  Pipe.emit('evt', foo);" +
                                               "});");

  let pipe2 = remote.loadRemoteScript(browser, "data:text/javascript," + 
                                               "Pipe.on('evt', function (bar) {" +
                                               "  Pipe.emit('evt', bar);" +
                                               "});");
  
  pipe1.on("evt", function (foo) {
    test.assertEqual(foo, "foo");
    pipe2.emit("evt", "bar");
  });
  pipe2.on("evt", function (bar) {
    test.assertEqual(bar, "bar");
    test.done();
  });
  pipe1.emit("evt", "foo");
}

exports.testDistinctPipesOverAddons = function (test) {
  test.waitUntilDone();
  let wm = Cc['@mozilla.org/appshell/window-mediator;1']
           .getService(Ci.nsIWindowMediator);
  let browserWindow = wm.getMostRecentWindow("navigator:browser");
  let tabBrowser = browserWindow.Browser || browserWindow.gBrowser;
  let tab = tabBrowser.selectedTab;
  let browser = tab.browser;
  let pipe1 = remote.loadRemoteScript(browser, "data:text/javascript," + 
                                               "Pipe.on('evt', function (foo) {" +
                                               "  Pipe.emit('evt', foo);" +
                                               "});");

  let loader = test.makeSandboxedLoader();
  let pipe2 = loader.require("remote-unique-pipe").
    loadRemoteScript(browser, "data:text/javascript," + 
                              "Pipe.on('evt', function (bar) {" +
                              "  Pipe.emit('evt', bar);" +
                              "});");
  
  pipe1.on("evt", function (foo) {
    test.assertEqual(foo, "foo");
    pipe2.emit("evt", "bar");
  });
  pipe2.on("evt", function (bar) {
    test.assertEqual(bar, "bar");
    test.done();
  });
  pipe1.emit("evt", "foo");
}
