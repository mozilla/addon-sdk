"use strict";

const Ci = Components.interfaces;

addMessageListener("sdk/test/context-menu/open", message => {
  const {data, name} = message;
  const target = data.target && content.document.querySelector(data.target);
  const rect = target ? target.getBoundingClientRect() :
               {left:0, top:0, width:0, height:0};

  content.
    QueryInterface(Ci.nsIInterfaceRequestor).
    getInterface(Ci.nsIDOMWindowUtils).
    sendMouseEvent("contextmenu",
                   rect.left + (rect.width / 2),
                   rect.top + (rect.height / 2),
                   2, 1, 0);
});
