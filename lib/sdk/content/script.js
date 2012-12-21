/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var timers = require("../timers");
var defer = require("../lang/functional").defer;
var events = require("../event/core");
var id = require("../self").id;
var on = events.on;
var emit = events.emit;
var emitAsync = defer(emit);

exports.uri = module.uri;

function makeAddress() {
  "use strict";
  return id + "#" + Date.now().toString(32);
}
exports.makeAddress = makeAddress;

function Content(address, options) {
  "use strict";

  var receivers = Map();
  var contentAddress = "content-script@" + address;
  var chromeAddress = "addon@" + address;

  function serialize(json) {
    // JSON.stringify is buggy with cross-sandbox values,
    // it may return "{}" on functions. Use a replacer to match them correctly.
    return JSON.stringify(json, serialize.replacer);
  }
  serialize.replacer = function replacer(_, value) {
    return typeof(value) === "function" ? undefined : value;
  }

  function serializeError(error) {
    return {
      name: error.name,
      message: error.message,
      fileName: error.fileName,
      lineNumber: error.fileName,
      columnNumber: error.columnNumber,
      stack: error.stack
    }
  }

  window.document.addEventListener(contentAddress, function(event) {
    event.stopPropagation();
    event.preventDefault();
    var message = JSON.parse(event.detail);
    var type = message.type;
    var data = message.data;

    var listeners = receivers.get(type);
    if (!listeners || !listeners.length) return;
    listeners.slice(0).forEach(function(listener) {
      try {
        listener.apply(listener, data);
      } catch (error) {
        send("error", serializeError(error))
      }
    });
  }, true);

  function send(type) {
    var event = window.document.createEvent("CustomEvent");
    event.initCustomEvent(chromeAddress, false, true, serialize({
      type: type,
      data: Array.slice(arguments, 1)
    }));
    window.document.dispatchEvent(event);
  }

  function receive(type, listener) {
    if (typeof(listener) !== "function")
      throw Error("Listener must be a function")
    if (!receivers.has(type)) receivers.set(type, [listener]);
    else receivers.get(type).push(listener);
  }

  function Port(send, receive) {
    function once(type, listener) {
      receive(type, listener)
      receive(type, function() { off(type, listener); })
    }

    function off(type, listener) {
      var listeners = receivers.get(type)
      if (!listeners || !listeners.length) return;
      var index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    }

    return { emit: send, on: receive, once: once, removeListener: off }
  }

  function Console(send) {
    return [
      "log", "info", "warn", "error",
      "debug", "exception",  "trace"
    ].reduce(function(console, method) {
      console[method] = send.bind(send, "console." + method);
      return console;
    }, {});
  }

  function Timers(send, receive) {
    var paused = false;
    var timers = Object.create(null);
    var index = 0;

    function setTimer(type) {
      return function set(callback, ms) {
        index = index + 1;
        timers[index] = {
          type: type,
          callback: callback,
          ms: ms,
          params: Array.slice(arguments, 2)
        }
        send(type, index, ms);
        return index;
      }
    }

    function clearTimer(type) {
      return function clear(id) {
        if (timers[id]) {
          delete timers[id];
          send(type, id);
        }
      }
    }

    function fireTimer(id) {
      if (paused) return;
      var timer = timers[id];
      if (!timer) return;

      try {
        timer.callback.apply(null, timer.params);
      } catch(error) {
        send("error", serializeError(error));
      } finally {
        if (timer.type === "setTimeout") delete timers[id];
      }
    }

    function reset() {
      index = 0;
      timers = Object.create(null);
    }

    function pause() {
      paused = true;
      Object.keys(timers).forEach(function(id) {
        var timer = timers[id];
        var clearTimer = timer.type === "setTimeout" ? clearTimeout :
                         clearInterval;
        clearTimer(id);
      });
    }

    function resume() {
      var suspended = timers;
      paused = false;
      reset();
      Object.keys(suspended).forEach(function(id) {
        var timer = suspended[id];
        var args = [timer.callback, timer.ms].concat(timer.params);
        var setTimer = timer.type === "setTimeout" ? setTimeout :
                       setInterval;
        setTimer.apply(null, args);
      })
    }

    function dispose() {
      pause();
      reset();
    }

    receive("timeout", fireTimer);
    receive("interval", fireTimer);
    receive("pagehide", pause);
    receive("pageshow", resume);
    receive("detach", dispose);

    return {
      setTimeout: setTimer("setTimeout"),
      setInterval: setTimer("setInterval"),
      clearTimeout: clearTimer("clearTimeout"),
      clearInterval: clearTimer("clearTimeout")
    }
  }

  var timers = Timers(send, receive);
  var port = Port(send, receive);
  var console = Console(send);

  var self = Object.create(port, {
    options: { value: options ? JSON.parse(options) : {} },
    postMessage: { value: send.bind(send, "message") },
    port: { value: port }
  })

  // Deprecated use of `onMessage` from globals
  var onMessage = null;

  Object.defineProperties(window, {
    self: { value: self },
    console: { value: console },
    setTimeout: { value: timers.setTimeout },
    setInterval: { value: timers.setInterval },
    clearTimeout: { value: timers.clearTimeout },
    clearInterval: { value: timers.clearInterval },
    postMessage: {
      configurable: true, writable: true,
      value: function deprecatedPostMessage() {
        console.error("DEPRECATED: The global `postMessage()` function in " +
                      "content scripts is deprecated in favor of the " +
                      "`self.postMessage()` function, which works the same. " +
                      "Replace calls to `postMessage()` with calls to " +
                      "`self.postMessage()`." +
                      "For more info on `self.on`, see " +
                      "<https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/addon-development/web-content.html>.");
        return self.postMessage.apply(null, arguments);
      }
    },
    on: {
      configurable: true, writable: true,
      value: function deprecatedOn() {
        console.error("DEPRECATED: The global `on()` function in content " +
                      "scripts is deprecated in favor of the `self.on()` " +
                      "function, which works the same. Replace calls to `on()` " +
                      "with calls to `self.on()`" +
                      "For more info on `self.on`, see " +
                      "<https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/addon-development/web-content.html>.");
        return self.on.apply(null, arguments);
      }
    },
    onMessage: {
      configurable: true,
      get: function() { return onMessage },
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
    }
  });
}
exports.Content = Content;

function Chrome(address, window, port) {
  "use strict";

  var receivers = Object.create(null);
  var contentAddress = "content-script@" + address;
  var chromeAddress = "addon@" + address;

  function serialize(json) {
    // JSON.stringify is buggy with cross-sandbox values,
    // it may return "{}" on functions. Use a replacer to match them correctly.
    return JSON.stringify(json, serialize.replacer);
  }
  serialize.replacer = function replacer(_, value) {
    return typeof(value) === "function" ? undefined : value;
  }

  window.document.addEventListener(chromeAddress, function receive(event) {
    event.stopPropagation();
    event.preventDefault();
    var message = JSON.parse(event.detail);

    var type = message.type;
    var receiver = receivers[type];
    if (receiver) receiver.apply(receiver, message.data);
    else emitAsync.apply(emitAsync, [port, type].concat(message.data));
  }, true);

  function send(type) {
    var event = window.document.createEvent("CustomEvent");
    event.initCustomEvent(contentAddress, false, true, serialize({
      type: type,
      data: Array.slice(arguments, 1)
    }));
    window.document.dispatchEvent(event);
  }

  function receive(type, receiver) { receivers[type] = receiver }


  var ids = Object.create(null);
  function setTimer(name) {
    var type = name.substr(3).toLowerCase();
    var remove = type === "setTimeout"
    return function timer(id, ms) {
      ids[id] = timers[name](send, ms, type, id);
      if (remove) delete ids[id];
    }
  }

  function clearTimer(name, id) {
    return function clear() {
      timers[name](ids[id]);
      delete ids[id]
    }
  }

  // Forward all messages on the message emitted on window to the
  // content scripts.
  var sendAsync = defer(send);
  on(window, "*", function forward(type) {
    var message = Array.slice(arguments);
    // Event types that start with `!` are treated specially, and are
    // forwarded to a content worker synchronously. Unfortunately sync
    // dispatch is necessary as context-menu depends on this.
    if (type[0] === "!") {
      message[0] = type.substr(1);
      return send.apply(send, message);
    }
    else {
      sendAsync.apply(sendAsync, message);
    }
  });

  receive("setTimeout", setTimer("setTimeout"));
  receive("setInterval", setTimer("setInterval"));
  receive("clearTimeout", clearTimer("clearTimer"));
  receive("clearInterval", clearTimer("clearInterval"));

  Object.keys(console).forEach(function(method) {
    if (typeof(console[method]) === "function")
      receive("console." + method, console[method].bind(console));
  });
}
exports.Chrome = Chrome;
