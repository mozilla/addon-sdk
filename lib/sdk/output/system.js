/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Cc, Ci, Cr } = require("chrome");
const { Input, start, stop, receive, outputs } = require("../input/signal");
const { id: addonID } = require("../self");
const { notifyObservers } = Cc['@mozilla.org/observer-service;1'].
                             getService(Ci.nsIObserverService);

const NOT_AN_INPUT = "OutputPort can be used only for sending messages";


const OutputPort = function({id, topic}) {
  this.id = id || topic;
  this.topic = topic || "sdk:" + addonID + ":" + id;
};
OutputPort.prototype = new Input();
OutputPort.constructor = OutputPort;
OutputPort.prototype[start] = _ => { throw TypeError(NOT_AN_INPUT); };
OutputPort.prototype[stop] = _ => { throw TypeError(NOT_AN_INPUT); };
OutputPort.prototype[receive] = ({topic}, message) => {
  const type = typeof(message);
  const supported = message === null ||
                    type === "object" ||
                    type === "function";

  if (!supported)
    throw new TypeError("Unsupproted message type: `" + type + "`");

  // Normalize `message` to create a valid observer notification `subject`.
  // If `message` is `null`, implements `nsISupports` interface or already
  // represents wrapped JS object use it as is. Otherwise create a wrapped
  // object so that observers could receive it.
  const subject = message === null ? null :
                  message instanceof Ci.nsISupports ? message :
                  message.wrappedJSObject ? message :
                  {wrappedJSObject: message};

  notifyObservers(subject, topic, null);
};

exports.OutputPort = OutputPort;
