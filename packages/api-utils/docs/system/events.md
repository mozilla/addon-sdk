<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

Module provides core (low level) API for working with the application
observer service, also known as
[nsIObserverService](https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIObserverService).
You can find a list of events dispatched by firefox codebase
[here](https://developer.mozilla.org/en-US/docs/Observer_Notifications).

## Example

    var events = require("api-utils/system/events");
    var { Ci } = require("chrome");

    events.on("http-on-modify-request", function (event) {
      var channel = event.subject.QueryInterface(Ci.nsIHttpChannel);
      channel.setRequestHeader("User-Agent", "MyBrowser/1.0", false);
    });

<api name="emit">
@function
  Send an event to observer service

@param topic {string}
  The topic name for this event.
@param [event] {object}
  An optional object object with `data` and `subject` attributes.
  `data` refers to a string that you would like to pass through this event.
  `subject` should refer to the actual actor of this event.
</api>

<api name="on">
@function
  Listen to events of a given topic

@param topic {string}
  The topic name to watch.
@param listener {function}
  Function that will be called when an event is fired, with a single `event`
  object as argument. This object has three attributes:
  
    * topic: the event name
    * subject: the event subject object
    * data: the event data string

@param strong {boolean}
  Should we keep a strong of weak reference to the listener method.
</api>

<api name="on">
@function
  Listen only once to a particular event topic

@param topic {string}
  The topic name to watch.
@param listener {function}
  Function that will be called when an event is fired.
@param strong {boolean}
  Should we keep a strong of weak reference to the listener method.
</api>

<api name="off">
@function
  Stop listening for an event

@param topic {string}
  The topic name to unsubscribe to.
@param listener {function}
  The function we registered to listen for events.
</api>
