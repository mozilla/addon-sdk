/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { Pane } = require("dev/pane");

const pane = new Pane({
  label: "Actor REPL",
  tooltip: "Firefox debugging protocol REPL",
  icon: "./robot.png",
  url: "./index.html",
  onMessage: event => {
    const { id, packet } = event.data;
    event.inspectTarget._target.client.request(packet, response => {
      event.source.postMessage({ id: id, packet: response }, event.origin)
    });
  }
});
