/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";
(function({content, sendSyncMessage, addMessageListener, sendAsyncMessage}) {

const ports = new Map();

const makePort = id => {
  const {port1, port2} = new content.MessageChannel();
  ports.set(id, port1);
  port1.onmessage = event => {
    sendAsyncMessage("sdk/port/message", {
      id: id,
      message: event.data
    });
  };

  return port2;
};

const onPortMessage = ({data}) => {
  const port = ports.get(data.id);
  if (port)
    port.postMessage(data.message);
};

const onEvent = event =>
  sendSyncMessage("sdk/event/" + event.type,
                  { type: event.type,
                    data: event.data });

const onHostEvent = (message) => {
  const {type, data, origin, bubbles, cancelable, ports} = message.data;

  const event = new content.MessageEvent(type, {
    bubbles: bubbles,
    cancelable: cancelable,
    data: data,
    origin: origin,
    target: content,
    ports: ports.map(makePort)
  });
  content.dispatchEvent(event);
};

const onReady = event => {
  ports.clear();
};

addMessageListener("sdk/event/*", onHostEvent);
addMessageListener("sdk/port/message", onPortMessage);
addEventListener("DOMContentLoaded", onEvent);
addEventListener("DOMContentLoaded", onReady);
addEventListener("load", onEvent);

})(this);
