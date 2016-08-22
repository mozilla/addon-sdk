/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { Pane } = require("dev/pane");

const pane = new Pane({
  label: "Example",
  tooltip: "My example pane",
  icon: "./favicon.ico",
  url: "./index.html",
  onAttach: function(target) {
    console.log("DEVTOOL TARGET", target.isApp, target.isLocal, target.isRemote);

    // subcribe target tab worker attached event
    target.on("target-tab-attached", function () {
      console.log("TARGET TAB ATTACHED", arguments);
      target.postMessageToContentScript({prova: 123}, "*");
    });

    // subcribe received messages from target tab worker
    target.on("content-script-message", function () {
      console.log("CONTENT SCRIPT MESSAGE", arguments);
    });

    // NOTE: configure instrumentation on attach
    target.setupInstrumentation({
      // content script code
      // OR contentScriptURL: "content-script.js",
      contentScriptCode: "self.postMessage({ name: 'prova' });" +
        "self.on('message', (data) => console.log('message receive', data));" +
        "console.log('CONTENT SCRIPT LOADED');",
      // javascript instrumentation code to inject in the target tab
      // OR injectJavascriptURL: "content-script.js",
      injectJavascriptCode: "console.log('CODE INJECTED ON PAGE');",
      // optionally reload the target tab on setup
      reload: false
    });
  },
  onMessage: function(event) {
    console.log("Received message from pane", event, event.source);

    if (event.data === "ping")
      event.source.postMessage("pong", event.origin);


    event.inspectTarget.postMessage(event.data, event.inspectTarget.location.origin);
  }
});


require("sdk/tabs").open(require("sdk/self").data.url("./demo.html"));
