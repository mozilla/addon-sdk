let { Ci, Cc, Cu } = require("chrome");


function EventEmitter(messageManager, listeners, pipe) {
  let pipeListeners = {};
  listeners[pipe] = pipeListeners;
  return {
    emit: function (name) {
      messageManager.sendAsyncMessage(uuid, {
        action: "event",
        pipe: pipe,
        name: name,
        args: Array.slice(arguments, 1)
      });
    },
    on: function (name, callback) {
      if (!pipeListeners[name])
        pipeListeners[name] = [];
      pipeListeners[name].push(callback);
    },
    removeListener: function (name, callback) {
      let list = pipeListeners[name];
      if (!list)
        return;
      let idx = list.indexOf(callback);
      if (idx == -1)
        return;
      pipeListeners[name].splice(idx, 1);
    }
  };
}

function injectLoaderInRemoteBrowser(browser, uuid) {
  let remoteScript = "(function (global, uuid) {" + 
    EventEmitter +
    "new " + function RemoteScope() {
      let listeners = {};
      let loader = Cc["@mozilla.org/moz/jssubscript-loader;1"].
                   getService(Ci.mozIJSSubScriptLoader);
      function load(url, pipe) {
        let scope = {};
        scope.Pipe = EventEmitter(global, listeners, pipe);
        scope.window = global.content;
        if (url.indexOf("data:text/javascript,") == 0) {
          with(scope) {
            eval(url.replace("data:text/javascript,", ""));
          }
        }
        else {
          loader.loadSubScript(url, scope);
        }
      }
      addMessageListener(uuid, function (msg) {
        try {
          let json = msg.json;
          if (json.action == "load") {
            load(json.url, json.pipe)
          }
          else if (json.action == "event") {
            let list = listeners[json.pipe];
            if (!list)
              return;
            list = list[json.name];
            if (!list)
              return;
            for each(let callback in list)
              callback.apply(null, json.args);
          }
        } catch(e) {
          sendAsyncMessage('log','ex : '+e+'\n');
        }
      });
    
    } + ";"+
  "})(this, '" + uuid + "')";
  browser.frameLoader.messageManager.
    loadFrameScript("data:text/javascript," + remoteScript, false);
}

let uuid = new Date().getTime();
let browsers = [];
let pipeCount = 1;
let listeners = {};

let global = Cc["@mozilla.org/globalmessagemanager;1"].getService(Ci.nsIChromeFrameMessageManager);
global.addMessageListener("log", function (msg) {
  console.log("===> "+msg.json);
});
global.addMessageListener(uuid, function (msg) {
  let json = msg.json;
  if (json.action == "event") {
    let list = listeners[json.pipe];
    if (!list)
      return;
    list = list[json.name];
    if (!list)
      return;
    for each(let callback in list)
      callback.apply(null, json.args);
  }
});

//TODO: handle tab close/unload
exports.loadRemoteScript = function loadRemoteScript(browser, url) {
  if (browsers.indexOf(browser) == -1) {
    injectLoaderInRemoteBrowser(browser, uuid);
    browsers.push(browser);
  }
  let pipe = pipeCount++;
  let mm = browser.frameLoader.messageManager;
  mm.sendAsyncMessage(uuid, {
    action: "load",
    url: url,
    pipe: pipe
  });
  
  return EventEmitter(mm, listeners, pipe);
}
