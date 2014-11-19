"use strict";

const { Ci } = require("chrome");

const windowToMessageManager = window =>
  window.
    QueryInterface(Ci.nsIInterfaceRequestor).
    getInterface(Ci.nsIDocShell).
    sameTypeRootTreeItem.
    QueryInterface(Ci.nsIDocShell).
    QueryInterface(Ci.nsIInterfaceRequestor).
    getInterface(Ci.nsIContentFrameMessageManager);
exports.windowToMessageManager = windowToMessageManager;

const nodeToMessageManager = node =>
  windowToMessageManager(node.ownerDocument.defaultView);
exports.nodeToMessageManager = nodeToMessageManager;
