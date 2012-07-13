/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const ContentWorker = Object.freeze({
  // TODO: Bug 727854 Use same implementation than common JS modules,
  // i.e. EventEmitter module

  /**
   * Create an EventEmitter instance.
   */
  createEventEmitter: function createEventEmitter(emit) {
    let listeners = Object.create(null);
    let eventEmitter = Object.freeze({
      emit: emit,
      on: function on(name, callback) {
        if (typeof callback !== "function")
          return this;
        if (!(name in listeners))
          listeners[name] = [];
        listeners[name].push(callback);
        return this;
      },
      once: function once(name, callback) {
        eventEmitter.on(name, function onceCallback() {
          eventEmitter.removeListener(name, onceCallback);
          callback.apply(callback, arguments);
        });
      },
      removeListener: function removeListener(name, callback) {
        if (!(name in listeners))
          return;
        let index = listeners[name].indexOf(name);
        if (index == -1)
          return;
        listeners[name].splice(index, 1);
      }
    });
    function onEvent(name) {
      if (!(name in listeners))
        return [];
      let args = Array.slice(arguments, 1);
      let results = [];
      for each (let callback in listeners[name]) {
        results.push(callback.apply(null, args));
      }
      return results;
    }
    function hasListenerFor(name) {
      if (!(name in listeners))
        return false;
      return listeners[name].length > 0;
    }
    return {
      eventEmitter: eventEmitter,
      emit: onEvent,
      hasListenerFor: hasListenerFor
    };
  },

  /**
   * Create an EventEmitter instance to communicate with chrome module
   * by passing only strings between compartments.
   * This function expects `emitToChrome` function, that allows to send
   * events to the chrome module. It returns the EventEmitter as `pipe`
   * attribute, and, `onChromeEvent` a function that allows chrome module
   * to send event into the EventEmitter.
   *
   *                  pipe.emit --> emitToChrome
   *              onChromeEvent --> callback registered through pipe.on
   */
  createPipe: function createPipe(emitToChrome) {
    function onEvent() {
      // Convert to real array
      let args = Array.slice(arguments);
      // JSON.stringify is buggy with cross-sandbox values,
      // it may return "{}" on functions. Use a replacer to match them correctly.
      function replacer(k, v) {
        return typeof v === "function" ? undefined : v;
      }
      let str = JSON.stringify(args, replacer);
      emitToChrome(str);
    }

    let { eventEmitter, emit, hasListenerFor } =
      ContentWorker.createEventEmitter(onEvent);

    return {
      pipe: eventEmitter,
      onChromeEvent: function onChromeEvent(array) {
        // We either receive a stringified array, or a real array.
        // We still allow to pass an array of objects, in WorkerSandbox.emitSync
        // in order to allow sending DOM node reference between content script
        // and modules (only used for context-menu API)
        let args = typeof array == "string" ? JSON.parse(array) : array;
        return emit.apply(null, args);
      },
      hasListenerFor: hasListenerFor
    };
  },

  injectConsole: function injectConsole(exports, pipe) {
    exports.console = Object.freeze({
      log: pipe.emit.bind(null, "console", "log"),
      info: pipe.emit.bind(null, "console", "info"),
      warn: pipe.emit.bind(null, "console", "warn"),
      error: pipe.emit.bind(null, "console", "error"),
      debug: pipe.emit.bind(null, "console", "debug"),
      exception: pipe.emit.bind(null, "console", "exception"),
      trace: pipe.emit.bind(null, "console", "trace")
    });
  },

  injectTimers: function injectTimers(exports, chromeAPI, pipe, console) {
    // wrapped functions from `'timer'` module.
    // Wrapper adds `try catch` blocks to the callbacks in order to
    // emit `error` event on a symbiont if exception is thrown in
    // the Worker global scope.
    // @see http://www.w3.org/TR/workers/#workerutils

    // List of all living timeouts/intervals
    let _timers = Object.create(null);

    // Keep a reference to original timeout functions
    let {
      setTimeout: chromeSetTimeout,
      setInterval: chromeSetInterval,
      clearTimeout: chromeClearTimeout,
      clearInterval: chromeClearInterval
    } = chromeAPI.timers;

    exports.setTimeout = function ContentScriptSetTimeout(callback, delay) {
      let params = Array.slice(arguments, 2);
      let id = chromeSetTimeout(function() {
        try {
          delete _timers[id];
          callback.apply(null, params);
        } catch(e) {
          console.exception(e);
        }
      }, delay);
      _timers[id] = "timeout";
      return id;
    };
    exports.clearTimeout = function ContentScriptClearTimeout(id) {
      delete _timers[id];
      return chromeClearTimeout(id);
    };

    exports.setInterval = function ContentScriptSetInterval(callback, delay) {
      let params = Array.slice(arguments, 2);
      let id = chromeSetInterval(function() {
        try {
          callback.apply(null, params);
        } catch(e) {
          console.exception(e);
        }
      }, delay);
      _timers[id] = "interval";
      return id;
    };
    exports.clearInterval = function ContentScriptClearInterval(id) {
      delete _timers[id];
      return chromeClearInterval(id);
    };
    pipe.on("destroy", function clearTimeouts() {
      // Unregister all setTimeout/setInterval on page unload
      for (let id in _timers) {
        let kind = _timers[id];
        if (kind == "timeout")
          chromeClearTimeout(id);
        else
          chromeClearInterval(id);
      }
    });
  },

  injectMessageAPI: function injectMessageAPI(exports, pipe) {

    let { eventEmitter: port, emit : portEmit } =
      ContentWorker.createEventEmitter(pipe.emit.bind(null, "event"));
    pipe.on("event", portEmit);

    let self = {
      port: port,
      postMessage: pipe.emit.bind(null, "message"),
      on: pipe.on.bind(null),
      once: pipe.once.bind(null),
      removeListener: pipe.removeListener.bind(null),
    };
    Object.defineProperty(exports, "self", {
      value: self
    });

    // Deprecated use of on/postMessage from globals
    exports.postMessage = function deprecatedPostMessage() {
      console.warn("The global `postMessage()` function in content " +
                   "scripts is deprecated in favor of the " +
                   "`self.postMessage()` function, which works the same. " +
                   "Replace calls to `postMessage()` with calls to " +
                   "`self.postMessage()`." +
                   "For more info on `self.on`, see " +
                   "<https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/addon-development/web-content.html>.");
      return self.postMessage.apply(null, arguments);
    };
    exports.on = function deprecatedOn() {
      console.warn("The global `on()` function in content scripts is " +
                   "deprecated in favor of the `self.on()` function, " +
                   "which works the same. Replace calls to `on()` with " +
                   "calls to `self.on()`" +
                   "For more info on `self.on`, see " +
                   "<https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/addon-development/web-content.html>.");
      return self.on.apply(null, arguments);
    };

    // Deprecated use of `onMessage` from globals
    let onMessage = null;
    Object.defineProperty(exports, "onMessage", {
      get: function () onMessage,
      set: function (v) {
        if (onMessage)
          self.removeListener("message", onMessage);
        console.warn("The global `onMessage` function in content scripts " +
                     "is deprecated in favor of the `self.on()` function. " +
                     "Replace `onMessage = function (data){}` definitions " +
                     "with calls to `self.on('message', function (data){})`. " +
                     "For more info on `self.on`, see " +
                     "<https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/addon-development/web-content.html>.");
        onMessage = v;
        if (typeof onMessage == "function")
          self.on("message", onMessage);
      }
    });
  },

  injectOptions: function (exports, options) {
    Object.defineProperty( exports.self, "options", { value: JSON.parse( options ) });
  },

  inject: function (exports, chromeAPI, emitToChrome, options) {
    let { pipe, onChromeEvent, hasListenerFor } =
      ContentWorker.createPipe(emitToChrome);

    ContentWorker.injectConsole(exports, pipe);
    ContentWorker.injectTimers(exports, chromeAPI, pipe, exports.console);
    ContentWorker.injectMessageAPI(exports, pipe);
    if ( options !== undefined ) {
      ContentWorker.injectOptions(exports, options);
    }

    Object.freeze( exports.self );

    return {
      emitToContent: onChromeEvent,
      hasListenerFor: hasListenerFor
    };
  }
});
