/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "unstable"
};

var timers = require("../timers");
var defer = require("../lang/functional").defer;
var events = require("../event/core");
var id = require("../self").id;
var on = events.on;
var emit = events.emit;
var emitAsync = defer(emit);

// This module consist of two core functions:
//
// 1. `Content` that is loaded as a content strict and executed before
//    any other content scripts. When invoked function bootstraps a message
//    channel using custom DOM events and defines port to an add-on via `self`
//    global. In addition timer functions and console are defined too.
//
// 2. `Chrome` function that sets up host for the content script message
//    channel. It receives messages and handles built-in ones like timer
//    related or console related stuff and forward other messages to the
//    worker. Note that all messages to / from content script are delayed
//    to simulate non-blocking API that we'll eventual switch to.

// Module exports it's `uri` so that `Content` can be evaluated in a sandbox
// with a proper file `uri`. That way exceptions will have correct filenames.
exports.uri = module.uri;

// Module also exports line number for the `Content` definition this is also
// used to provide correct line number information if errors occur in the
// content script context.
// MAKE SURE TO UPDATE THIS WHEN MAKING CHANGES TO THIS FILE.
exports.line = 52;

// Content and chrome side communicate by dispatching DOM events on the
// document content script is attached to. Event types should be unique
// to avoid collision between multiple add-ons / workers. At the moment
// address is generated and includes add-on id to do that. While date is
// not guaranteed to be unique it's still fine since add-on won't be able
// to load two workers in such a short time. If that will be a problem
// this can be changed to using `GUID` or something else.
function makeAddress() { return id + "#" + Date.now().toString(32); }
exports.makeAddress = makeAddress;

function Content(address, options) {
  "use strict";

  // Function bootstraps content side of the content script before other
  // scripts are evaluated. Note that even though function is defined here
  // it's still loaded in the context of the content and there for it may not
  // access anything in the outer scope! That's also a reason for "use strict"
  // literal only this function is executed in the content side it won't be
  // in strict mode.
  //
  // Function is invoked from the content side and it passes two primitive
  // arguments unique `address` for this setup and serialized `options` that
  // will be exposed via `self.options`.

  // Given address is used to create `contentAddress` / `chromeAddress`
  // addresses. First is used for messages from chrome to content and
  // second for messages from content to chrome.
  var contentAddress = "content-script@" + address;
  var chromeAddress = "addon@" + address;

  // Chrome messages have receivers either built-in defined here or ones
  // registered through `self.port`. `receivers` is a mapping of event type
  // to associated listeners.
  var receivers = Map();

  // JSON.stringify is buggy with cross-sandbox values, it may return "{}" on
  // functions, there for custom replacer is used to avoid these issues.
  function serialize(json) {
    return JSON.stringify(json, serialize.replacer);
  }
  serialize.replacer = function replacer(_, value) {
    return typeof(value) === "function" ? undefined : value;
  }

  // Errors require special serialization since JSON based one will skip all
  // inherited & non enumerable properties which are most interesting ones
  // in case of errors.
  function SerializedError(error) {
    return {
      name: error.name,
      message: error.message,
      fileName: error.fileName,
      lineNumber: error.fileName,
      columnNumber: error.columnNumber,
      stack: error.stack
    }
  }

  // In order to receive messages from `chrome` event listener on the window
  // document is set for the content address.
  window.document.addEventListener(contentAddress, function handle(event) {
    // Event propagation is stopped and default is prevented in to make sure
    // that no other party will handle them.
    event.stopPropagation();
    event.preventDefault();

    // Event detail is parsed to extract `type` and `data` from it. `data` is
    // array of arguments that was `emit`-ed on the chrome side.
    var message = JSON.parse(event.detail);
    var type = message.type;
    var data = message.data;

    // Dispatch message to the registered listeners if there are any.
    var listeners = receivers.get(type);

    if (!listeners || !listeners.length) return;
    listeners.slice(0).forEach(function(listener) {
      try { listener.apply(listener, data); }
      // If listener throws an exception it's serialized and send back
      // as an error event. That way chrome code will either handle it
      // or it will be printed into console.
      catch (error) { send("error", SerializedError(error)); }
    });
  }, true);

  function send(type) {
    // Messages are send back to the chrome using this function, which creates
    // custom DOM event & then dispatches it on the document.
    var event = window.document.createEvent("CustomEvent");
    // Event uses unique chrome address and serialized arguments to pass
    // message to the chrome side, which will have a listener on the other
    // side.
    event.initCustomEvent(chromeAddress, false, true, serialize({
      type: type,
      data: Array.slice(arguments, 1)
    }));
    window.document.dispatchEvent(event);
  }

  function receive(type, listener) {
    // Function registers receiver for a messages of the given type.

    if (typeof(listener) !== "function")
      throw Error("Listener must be a function")
    if (!receivers.has(type)) receivers.set(type, [listener]);
    else receivers.get(type).push(listener);
  }

  function Port(send, receive) {
    // Constructor function takes `send`, `receive` functions and creates
    // a `port` object that is later exposed as `self.port`.

    function once(type, listener) {
      // Once is part of event emitter API that registers listener for a
      // single event.
      receive(type, listener)
      receive(type, function() { off(type, listener); })
    }

    function off(type, listener) {
      // Function unregisters already registered listener.
      var listeners = receivers.get(type)
      if (!listeners || !listeners.length) return;
      var index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    }

    return { emit: send, on: receive, once: once, removeListener: off }
  }

  function Console(send) {
    // Console constructor makes `console` object which basically an
    // RPC wrapper and uses given `send` to send console messages to
    // the chrome which then prints them. Console sends messages with
    // a first argument being `console.log`, `console.warn` etc.. Since
    // all functions are same with just a name difference we generate
    // console by just currying `first` argument onto `send`.

    return [
      "log", "info", "warn", "error",
      "debug", "exception",  "trace"
    ].reduce(function(console, method) {
      console[method] = send.bind(send, "console." + method);
      return console;
    }, {});
  }

  function Timers(send, receive) {
    // Constructor function creates timer functions `setTimeout`, `setInterval`,
    // etc... Timers are also RPC wrappers with except that callbacks are
    // stored locally until timeout message is received.

    // Timers use internal `id` that is incremented every time timer is set.
    // Internal `callbacks` dictionary is used to map timer `id`-s to the
    // registered callbacks which are cleaned up once timers are cleared up.
    var id = 0;
    var callbacks = Object.create(null);

    function setTimer(type) {
      // High order function takes timer `type` either "setTimeout" or
      // "setInterval" and returns function to set up timer of that type.

      return function set(callback, delay) {
        // This function represents either `setTimeout` or `setInterval` and
        // has same signature. It generates unique `id` in return same as
        // regular functions it mimics.
        id = id + 1;

        // Callback with curried parameters is registered in the callbacks
        // dictionary since only only serialized data is passed across
        // chrome - content boundaries.
        var params = Array.slice(arguments, 2);
        callbacks[id] = function() { return callback.apply(callback, params); };

        // `set-timer` message is sent to the chrome with a generated `id`
        // given `delay` and timer `type`. Chrome side will setup actual timer
        // and will send back `trigger-timer` message with `type` and `id`
        // back after requested `delay`.
        send("set-timer", { messageID: id, delay: delay, type: type });
        return id;
      }
    }

    function clearTimer(id) {
      // Clears timer with a given `id`. Deletes registered callback
      // and sends `clear-timer` message with an `id` so that chrome
      // will clear associated timer. Ignore attempts to timers that are
      // not registered.
      if (callbacks[id]) {
        delete callbacks[id];
        send("clear-timer", id);
      }
    }

    function triggerTimer(type, id) {
      // Function triggers `callback` associated with timer with a given
      // `id`.
      var callback = callbacks[id];

      // If timer type was `setTimeout` also remove a callback from
      // the callbacks dictionary.
      if (type === "setTimeout") delete callbacks[id];

      if (callback) callback();
    }

    // Setup receiver for `trigger-timer` messages.
    receive("trigger-timer", triggerTimer);

    return {
      setTimeout: setTimer("setTimeout"),
      setInterval: setTimer("setInterval"),
      clearTimeout: clearTimer,
      clearInterval: clearTimer
    }
  }

  // Create console, timers and message passing API that will be exposed
  // to a content scripts.
  var console = Console(send);
  var timers = Timers(send, receive);
  var port = Port(send, receive);

  // `self` is a legacy over `port` so in this case it just inherits from
  // it and adds extra things.
  var self = Object.create(port, {
    // Emit is set to `undefined` to shadow `port`-s `emit` to make sure
    // users don't adopt unintended methods.
    emit: { value: undefined, configurable: true, writable: true },
    // Treat `postMessage` as a legacy sugar over `message` events.
    postMessage: { value: send.bind(send, "message") },

    options: { value: options === undefined ? {} : JSON.parse(options) },
    port: { value: port }
  })

  // Inject content script API into wrapped window context.
  Object.defineProperties(window, {
    self: { value: self },
    console: { value: console },
    setTimeout: { value: timers.setTimeout },
    setInterval: { value: timers.setInterval },
    clearTimeout: { value: timers.clearTimeout },
    clearInterval: { value: timers.clearInterval },


    // Also inject legacy deprecated APIs that will print deprecation messages.
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
    onMessage: (function(onMessage) {
      return {
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
    })()
  });
}
exports.Content = Content;


function Chrome(address, window, port) {
  // Function takes same `address` as `Content`, wrapped `window` where
  // content scripts are injected and a worker `port` where messages from
  // content scripts are forwarded. Unlike `Content` this function is executed
  // in the add-on context so modules and outer scope variables are available.

  // Same content / chrome addresses are created form a given base address to
  // send / receive messages to / from content scripts.
  var contentAddress = "content-script@" + address;
  var chromeAddress = "addon@" + address;

  var receivers = Object.create(null);

  // `JSON.stringify` is buggy with cross-sandbox values, it may return "{}" on
  // functions, there for custom serialize function with own `replacer` is used
  // to omit functions.
  function serialize(json) { return JSON.stringify(json, serialize.replacer); }
  serialize.replacer = function replacer(_, value) {
    return typeof(value) === "function" ? undefined : value;
  }

  // window document event listeners on the chrome address receives messages
  // from content and passes them to receivers.
  window.document.addEventListener(chromeAddress, function handler(event) {
    // Event propagation and default is prevented as no else is supported to
    // handle these.
    event.stopPropagation();
    event.preventDefault();

    // Since parse serialized message and extract it's type.
    var message = JSON.parse(event.detail);
    var type = message.type;

    // If there is a built-in receiver for the given message type
    // pass all the message data to it as arguments. These receiver
    // are hosts for the console and timer messages.
    var receiver = receivers[type];
    if (receiver) receiver.apply(receiver, message.data);

    // If there is no receiver then emit event of this type onto
    // given worker `port`. Emit is delayed to mimic massage passing
    // across processes.
    else emitAsync.apply(emitAsync, [port, type].concat(message.data));
  }, true);

  function send(type) {
    // Function sends messages back to the content using custom DOM events
    // dispatched on document window on the unique content address. Given
    // arguments are serialized since only primitive types are passed across
    // content - chrome boundaries.
    var event = window.document.createEvent("CustomEvent");
    event.initCustomEvent(contentAddress, false, true, serialize({
      type: type,
      data: Array.slice(arguments, 1)
    }));

    window.document.dispatchEvent(event);
  }

  // Utility function to register receiver for the built-in message handlers.
  // Right now it's just sets single property but it's good to have
  // registration abstracted from storage since registration API may change.
  function receive(type, receiver) { receivers[type] = receiver; }



  // Timers requests are stored into `requests` dictionary indexed by the
  // `messageID` of the timer that is generated by the content, this way
  // content side does not needs to be aware of chrome side timer IDs.
  var requests = Object.create(null);

  // When page is hidden it goes into special non-active mode, this variable
  // is set to true when this happens, and timer functions act accordingly,
  // once `paused` all the timers are cancelled, on resume all paused timers
  // are reset.
  var paused = false;

  function triggerTimer(request) {
    // Triggers timer on the content side for the given timer request.

    var type = request.type;
    var messageID = request.messageID;

    // If timer was type of `setTimeout` requests is also deleted from
    // the dictionary.
    if (type === "setTimeout") delete requests[messageID];

    // In order to invoke callback on the content side `trigger-timer` message
    // with request type and id is send. Content side will find callback
    // associated with an `id` and will invoke it.
    send("trigger-timer", type, messageID);
  }

  function setTimer(request) {
    // Function to sets up timer for the given request. It's either
    // "setTimeout" or "setInterval" depending `request.type` value.
    var method = timers[request.type];

    // Request is stored into dictionary by an `id`, so that it could
    // be cleared if request from the content comes in.
    requests[request.messageID] = request;

    // If timers are paused just use `-1` as an id otherwise setup a timer
    // and store returned id into request.
    request.timerID = paused ? -1 :
                      method(triggerTimer, request.delay, request);
  }

  function clearTimer(messageID) {
    // Function clears timer associated with a given id. Finds associated
    // request in the dictionary. It may not be there for example if user
    // tries to clear twice.
    var request = requests[messageID];
    if (request) {
      // If request is found use `clearTimeout` or `clearInterval` depending
      // on `request.type` and calls it with a `timerID` that was created
      // during setup.
      timers["clear" + request.type.substr(3)](request.timerID);

      // Request is also removed from the dictionary.
      delete requests[messageID];
    }
  }

  function pauseTimers() {
    // Function pauses all the timers. It may be that timers are already paused
    // for example if worker is `detach`-ed after page is hidden. There for
    // return immediately if already paused.
    if (paused) return;

    // Otherwise mark timers paused and cancel each pending timer, not that
    // requests are not actually removed, that's because timers still maybe
    // resumed and in that case pending timers will be set again.
    paused = true;
    Object.keys(requests).forEach(function(messageID) {
      var request = requests[messageID];
      timers["clear" + request.type.substr(3)](request.timerID);
    });
  }

  function resumeTimers() {
    // Function resumes pending timers. Note that page may not be paused, for
    // example worker may be attached to paused page and then resumed.
    if (!paused) return;

    // Requests and timers state are reset, existing timers are considered
    // pending there for they are set again.
    var suspended = requests;
    requests = Object.create(null);
    paused = false;

    Object.keys(suspended).forEach(function(messageID) {
      setTimer(suspended[messageID]);
    });
  }

  // On page hide, timers are paused and then on page show they are resumed
  // again. Associated events are fired when the page goes in/out of bfcache.
  // https://developer.mozilla.org/En/Working_with_BFCache
  on(window, "!pagehide", pauseTimers);
  on(window, "!pageshow", resumeTimers);

  // Setup timer and console message receivers.
  receive("set-timer", setTimer);
  receive("clear-timer", clearTimer);

  // Just iterate over console methods and generate receiver for each one.
  Object.keys(console).forEach(function(method) {
    // Skip non function properties.
    if (typeof(console[method]) === "function")
      receive("console." + method, console[method].bind(console));
  });

  // All timers are cancelled once worker is detached since content sandbox
  // will be nuked. Also set `requests` to `null` in case there were any
  // pending requests.
  on(window, "!detach", function dispose() {
    pauseTimers();
    requests = null;
  });

  // All messages emitted on the window are forwarded to a content scripts.
  // Since cross process communication is emulated across chrome - content
  // all messages are forwarded via deferred send.
  var sendAsync = defer(send);
  on(window, "*", function forward(type) {
    var message = Array.slice(arguments);
    // Event types that start with `!` are treated specially, and are
    // forwarded to a content worker synchronously. Context menu API depends
    // on this feature. Also detach event is not forward since at that point
    // window is already destroyed and sandbox is already nuked
    if (type === "!detach") return;
    if (type[0] === "!") {
      message[0] = type.substr(1);
      return send.apply(send, message);
    }
    else {
      sendAsync.apply(sendAsync, message);
    }
  });

}
exports.Chrome = Chrome;
