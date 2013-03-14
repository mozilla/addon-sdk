const { getMostRecentBrowserWindow } = require('sdk/window/utils');
const { PageMod } = require("sdk/page-mod");
const { openDialog } = require('sdk/window/utils');
const { getActiveTab, setTabURL, openTab, closeTab } = require('sdk/tabs/utils');
const xulApp = require('sdk/system/xul-app');
const windowHelpers = require('sdk/window/helpers');
const promise = require("sdk/core/promise");
const { isPrivate } = require('sdk/private-browsing');
const { isTabPBSupported, isWindowPBSupported } = require('sdk/private-browsing/utils');

function openWebpage(url, enablePrivate) {
  if (xulApp.is("Fennec")) {
    let chromeWindow = getMostRecentBrowserWindow();
    let rawTab = openTab(chromeWindow, url, {
      isPrivate: enablePrivate
    });
    return {
      close: function () {
        closeTab(rawTab)
        // Returns a resolved promise as there is no need to wait
        return promise.resolve();
      }
    };
  }
  else {
    let win = openDialog({
      private: enablePrivate
    });
    win.addEventListener("load", function onLoad() {
      win.removeEventListener("load", onLoad, false);
      setTabURL(getActiveTab(win), url);
    });
    return {
      close: function () {
        return windowHelpers.close(win);
      }
    };
  }
}

exports["test page-mod on private tab"] = function (assert, done) {
  // Only set private mode when explicitely supported.
  // (fennec 19 has some intermediate PB support where isTabPBSupported
  // will be false, but isPrivate(worker.tab) will be true if we open a private
  // tab)
  let setPrivate = isTabPBSupported || isWindowPBSupported;

  let id = Date.now().toString(36);
  let frameUri = "data:text/html;charset=utf-8," + id;
  let uri = "data:text/html;charset=utf-8," +
            encodeURIComponent(id + "<iframe src='" + frameUri + "'><iframe>");

  let count = 0;
  let pageMod = new PageMod({
    include: [uri, frameUri],
    onAttach: function(worker) {
      assert.ok(worker.tab.url == uri || worker.tab.url == frameUri,
                "Got a worker attached to the private window tab");

      if (setPrivate) {
        assert.ok(isPrivate(worker.tab), "The document is really private");
      }
      else {
        assert.ok(!isPrivate(worker.tab),
                  "private browsing isn't supported, " +
                  "so that the document isn't private");
      }

      if (++count == 2) {
        pageMod.destroy();
        page.close().then(done);
      }
    }
  });

  let page = openWebpage(uri, setPrivate);
}

exports["test page-mod on non-private tab"] = function (assert, done) {
  let pageMod = new PageMod({
    include: "about:buildconfig",
    onAttach: function(worker) {
      assert.equal(worker.tab.url, "about:buildconfig",
                   "Got a worker attached to the private window tab");
      assert.ok(!isPrivate(worker.tab), "The document is really non-private");
      pageMod.destroy();
      page.close().then(done);
    }
  });

  let page = openWebpage("about:buildconfig", false);
}
