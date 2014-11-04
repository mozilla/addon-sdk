"use strict";

const shared = require("toolkit/require");
const { loadModule } = shared.require("framescript/manager");
const { Cc, Ci } = require("chrome");

let globalMM = Cc["@mozilla.org/globalmessagemanager;1"]
  .getService(Ci.nsIMessageListenerManager);
loadModule(globalMM, "framescript/context-menu", true);

exports.testStub = function*(assert) {
  let Listener = () => function onMessage(message) {
    onMessage.receive(message)
  }


  globalMM.broadcastAsyncMessage("sdk/context-menu/readers", {
    "tagName": {
      category: "reader/query",
      path: "tagName"
    }
  })

  globalMM.broadcastAsyncMessage("sdk/context-menu/readers", {
    "namespaceURI": {
      category: "reader/query",
      path: "namespaceURI"
    }
  })

  globalMM.broadcastAsyncMessage("sdk/context-menu/readers", {
    "documentURI": {
      category: "reader/query",
      path: "ownerDocument.URL"
    }
  })


  var onContext = Listener()
  onContext.receive = message => console.log(message.data)
  globalMM.addMessageListener("sdk/context-menu/read", onContext)

  yield new Promise(_ => _)
};

require("test").run(exports);
