/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { Pane } = require("dev/pane");

const pane = new Pane({
  label: "Example",
  tooltip: "My example pane",
  icon: "./favicon.ico",
  url: "./index.html",
  onMessage: function(event) {
    console.log("Received message from pane", event, event.source);

    if (event.data === "ping")
      event.source.postMessage("pong", event.origin);


    event.inspectTarget.postMessage(event.data, event.inspectTarget.location.origin);
  }
});


require("sdk/tabs").open(require("sdk/self").data.url("./demo.html"));
