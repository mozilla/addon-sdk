/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Loader } = require('./helpers');

function createMessageManager() {
  let loader = Loader(module);
  let { MessageManager } = loader.require("api-utils/message-manager");
  let frame = loader.sandbox("api-utils/message-manager").frame;

  return [new MessageManager, frame];
}


exports["test MessageManager addMessageListener"] =
  function(assert) {
    let [mm, frame] = createMessageManager();
    let remoteFrame = frame(mm).receiver;

    let listeners = frame(mm).listeners;
    let remoteListeners = frame(remoteFrame).listeners;

    let topic = "message-topic";

    let listener = function () {};

    assert.equal(topic in listeners, false,
                  "No listeners for MessageManager");
    assert.equal(topic in remoteListeners, false,
                  "No listeners for Remote Frame");

    mm.addMessageListener(topic, listener);

    assert.deepEqual(listeners[topic], [listener],
                  "Listener is added properly");
    assert.equal(topic in remoteListeners, false,
                  "No listeners for Remote Frame");
  }


exports["test MessageManager addMessageListener with duplicates"] =
  function(assert) {
    let [mm, frame] = createMessageManager();
    let topic = "message-topic";
    let listeners = frame(mm).listeners;

    let listener = function () {};

    mm.addMessageListener(topic, listener);
    mm.addMessageListener(topic, listener);
    mm.addMessageListener(topic, listener);

    assert.deepEqual(listeners[topic], [listener],
                  "Same listener is added only once");
  }


exports["test MessageManager addMessageListener exceptions"] =
  function(assert) {
    const BAD_LISTENER = "The event listener must be a function.";

    let [mm, frame] = createMessageManager();
    let listeners = frame(mm).listeners;
    let topic = "message-topic";

    assert.throws(
      function() mm.addMessageListener(),
      BAD_LISTENER
    );

    assert.throws(
      function() mm.addMessageListener(topic),
      BAD_LISTENER
    );

    assert.throws(
      function() mm.addMessageListener(topic, "something-else"),
      BAD_LISTENER
    );
  }

exports["test MessageManager removeMessageListener"] =
  function(assert) {
    let [mm, frame] = createMessageManager();
    let topic = "message-topic";
    let listeners = frame(mm).listeners;

    let listenerA = function () {};
    let listenerB = function () {};
    let listenerC = function () {};

    mm.removeMessageListener(topic, listenerA);

    assert.deepEqual(listeners, {},
                      "No listeners yet");

    mm.addMessageListener(topic, listenerA);
    mm.addMessageListener(topic, listenerB);
    mm.addMessageListener(topic, listenerC);

    mm.removeMessageListener(topic, listenerB);

    assert.deepEqual(listeners[topic], [listenerA, listenerC],
                      "Listener is removed properly");
  }


exports["test MessageManager loadFrameScript with data URL"] =
  function(assert) {
    let [mm, frame] = createMessageManager();

    let remoteFrame = frame(mm).receiver;

    assert.equal("TEST_VALUE" in remoteFrame, false,
                "TEST_VALUE is not defined in Remote Frame");

    mm.loadFrameScript("data:, const TEST_VALUE = 77;", true);

    assert.equal(remoteFrame.TEST_VALUE, 77,
                "TEST_VALUE is properly defined in Remote Frame");
  }


exports["test MessageManager loadFrameScript with a File"] =
  function(assert) {
    let [mm, frame] = createMessageManager();

    let remoteFrame = frame(mm).receiver;

    assert.equal("TEST_VALUE" in remoteFrame, false,
                "TEST_VALUE is not defined in Remote Frame");

    mm.loadFrameScript(require("self").data.url("test-message-manager.js"), true);

    assert.equal(remoteFrame.TEST_VALUE, 11,
                "TEST_VALUE is properly defined in Remote Frame");
  }

exports["test MessageManager loadFrameScript exception"] =
  function(assert) {
    let [mm, frame] = createMessageManager();

    let remoteFrame = frame(mm).receiver;


    assert.throws(
      function() mm.loadFrameScript("data:, const TEST_VALUE = 77;"),
      "Not enough arguments"
    );

  }

exports["test Remote Frame addMessageListener"] =
  function(assert) {
    let [mm, frame] = createMessageManager();
    let remoteFrame = frame(mm).receiver;

    let listeners = frame(remoteFrame).listeners;
    let managerListeners = frame(mm).listeners;

    let topic = "message-topic";

    let listener = function () {};

    assert.equal(topic in listeners, false,
                  "No listeners for Remote Frame");
    assert.equal(topic in managerListeners, false,
                  "No listeners for MessageManager");

    remoteFrame.addMessageListener(topic, listener);

    assert.deepEqual(listeners[topic], [listener],
                  "Listener is added properly");
    assert.equal(topic in managerListeners, false,
                  "No listeners for MessageManager");
  }


exports["test Remote Frame addMessageListener with duplicates"] =
  function(assert) {
    let [mm, frame] = createMessageManager();

    let remoteFrame = frame(mm).receiver;
    let listeners = frame(remoteFrame).listeners;
    let topic = "message-topic";

    let listener = function () {};

    assert.equal(topic in listeners, false,
                  "No listeners in Remote Frame");

    remoteFrame.addMessageListener(topic, listener);
    remoteFrame.addMessageListener(topic, listener);
    remoteFrame.addMessageListener(topic, listener);

    assert.deepEqual(listeners[topic], [listener],
                  "Listener is added properly");
  }


exports["test Remote Frame addMessageListener exceptions"] =
  function(assert) {
    const BAD_LISTENER = "The event listener must be a function.";

    let [mm, frame] = createMessageManager();
    let remoteFrame = frame(mm).receiver;
    let listeners = frame(remoteFrame).listeners;
    let topic = "message-topic";

    assert.throws(
      function() mm.addMessageListener(),
      BAD_LISTENER
    );

    assert.throws(
      function() mm.addMessageListener(topic),
      BAD_LISTENER
    );

    assert.throws(
      function() mm.addMessageListener(topic, "something-else"),
      BAD_LISTENER
    );
  }


exports["test Remote Frame removeMessageListener"] =
  function(assert) {
    let [mm, frame] = createMessageManager();

    let remoteFrame = frame(mm).receiver;
    let listeners = frame(remoteFrame).listeners;

    let topic = "message-topic";

    let listenerA = function () {};
    let listenerB = function () {};
    let listenerC = function () {};

    remoteFrame.removeMessageListener(topic, listenerA);

    assert.deepEqual(listeners, {},
                      "No listeners yet");

    remoteFrame.addMessageListener(topic, listenerA);
    remoteFrame.addMessageListener(topic, listenerB);
    remoteFrame.addMessageListener(topic, listenerC);

    remoteFrame.removeMessageListener(topic, listenerB);

    assert.deepEqual(listeners[topic], [listenerA, listenerC],
                      "Listener is removed properly");
  }


exports["test MessageManager sendAsyncMessage"] =
  function(assert, done) {
    let [mm, frame] = createMessageManager();

    let remoteFrame = frame(mm).receiver;
    let calls = 0;

    let topic = "message-topic";

    let listener = function(data) {
      calls++;

      assert.deepEqual(data, {
        sync : false,
        name : topic,
        json : {foo : "bar"},
        target : null
      }, "Data received as expected");

      assert.equal(calls, 1,
                  "Listener called once");

      done();
    }

    remoteFrame.addMessageListener(topic, listener);

    let response = mm.sendAsyncMessage(topic, {foo : "bar"});

    assert.strictEqual(response, undefined,
                "No response for async messages");

    assert.equal(calls, 0,
                "Listener not called yet");
  }

exports["test MessageManager sendAsyncMessage without listeners"] =
  function(assert) {
    let [mm, frame] = createMessageManager();

    let remoteFrame = frame(mm).receiver;

    let topic = "message-topic";

    let response = mm.sendAsyncMessage(topic, {foo : "bar"});

    assert.strictEqual(response, undefined,
                "No response for async messages");
  }


exports["test MessageManager sendAsyncMessage without arguments"] =
  function(assert, done) {
    let [mm, frame] = createMessageManager();

    let remoteFrame = frame(mm).receiver;
    let calls = 0;

    let topic = "message-topic";

    let listener = function(data) {
      calls++;

      assert.deepEqual(data, {
        sync : false,
        name : topic,
        json : null,
        target : null
      }, "Data received as expected");

      assert.equal(calls, 1,
                  "Listener called once");

      done();
    }

    remoteFrame.addMessageListener(topic, listener);

    mm.sendAsyncMessage();

    mm.sendAsyncMessage(topic);

    assert.equal(calls, 0,
                "Listener not called yet");
  }


exports["test Remote Frame sendAsyncMessage"] =
  function(assert, done) {
    let [mm, frame] = createMessageManager();

    let remoteFrame = frame(mm).receiver;
    let calls = 0;

    let topic = "message-topic";

    let listener = function(data) {
      calls++;

      assert.deepEqual(data, {
        sync : false,
        name : topic,
        json : {foo : "bar"},
        target : null
      }, "Data received as expected");

      assert.equal(calls, 1,
                  "Listener called once");

      done();
    }

    mm.addMessageListener(topic, listener);

    let response = remoteFrame.sendAsyncMessage(topic, {foo : "bar"});

    assert.strictEqual(response, undefined,
                "No response for async messages");

    assert.equal(calls, 0,
                "Listener not called yet");
  }


exports["test Remote Frame sendAsyncMessage without arguments"] =
  function(assert, done) {
    let [mm, frame] = createMessageManager();

    let remoteFrame = frame(mm).receiver;
    let calls = 0;

    let topic = "message-topic";

    let listener = function(data) {
      calls++;

      assert.deepEqual(data, {
        sync : false,
        name : topic,
        json : null,
        target : null
      }, "Data received as expected");

      assert.equal(calls, 1,
                  "Listener called once");

      done();
    }

    mm.addMessageListener(topic, listener);

    remoteFrame.sendAsyncMessage();

    remoteFrame.sendAsyncMessage(topic);

    assert.equal(calls, 0,
                "Listener not called yet");
  }

exports["test Remote Frame sendAsyncMessage without listeners"] =
  function(assert) {
    let [mm, frame] = createMessageManager();

    let remoteFrame = frame(mm).receiver;

    let topic = "message-topic";

    let response = remoteFrame.sendAsyncMessage(topic, {foo : "bar"});

    assert.strictEqual(response, undefined,
                "No response for async messages");
  }

exports["test Remote Frame sendSyncMessage"] =
  function(assert) {
    let [mm, frame] = createMessageManager();

    let remoteFrame = frame(mm).receiver;

    let topic = "message-topic";

    let expectedData = {
      sync : true,
      name : topic,
      json : {foo : "bar"},
      target : null
    }

    let listenerA = function(data) {
      assert.deepEqual(data, expectedData,
                      "Data received as expected");

      return "my value";
    }

    let listenerB = function(data) {
      assert.deepEqual(data, expectedData,
                      "Data received as expected");

      return {complex : "object", method : function() "not allowed"};
    }

    let listenerC = function(data) {
      assert.deepEqual(data, expectedData,
                      "Data received as expected");
    }

    mm.addMessageListener(topic, listenerA);
    mm.addMessageListener(topic, listenerB);
    mm.addMessageListener(topic, listenerC);

    let response = remoteFrame.sendSyncMessage(topic, {foo : "bar"});

    assert.deepEqual(response, ["my value", {complex : "object"}, undefined],
                "Response from sync messages as expected");
  }

exports["test Remote Frame sendSyncMessage without arguments"] =
  function(assert) {
    let [mm, frame] = createMessageManager();

    let remoteFrame = frame(mm).receiver;

    let topic = "message-topic";

    let expectedData = {
      sync : true,
      name : topic,
      json : null,
      target : null
    }

    let listener = function(data) {
      assert.deepEqual(data, expectedData,
                      "Data received as expected");
    }

    mm.addMessageListener(topic, listener);

    let response = remoteFrame.sendSyncMessage();

    assert.deepEqual(response, [],
                "Empty response as expected");

    let response = remoteFrame.sendSyncMessage(topic);

    assert.deepEqual(response, [undefined],
                "Response from sync messages as expected");
  }

exports["test Remote Frame sendSyncMessage without listeners"] =
  function(assert) {
    let [mm, frame] = createMessageManager();

    let remoteFrame = frame(mm).receiver;
    let obj = {foo : "bar"};

    let topic = "message-topic";

    let response = remoteFrame.sendSyncMessage(topic, obj);

    assert.deepEqual(response, [],
                "Response from sync messages as expected");
  }


exports["test Message Manager / Remote Frame async pipeline"] =
  function(assert, done) {
    let [mm] = createMessageManager();

    let expectedMessages = ["alpha:remote", "alpha", "omega:remote", "omega"];

    mm.addMessageListener("handshake", function (data) {
      let messages = data.json.concat("alpha");

      mm.sendAsyncMessage("shutdown", messages);
    });

    mm.addMessageListener("shutdown", function (data) {
      let messages = data.json.concat("omega");

      assert.deepEqual(messages, expectedMessages,
        "messages delivered in the expected order");

      done();
    });

    mm.loadFrameScript(
      "data:, \
        addMessageListener('handshake', function (data) {\
          let messages = data.json.concat('alpha:remote');\
          sendAsyncMessage('handshake', messages);\
        });\
        addMessageListener('shutdown', function (data) {\
          let messages = data.json.concat('omega:remote');\
          sendAsyncMessage('shutdown', messages);\
        });\
      ", true);

    mm.sendAsyncMessage("handshake", []);
  }


exports["test Message Manager / Remote Frame async / sync pipeline"] =
  function(assert, done) {
    let [mm] = createMessageManager();

    let expectedMessages = ["alpha:remote", "alpha", "omega:remote", "omega"];

    mm.addMessageListener("handshake",
      function (data) data.json.concat("alpha")
    );

    mm.addMessageListener("shutdown",
      function (data) data.json.concat("omega")
    );

    mm.addMessageListener("verify", function (data) {

      assert.deepEqual(data.json, expectedMessages,
        "messages delivered in the expected order");

      done();
    });

    mm.loadFrameScript(
      "data:, \
        addMessageListener('handshake', function (data) {\
          let messages = data.json.concat('alpha:remote');\
          \
          messages = sendSyncMessage('handshake', messages)[0];\
          messages.push('omega:remote');\
          messages = sendSyncMessage('shutdown', messages)[0];\
          \
          sendSyncMessage('verify', messages);\
        });\
      ", true);

    mm.sendAsyncMessage("handshake", []);
  }

require("test").run(exports);
