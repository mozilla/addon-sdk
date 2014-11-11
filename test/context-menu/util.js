"use strict";

const {getMostRecentBrowserWindow, open} = require("sdk/window/utils");
const {openTab, closeTab, getBrowserForTab} = require("sdk/tabs/utils");
const {when} = require("sdk/dom/events");

const framescriptURI = require.resolve("./framescript");

const _target = ({target}) => target;

exports.openWindow = () => when(open(), "load", true).then(_target);

exports.openTab = (url, window=getMostRecentBrowserWindow()) => {
  const tab = openTab(window, url);
  const browser = getBrowserForTab(tab);
  browser.messageManager.loadFrameScript(framescriptURI, false);

  return when(browser, "load", true).then(_ => tab);
};

exports.openContextMenu = (tab, selector) => {
  const browser = getBrowserForTab(tab);
  browser.
    messageManager.
    sendAsyncMessage("sdk/test/context-menu/open",
                     {target: selector});

  return when(tab.ownerDocument.defaultView, "popupshown").
          then(_target);
};

exports.closeContextMenu = (menu) => {
  const result = when(menu.ownerDocument.defaultView, "popuphidden").
                  then(_target);

  menu.hidePopup();
  return result;
};

exports.closeTab = (tab) => {
  const result = when(tab, "TabClose").then(_ => tab);
  closeTab(tab);

  return result;
};
