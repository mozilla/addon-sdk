/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {protocol, events} = require("./protocol");
const { on, once, off, emit } = events;

const { method, Arg, Option, RetVal } = protocol;

const { ContentObserver } = require("./content-observer");

// NOTE: DevtoolAddonTargetActor is a prototype of an RDP actor used to
// serve addon-sdk devtools API
// (it's based on the WebGLActor)

/**
 * TBD
 */
let DevtoolAddonTargetActor = protocol.ActorClass({
  typeName: "devtool-addon-target",

  events: {
    "target-tab-attached": {
      type: "targetTabAttached"
    },
    "content-script-message": {
      type: "contentScriptMessage",
      data: Arg(0, "json")
    }
  },

  initialize: function(conn, targetActor) {
    protocol.Actor.prototype.initialize.call(this, conn);
    this.targetActor = targetActor;
    this.targetWorker = null;
    this._onGlobalCreated = this._onGlobalCreated.bind(this);
    this._onGlobalDestroyed = this._onGlobalDestroyed.bind(this);
  },
  destroy: function(conn) {
    protocol.Actor.prototype.destroy.call(this, conn);
    this.finalize();
  },

  /**
   * TBD
   */
  setupInstrumentation: method(function(contentScriptCode,
                                        injectJavascriptCode, injectJavascriptURL,
                                        reload) {
    console.log("SETUP CALLED", arguments);
    if (this._initialized) {
      return;
    }

    this.contentScriptCode = contentScriptCode;
    this.injectJavascriptCode = injectJavascriptCode;
    this.injectJavascriptURL = injectJavascriptURL;

    this._consoleActor = new (this.targetActor._extraActors.consoleActor)(this.conn, this);
    this._contentObserver = new ContentObserver(this.targetActor);
    on(this._contentObserver, "global-created", this._onGlobalCreated.bind(this));
    on(this._contentObserver, "global-destroyed", this._onGlobalDestroyed.bind(this));

    if (reload) {
      this.targetActor.window.location.reload();
    } else {
      this._onGlobalCreated(this.targetActor.window);
    }

    this._initialized = true;
    console.log("SETUP DONE");
  }, {
    request: {
      contentScriptCode: Arg(0, "string"),
      injectJavascriptCode: Arg(1, "string"),
      injectJavascriptURL: Arg(2, "string"),
      reload: Arg(3, "boolean")
    },
    oneway: true
  }),

  postMessage: method(function(data, origin) {
    this.targetActor.window.postMessage(data, origin);
  }, {
    request: { data: Arg(0, "string"), origin: Arg(1, "string") },
    oneway: true
  }),

  postMessageToContentScript: method(function(data, origin) {
    if (this.targetWorker) {
      this.targetWorker.postMessage(data);
    }
  }, {
    request: { data: Arg(0, "json"), origin: Arg(1, "string") },
    oneway: true
  }),

  /**
   * Stops listening for document global changes and puts this actor
   * to hibernation. This method is called automatically just before the
   * actor is destroyed.
   */
  finalize: method(function() {
    if (!this._initialized) {
      return;
    }

    // TODO: destroy worker
    this._onGlobalDestroyed();

    this._initialized = false;
    this._consoleActor = null;
    this._contentObserver.stopListening();
    off(this._contentObserver, "global-created", this._onGlobalCreated);
    off(this._contentObserver, "global-destroyed", this._onGlobalDestroyed);
  }, {
   oneway: true
  }),

  _onGlobalCreated: function(window) {
    // TODO: inject devtool addon setup code
    // create worker
    console.log("ON GLOBAL CREATED", this);
    var self = this;

    if (this.contentScriptCode) {
      var { Worker } = require("sdk/content/worker");
      this.targetWorker = Worker({
        window: this.targetActor.window,
        contentScript: this.contentScriptCode,
        onAttach: function() {
          events.emit(self, "target-tab-attached");
        },
        onMessage: function(data) {
          events.emit(self, "content-script-message", data);
        }
      });
    }

    if (this.injectJavascriptCode) {
      var res = this._consoleActor.onEvaluateJS({
        bindObjectActor: null,
        frameActor: null,
        url: this.injectJavascriptURL,
        text: this.injectJavascriptCode
      });
    }

    console.log("WEBCONSOLE RESULT", res);
  },
  _onGlobalDestroyed: function(id) {
    if (this.targetWorker) {
      this.targetWorker.destroy();
      this.targetWorker = null;
    }
  }
});

/**
 * The corresponding Front object for the WebGLActor.
 */
exports.DevtoolAddonTargetFront = protocol.FrontClass(DevtoolAddonTargetActor, {
  initialize: function(client, { devtoolAddonTargetActor }) {
    protocol.Front.prototype.initialize.call(this, client, { actor: devtoolAddonTargetActor });
    client.addActorPool(this);
    this.manage(this);
  }
});

// register/unregister custom RDP actor
const DebuggerServer = require('./debugger-server').DebuggerServer;
DebuggerServer.addTabActor(DevtoolAddonTargetActor, "devtoolAddonTargetActor");
require('sdk/system/unload').when(function() {
  DebuggerServer.removeTabActor(DevtoolAddonTargetActor);
});
