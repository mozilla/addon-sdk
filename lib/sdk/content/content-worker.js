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
        let index = listeners[name].indexOf(callback);
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
   * events to the chrome module. It returns the EventEmitter as `port`
   * attribute, and, `onChromeEvent` a function that allows chrome module
   * to send event into the EventEmitter.
   *
   *                  port.emit --> emitToChrome
   *              onChromeEvent --> callback registered through port.on
   */
  createPort: function createPort(emitToChrome) {
    // Function that serializes event emitted by content and forward serialized
    // message to an add-on chrome.
    function onContentEvent() {
      // Convert to real array
      let event = Array.slice(arguments);
      // JSON.stringify is buggy with cross-sandbox values,
      // it may return "{}" on functions. Use a replacer to match them correctly.
      function replacer(_, value) {
        return typeof value === "function" ? undefined : value;
      }
      let message = JSON.stringify(event, replacer);
      emitToChrome(message);
    }

    let { eventEmitter, emit, hasListenerFor } =
      ContentWorker.createEventEmitter(onContentEvent);

    return {
      port: eventEmitter,
      onChromeEvent: function onChromeEvent(array) {
        // We either receive a stringified array, or a real array.
        // We still allow to pass an array of objects, in WorkerSandbox.emitSync
        // in order to allow sending DOM node reference between content script
        // and modules (only used for context-menu API)
        let args = typeof array == "string" ? JSON.parse(array) : array;
        return emit.apply(emit, args);
      },
      hasListenerFor: hasListenerFor
    };
  },

  injectConsole: function injectConsole(exports, port) {
    exports.console = Object.freeze({
      log: port.emit.bind(port, "console", "log"),
      info: port.emit.bind(port, "console", "info"),
      warn: port.emit.bind(port, "console", "warn"),
      error: port.emit.bind(port, "console", "error"),
      debug: port.emit.bind(port, "console", "debug"),
      exception: port.emit.bind(port, "console", "exception"),
      trace: port.emit.bind(port, "console", "trace")
    });
  },

  injectTimers: function injectTimers(exports, chromeAPI, port, console) {
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

    function registerTimer(timer) {
      let registerMethod = null;
      if (timer.kind == "timeout")
        registerMethod = chromeSetTimeout;
      else if (timer.kind == "interval")
        registerMethod = chromeSetInterval;
      else
        throw new Error("Unknown timer kind: " + timer.kind);
      let id = registerMethod(onFire, timer.delay);
      function onFire() {
        try {
          if (timer.kind == "timeout")
            delete _timers[id];
          timer.fun.apply(null, timer.args);
        } catch(e) {
          console.exception(e);
        }
      }
      _timers[id] = timer;
      return id;
    }

    function unregisterTimer(id) {
      if (!(id in _timers))
        return;
      let { kind } = _timers[id];
      delete _timers[id];
      if (kind == "timeout")
        chromeClearTimeout(id);
      else if (kind == "interval")
        chromeClearInterval(id);
      else
        throw new Error("Unknown timer kind: " + kind);
    }

    function disableAllTimers() {
      Object.keys(_timers).forEach(unregisterTimer);
    }

    exports.setTimeout = function ContentScriptSetTimeout(callback, delay) {
      return registerTimer({
        kind: "timeout",
        fun: callback,
        delay: delay,
        args: Array.slice(arguments, 2)
      });
    };
    exports.clearTimeout = function ContentScriptClearTimeout(id) {
      unregisterTimer(id);
    };

    exports.setInterval = function ContentScriptSetInterval(callback, delay) {
      return registerTimer({
        kind: "interval",
        fun: callback,
        delay: delay,
        args: Array.slice(arguments, 2)
      });
    };
    exports.clearInterval = function ContentScriptClearInterval(id) {
      unregisterTimer(id);
    };

    // On page-hide, save a list of all existing timers before disabling them,
    // in order to be able to restore them on page-show.
    // These events are fired when the page goes in/out of bfcache.
    // https://developer.mozilla.org/En/Working_with_BFCache
    let frozenTimers = [];
    port.on("pageshow", function onPageShow() {
      frozenTimers.forEach(registerTimer);
    });
    port.on("pagehide", function onPageHide() {
      frozenTimers = [];
      for (let id in _timers) frozenTimers.push(_timers[id]);
      disableAllTimers();
      // Some other pagehide listeners may register some timers that won't be
      // frozen as this particular pagehide listener is called first.
      // So freeze these timers on next cycle.
      chromeSetTimeout(function () {
        for (let id in _timers)
          frozenTimers.push(_timers[id]);
        disableAllTimers();
      }, 0);
    });

    // Unregister all timers when the page is destroyed
    // (i.e. when it is removed from bfcache)
    port.on("detach", function clearTimeouts() {
      disableAllTimers();
      _timers = {};
      frozenTimers = [];
    });
  },

  injectMessageAPI: function injectMessageAPI(exports, port) {
    let self = {
      port: port,
      postMessage: port.emit.bind(port, "message"),
      on: port.on,
      once: port.once,
      removeListener: port.removeListener
    };
    Object.defineProperty(exports, "self", { value: self });

    // Deprecated use of on/postMessage from globals
    exports.postMessage = function deprecatedPostMessage() {
      console.error("DEPRECATED: The global `postMessage()` function in " +
                    "content scripts is deprecated in favor of the " +
                    "`self.postMessage()` function, which works the same. " +
                    "Replace calls to `postMessage()` with calls to " +
                    "`self.postMessage()`." +
                    "For more info on `self.on`, see " +
                    "<https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/addon-development/web-content.html>.");
      return self.postMessage.apply(null, arguments);
    };
    exports.on = function deprecatedOn() {
      console.error("DEPRECATED: The global `on()` function in content " +
                    "scripts is deprecated in favor of the `self.on()` " +
                    "function, which works the same. Replace calls to `on()` " +
                    "with calls to `self.on()`" +
                    "For more info on `self.on`, see " +
                    "<https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/addon-development/web-content.html>.");
      return self.on.apply(null, arguments);
    };

    // Deprecated use of `onMessage` from globals
    let onMessage = null;
    Object.defineProperty(exports, "onMessage", {
      get: function() onMessage,
      set: function(value) {
        if (onMessage) self.removeListener("message", onMessage);
        console.error("DEPRECATED: The global `onMessage` function in content" +
                      "scripts is deprecated in favor of the `self.on()` " +
                      "function. Replace `onMessage = function (data){}` " +
                      "definitions with calls to `self.on('message', " +
                      "function (data){})`. " +
                      "For more info on `self.on`, see " +
                      "<https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/addon-development/web-content.html>.");
        if (typeof(onMessage) === "function") {
          onMessage = value;
          self.on("message", onMessage);
        } else {
          onMessage = null;
        }
      }
    });
  },

  injectOptions: function (exports, options) {
    Object.defineProperty(exports.self, "options", {
      value: options ? JSON.parse(options) : {}
    });
  },

  inject: function (content, api, options, emit) {
    let { port, onChromeEvent, hasListenerFor } = ContentWorker.createPort(emit);

    ContentWorker.injectConsole(content, port);
    ContentWorker.injectTimers(content, api, port, content.console);
    ContentWorker.injectMessageAPI(content, port);
    ContentWorker.injectOptions(content, options);

    Object.freeze(content.self);

    return {
      emitToContent: onChromeEvent,
      hasListenerFor: hasListenerFor
    };
  }
});
