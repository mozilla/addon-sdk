var JS_VERSION = "1.8";

var console = {
  warn: function (msg) {
    Pipe.emit("dump", "warn: "+msg);
  },
  error: function (msg) {
    Pipe.emit("dump", "error: "+msg);
  },
  exception: function (msg) {
    Pipe.emit("dump", "exception: "+msg);
  },
  log: function (msg) {
    Pipe.emit("dump", "log: "+msg);
  },
};

function CreateWorker(worker) {

  let subScriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"]
	                      .getService(Ci.mozIJSSubScriptLoader);

  // create an event emitter that receive and send events from/to the addon
  let _emitListeners = {};
  let _port = {
    emit: function () {
      Pipe.emit("emit", Array.slice(arguments));
    },
    on: function (name, callback) {
      if (!(name in _emitListeners))
        _emitListeners[name] = [];
      _emitListeners[name].push(callback);
    }
  };
  Pipe.on("emit", function (msg) {
    let args = arguments;
    let name = args.splice(1);
    if (!(name in _emitListeners))
      return;
    let callbacks = _emitListeners[name];
    for(let callback in callbacks) {
      callback.apply(null, args);
    }
  });

  let window = content;
  // Create the sandbox and bind it to window in order for content scripts to
  // have access to all standard globals (window, document, ...)
  let sandbox = Components.utils.Sandbox(window, {
    sandboxPrototype: window,
    wantXrays: false
  });
  Object.defineProperties(sandbox, {
    window: { get: function() sandbox },
    top: { get: function() sandbox },
    // Use the Greasemonkey naming convention to provide access to the
    // unwrapped window object so the content script can access document
    // JavaScript values.
    // NOTE: this functionality is experimental and may change or go away
    // at any time!
    unsafeWindow: { get: function () window.wrappedJSObject }
  });

  // Overriding / Injecting some natives into sandbox.
  //Components.utils.evalInSandbox(shims.contents, sandbox, JS_VERSION, shims.filename);

  Object.defineProperties(sandbox, {
    onMessage: {
      get: function() WorkerGlobalScope._onMessage,
      set: function(value) {
        console.warn("The global `onMessage` function in content scripts " +
                     "is deprecated in favor of the `self.on()` function. " +
                     "Replace `onMessage = function (data){}` definitions " +
                     "with calls to `self.on('message', function (data){})`. " +
                     "For more info on `self.on`, see " +
                     "<https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/addon-development/web-content.html>.");
        WorkerGlobalScope._onMessage = value;
      },
      configurable: true
    },
    console: { value: console, configurable: true },
    
    // Deprecated use of on/postMessage from globals
    on: {
      value: function () {
        console.warn("The global `on()` function in content scripts is " +
                     "deprecated in favor of the `self.on()` function, " +
                     "which works the same. Replace calls to `on()` with " +
                     "calls to `self.on()`" +
                     "For more info on `self.on`, see " +
                     "<https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/addon-development/web-content.html>.");
        WorkerGlobalScope.on.apply(WorkerGlobalScope, arguments);
      },
      configurable: true
    }, 
    postMessage: {
      value: function () {
        console.warn("The global `postMessage()` function in content " +
                     "scripts is deprecated in favor of the " +
                     "`self.postMessage()` function, which works the same. " +
                     "Replace calls to `postMessage()` with calls to " +
                     "`self.postMessage()`." +
                     "For more info on `self.on`, see " +
                     "<https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/addon-development/web-content.html>.");
        WorkerGlobalScope.postMessage.apply(WorkerGlobalScope, arguments);
      },
      configurable: true
    }
  });


  // List of all living timeouts/intervals
  let _timers = null;

  let __onMessage = null;

  const WorkerGlobalScope = {
    // Wrapper adds `try catch` blocks to the callbacks in order to
    // emit `error` event on a worker if exception is thrown in
    // the Worker global scope.
    // @see http://www.w3.org/TR/workers/#workerutils
    setTimeout: function setTimeout(callback, delay) {
      let params = Array.slice(arguments, 2);
      let id = setTimeout(function() {
        try {
          delete _timers[id];
          callback.apply(null, params);
        } catch(e) {
          console.exception(e);
          //self._addonWorker._asyncEmit('error', e);
        }
      }, delay);
      _timers[id] = true;
      return id;
    },
    clearTimeout: function clearTimeout(id){
      delete _timers[id];
      return clearTimeout(id);
    },

    setInterval: function setInterval(callback, delay) {
      let params = Array.slice(arguments, 2);
      let id = setInterval(function() {
        try {
          delete _timers[id];
          callback.apply(null, params); 
        } catch(e) {
          console.exception(e);
          //self._addonWorker._asyncEmit('error', e);
        }
      }, delay);
      _timers[id] = true;
      return id;
    },
    clearInterval: function clearInterval(id) {
      delete _timers[id];
      return clearInterval(id);
    },

    /**
     * `onMessage` function defined in the global scope of the worker context.
     */
     
    get _onMessage() __onMessage,
    set _onMessage(value) {
      /*
      let listener = __onMessage;
      if (listener && value !== listener) {
        this.removeListener('message', listener);
        this.__onMessage = undefined;
      }
      if (value)
        this.on('message', this.__onMessage = value);
      */
    },

    /**
     * Function for sending data to the addon side.
     * Validates that data is a `JSON` or primitive value and emits
     * 'message' event on the worker in the next turn of the event loop.
     * _Later this will be sending data across process boundaries._
     * @param {JSON|String|Number|Boolean} data
     */
    postMessage: function postMessage(data) {
      Pipe.emit("postMessage", JSON.parse(JSON.stringify(data)));
    },
    
    /**
     * EventEmitter, that behaves (calls listeners) asynchronously.
     * A way to send customized messages to / from the worker.
     * Events from in the worker can be observed / emitted via self.on / self.emit 
     */
    get port() _port,

    /**
     * Alias to the global scope in the context of worker. Similar to
     * `window` concept.
     */
    get self() WorkerGlobalScope,
    
    on: function (name, callback) {
      if (name == "message") {
        Pipe.on("message", callback);
      }
    }

  };
  // List of content script globals:
  let keys = ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 
              'self'];
  for each (let key in keys) {
    Object.defineProperty(
      sandbox, key, Object.getOwnPropertyDescriptor(WorkerGlobalScope, key)
    );
  }


  /**
   * Evaluates code in the sandbox.
   * @param {String} code
   *    JavaScript source to evaluate.
   * @param {String} [filename='javascript:' + code]
   *    Name of the file
   */
  function _evaluate(code, filename) {
    filename = filename || 'javascript:' + code;
    try {
      Cu.evalInSandbox(code, sandbox, JS_VERSION, filename, 1);
    }
    catch(e) {
      console.exception(e);
    }
  }

  /**
   * Imports scripts to the sandbox by reading files under urls and
   * evaluating its source. If exception occurs during evaluation
   * `"error"` event is emitted on the worker.
   * This is actually an analog to the `importScript` method in web
   * workers but in our case it's not exposed even though content
   * scripts may be able to do it synchronously since IO operation
   * takes place in the UI process.
   */
  function _importScripts(url) {
    let urls = Array.slice(arguments, 0);
    for each (let contentScriptFile in urls) {
      try {
        console.log("Evaluate : "+contentScriptFile);
	      subScriptLoader.loadSubScript(contentScriptFile, sandbox);
      }
      catch(e) {
        console.exception(e);
      }
    }
  }

  // The order of `contentScriptFile` and `contentScript` evaluation is
  // intentional, so programs can load libraries like jQuery from script URLs
  // and use them in scripts.
  let contentScriptFile = ('contentScriptFile' in worker) ? worker.contentScriptFile
        : null,
      contentScript = ('contentScript' in worker) ? worker.contentScript : null;

  _importScripts.apply(null, contentScriptFile);
  
  if (contentScript) {
    _evaluate(
      Array.isArray(contentScript) ? contentScript.join(';\n') : contentScript
    );
  }
  Pipe.emit("evaluated");

  function _destructor() {
    this._removeAllListeners();
    // Unregister all setTimeout/setInterval
    // We can use `clearTimeout` for both setTimeout/setInterval
    // as internal implementation of timer module use same method for both.
    for (let id in this._timers)
      clearTimeout(id);
    this._addonWorker = null;
    this.__onMessage = undefined;
  }

}

Pipe.on("create-worker", function (worker) {
  try {
    let when = worker.contentScriptWhen;
    if (when == "end") {
      content.addEventListener("load", function listener() {
        content.removeEventListener("load", listener, false);
        CreateWorker(worker);
      }, false);
    }
    else if (when == "ready") {
      content.addEventListener("DOMContentLoaded", function listener() {
        content.removeEventListener("DOMContentLoaded", listener, false);
        CreateWorker(worker);
      }, false);
    }
    else {
      CreateWorker(worker);
    }
    
  } catch(e) {
    console.exception(e);
  }
});
