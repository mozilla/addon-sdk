const tabAPI = require("tabs/tab");
const tabs = require("tabs"); // From addon-kit
const windowUtils = require("window-utils");

exports.testGetTabForWindow = function(test) {
  test.waitUntilDone();
  
  test.assertEqual(tabAPI.getTabForWindow(windowUtils.activeWindow), null,
    "getTabForWindow return null on topwindow");
  test.assertEqual(tabAPI.getTabForWindow(windowUtils.activeBrowserWindow), null,
    "getTabForWindow return null on topwindow");
  
  let subSubDocument = encodeURIComponent(
    'Sub iframe<br/>'+
    '<iframe id="sub-sub-iframe" src="data:text/html,SubSubIframe" />');
  let subDocument = encodeURIComponent(
    'Iframe<br/>'+
    '<iframe id="sub-iframe" src="data:text/html,'+subSubDocument+'" />');
  let url = 'data:text/html,' + encodeURIComponent(
    'Content<br/><iframe id="iframe" src="data:text/html,'+subDocument+'" />');
  
  tabs.open({
    url: url,
    onReady: function(tab) {
      let window = windowUtils.activeBrowserWindow.content;
      
      let matchedTab = tabAPI.getTabForWindow(window);
      test.assertEqual(matchedTab, tab, 
        "We are able to find the tab with his content window object");
      
      let timer = require("timer");
      function waitForFrames() {
        let iframe = window.document.getElementById("iframe");
        if (!iframe) {
          timer.setTimeout(waitForFrames, 100);
          return;
        }
        let iframeWin = iframe.contentWindow;
        let subIframe = iframeWin.document.getElementById("sub-iframe");
        if (!subIframe) {
          timer.setTimeout(waitForFrames, 100);
          return;
        }
        let subIframeWin = subIframe.contentWindow;
        let subSubIframe = subIframeWin.document.getElementById("sub-sub-iframe");
        if (!subSubIframe) {
          timer.setTimeout(waitForFrames, 100);
          return;
        }
        let subSubIframeWin = subSubIframe.contentWindow;
        
        matchedTab = tabAPI.getTabForWindow(iframeWin);
        test.assertEqual(matchedTab, tab, 
          "We are able to find the tab with an iframe window object");
        
        matchedTab = tabAPI.getTabForWindow(subIframeWin);
        test.assertEqual(matchedTab, tab, 
          "We are able to find the tab with a sub-iframe window object");
        
        matchedTab = tabAPI.getTabForWindow(subSubIframeWin);
        test.assertEqual(matchedTab, tab, 
          "We are able to find the tab with a sub-sub-iframe window object");
        
        tab.close(function () {
          test.done();
        });
      }
      waitForFrames();
      
    }
  });
};
