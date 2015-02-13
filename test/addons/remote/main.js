/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
const LOCAL_URI = "about:robots";
const REMOTE_URI = "about:home";
const REMOTE_MODULE = "./remote-module";

const { Loader } = require('sdk/test/loader');
const { getTabs, openTab, closeTab, setTabURL, getBrowserForTab, getURI } = require('sdk/tabs/utils');
const { getMostRecentBrowserWindow } = require('sdk/window/utils');
const { cleanUI } = require("sdk/test/utils");
const { setTimeout } = require("sdk/timers");

const { Cu } = require('chrome');
const { async } = Cu.import('resource://gre/modules/Task.jsm', {}).Task;

const { set } = require('sdk/preferences/service');
const mainWindow = getMostRecentBrowserWindow();
const isE10S = mainWindow.gMultiProcessBrowser;

// The hidden preload browser messes up our frame counts
set('browser.newtab.preload', false);

function promiseEvent(emitter, event) {
  console.log("Waiting for " + event);
  return new Promise(resolve => {
    emitter.once(event, (...args) => {
      console.log("Saw " + event);
      resolve(args);
    });
  });
}

function promiseDOMEvent(target, event, isCapturing = false) {
  console.log("Waiting for " + event);
  return new Promise(resolve => {
    let listener = (event) => {
      target.removeEventListener(event, listener, isCapturing);
      resolve(event);
    };
    target.addEventListener(event, listener, isCapturing);
  })
}

promiseEventOnItemAndContainer = async(function*(assert, itemport, container, event, item = itemport) {
  let itemEvent = promiseEvent(itemport, event);
  let containerEvent = promiseEvent(container, event);

  let itemArgs = yield itemEvent;
  let [target, ...containerArgs] = yield containerEvent;

  assert.equal(target, item, "Should have seen a container event for the right item");
  assert.equal(JSON.stringify(itemArgs), JSON.stringify(containerArgs), "Arguments should have matched");

  return itemArgs;
});

let waitForProcesses = async(function*(loader) {
  console.log("Starting remote");
  let { processes, frames, remoteRequire } = loader.require('sdk/remote/parent');
  remoteRequire(REMOTE_MODULE, module);

  let events = [];

  // In e10s we should expect to see two processes
  let expectedCount = isE10S ? 2 : 1;

  yield new Promise(resolve => {
    let count = 0;

    // Wait for a process to be detected
    let listener = process => {
      console.log("Saw a process attach");
      // Wait for the remote module to load in this process
      process.port.once('sdk/test/load', () => {
        console.log("Saw a remote module load");
        count++;
        if (count == expectedCount) {
          processes.off('attach', listener);
          resolve();
        }
      });
    }
    processes.on('attach', listener);
  });

  console.log("Remote ready");
  return { processes, frames, remoteRequire };
});

if (isE10S) {
  console.log("Testing in E10S mode");
  // We expect a child process to already be present, make sure that is the case
  mainWindow.XULBrowserWindow.forceInitialBrowserRemote();

  // Check that we see a process stop and start
  exports["test process restart"] = function*(assert) {
    let window = getMostRecentBrowserWindow();

    let tabs = getTabs(window);
    assert.equal(tabs.length, 1, "Should have just the one tab to start with");
    let tab = tabs[0];

    let loader = new Loader(module);
    let { processes, frames, remoteRequire } = yield waitForProcesses(loader);

    let remoteProcess = Array.filter(processes, p => p.isRemote)[0];
    let localProcess = Array.filter(processes, p => !p.isRemote)[0];
    let remoteFrame = Array.filter(frames, f => f.process == remoteProcess)[0];

    // Switch the remote tab to a local URI which should kill the remote process

    let frameDetach = promiseEventOnItemAndContainer(assert, remoteFrame, frames, 'detach');
    let frameAttach = promiseEvent(frames, 'attach');
    let processDetach = promiseEventOnItemAndContainer(assert, remoteProcess, processes, 'detach');
    setTabURL(tab, LOCAL_URI);
    // The load should kill the remote frame
    yield frameDetach;
    // And create a new frame in the local process
    let [newFrame] = yield frameAttach;
    assert.equal(newFrame.process, localProcess, "New frame should be in the local process");
    // And kill the process
    yield processDetach;

    frameDetach = promiseEventOnItemAndContainer(assert, newFrame, frames, 'detach');
    processAttach = promiseEvent(processes, 'attach');
    frameAttach = promiseEvent(frames, 'attach');
    setTabURL(tab, REMOTE_URI);
    // The load should kill the remote frame
    yield frameDetach;
    // And create a new remote process
    [remoteProcess] = yield processAttach;
    assert.ok(remoteProcess.isRemote, "Process should be remote");
    // And create a new frame in the remote process
    [newFrame] = yield frameAttach;
    assert.equal(newFrame.process, remoteProcess, "New frame should be in the remote process");

    setTabURL(tab, "about:blank");

    loader.unload();
    yield cleanUI();
  };
}
else {
  console.log("Testing in non-E10S mode");
}

// Test that we find the right number of processes and that messaging between
// them works and none of the streams cross
exports["test process list"] = function*(assert) {
  let loader = new Loader(module);
  let { processes, frames, remoteRequire } = loader.require('sdk/remote/parent');

  let processCount = 0;
  processes.forEvery(processes => {
    processCount++;
  });

  yield waitForProcesses(loader);

  let remoteProcesses = Array.filter(processes, process => process.isRemote);
  let localProcesses = Array.filter(processes, process => !process.isRemote);

  assert.equal(localProcesses.length, 1, "Should always be one process");

  if (isE10S) {
    assert.equal(remoteProcesses.length, 1, "Should be one remote processes");
  } else {
    assert.equal(remoteProcesses.length, 0, "Should be no remote processes");
  }

  assert.equal(processCount, processes.length, "Should have seen all processes");

  processCount = 0;
  processes.forEvery(process => {
    processCount++;
  });

  assert.equal(processCount, processes.length, "forEvery should send existing processes to the listener");

  localProcesses[0].port.on('sdk/test/pong', (key) => {
    assert.equal(key, "local", "Should not have seen a pong from the local process with the wrong key");
  });

  if (isE10S) {
    remoteProcesses[0].port.on('sdk/test/pong', (key) => {
      assert.equal(key, "remote", "Should not have seen a pong from the remote process with the wrong key");
    });
  }

  let promise = promiseEventOnItemAndContainer(assert, localProcesses[0].port, processes.port, 'sdk/test/pong', localProcesses[0]);
  localProcesses[0].port.emit('sdk/test/ping', "local");

  let reply = yield promise;
  assert.equal(reply[0], "local", "Saw the process reply with the right key");

  if (isE10S) {
    promise = promiseEventOnItemAndContainer(assert, remoteProcesses[0].port, processes.port, 'sdk/test/pong', remoteProcesses[0]);
    remoteProcesses[0].port.emit('sdk/test/ping', "remote");

    reply = yield promise;
    assert.equal(reply[0], "remote", "Saw the process reply with the right key");

    assert.notEqual(localProcesses[0].id, remoteProcesses[0].id, "Processes should have different identifiers");
  }

  loader.unload();
};

// Counts the frames in all the child processes
let getChildFrameCount = async(function*(processes) {
  let frameCount = 0;

  for (let process of processes) {
    process.port.emit('sdk/test/count');
    let [count] = yield promiseEvent(process.port, 'sdk/test/count');
    frameCount += count;
  }

  return frameCount;
});

// Test that the frame lists are kept up to date
exports["test frame list"] = function*(assert) {
  function browserFrames(list) {
    return Array.filter(list, b => b.isBrowser).length;
  }

  let window = getMostRecentBrowserWindow();

  let tabs = getTabs(window);
  assert.equal(tabs.length, 1, "Should have just the one tab to start with");

  let loader = new Loader(module);
  let { processes, frames, remoteRequire } = yield waitForProcesses(loader);

  assert.equal(browserFrames(frames), getTabs(window).length, "Should be the right number of browser frames.");
  assert.equal((yield getChildFrameCount(processes)), frames.length, "Child processes should have the right number of frames");

  let promise = promiseEvent(frames, 'attach');
  let tab1 = openTab(window, LOCAL_URI);
  let [frame1] = yield promise;
  assert.ok(!!frame1, "Should have seen the new frame");
  assert.ok(!frame1.process.isRemote, "Frame should not be remote");

  assert.equal(browserFrames(frames), getTabs(window).length, "Should be the right number of browser frames.");
  assert.equal((yield getChildFrameCount(processes)), frames.length, "Child processes should have the right number of frames");

  promise = promiseEvent(frames, 'attach');
  let tab2 = openTab(window, REMOTE_URI);
  let [frame2] = yield promise;
  assert.ok(!!frame2, "Should have seen the new frame");
  if (isE10S)
    assert.ok(frame2.process.isRemote, "Frame should be remote");
  else
    assert.ok(!frame2.process.isRemote, "Frame should not be remote");

  assert.equal(browserFrames(frames), getTabs(window).length, "Should be the right number of browser frames.");
  assert.equal((yield getChildFrameCount(processes)), frames.length, "Child processes should have the right number of frames");

  frames.port.emit('sdk/test/ping')
  yield new Promise(resolve => {
    let count = 0;
    let listener = () => {
      console.log("Saw pong");
      count++;
      if (count == frames.length) {
        frames.port.off('sdk/test/pong', listener);
        resolve();
      }
    };
    frames.port.on('sdk/test/pong', listener);
  });

  let badListener = () => {
    assert.fail("Should not have seen a response through this frame");
  }
  frame1.port.on('sdk/test/pong', badListener);
  frame2.port.emit('sdk/test/ping', 'b');
  let [key] = yield promiseEventOnItemAndContainer(assert, frame2.port, frames.port, 'sdk/test/pong', frame2);
  assert.equal(key, 'b', "Should have seen the right response");
  frame1.port.off('sdk/test/pong', badListener);

  frame2.port.on('sdk/test/pong', badListener);
  frame1.port.emit('sdk/test/ping', 'b');
  [key] = yield promiseEventOnItemAndContainer(assert, frame1.port, frames.port, 'sdk/test/pong', frame1);
  assert.equal(key, 'b', "Should have seen the right response");
  frame2.port.off('sdk/test/pong', badListener);

  promise = promiseEventOnItemAndContainer(assert, frame1, frames, 'detach');
  closeTab(tab1);
  yield promise;

  assert.equal(browserFrames(frames), getTabs(window).length, "Should be the right number of browser frames.");
  assert.equal((yield getChildFrameCount(processes)), frames.length, "Child processes should have the right number of frames");

  promise = promiseEventOnItemAndContainer(assert, frame2, frames, 'detach');
  closeTab(tab2);
  yield promise;

  assert.equal(browserFrames(frames), getTabs(window).length, "Should be the right number of browser frames.");
  assert.equal((yield getChildFrameCount(processes)), frames.length, "Child processes should have the right number of frames");

  loader.unload();

  yield cleanUI();
};

// Test that multiple loaders get their own loaders in the child and messages
// don't cross. Unload should work
exports["test new loader"] = function*(assert) {
  let loader1 = new Loader(module);
  let { processes: processes1 } = yield waitForProcesses(loader1);

  let loader2 = new Loader(module);
  let { processes: processes2 } = yield waitForProcesses(loader2);

  let process1 = [...processes1][0];
  let process2 = [...processes2][0];

  process1.port.on('sdk/test/pong', (key) => {
    assert.equal(key, "a", "Should have seen the right pong");
  });

  process2.port.on('sdk/test/pong', (key) => {
    assert.equal(key, "b", "Should have seen the right pong");
  });

  process1.port.emit('sdk/test/ping', 'a');
  yield promiseEvent(process1.port, 'sdk/test/pong');

  process2.port.emit('sdk/test/ping', 'b');
  yield promiseEvent(process2.port, 'sdk/test/pong');

  loader1.unload();

  process2.port.emit('sdk/test/ping', 'b');
  yield promiseEvent(process2.port, 'sdk/test/pong');

  loader2.unload();
};

// Test that unloading the loader unloads the child instances
exports["test unload"] = function*(assert) {
  let window = getMostRecentBrowserWindow();
  let loader = new Loader(module);
  let { processes, frames, remoteRequire } = yield waitForProcesses(loader);

  let promise = promiseEvent(frames, 'attach');
  let tab = openTab(window, "data:,<html/>");
  let browser = getBrowserForTab(tab);
  yield promiseDOMEvent(browser, "load", true);
  let [frame] = yield promise;
  assert.ok(!!frame, "Should have seen the new frame");

  promise = promiseDOMEvent(browser, 'hashchange');
  frame.port.emit('sdk/test/testunload');
  loader.unload("shutdown");
  yield promise;

  let hash = getURI(tab).replace(/.*#/, "");
  assert.equal(hash, "unloaded:shutdown", "Saw the correct hash change.")

  closeTab(tab);

  yield cleanUI();
}

// Test that unloading the loader causes the child to see detach events
exports["test detach on unload"] = function*(assert) {
  let window = getMostRecentBrowserWindow();
  let loader = new Loader(module);
  let { processes, frames, remoteRequire } = yield waitForProcesses(loader);

  let promise = promiseEvent(frames, 'attach');
  let tab = openTab(window, "data:,<html/>");
  let browser = getBrowserForTab(tab);
  yield promiseDOMEvent(browser, "load", true);
  let [frame] = yield promise;
  assert.ok(!!frame, "Should have seen the new frame");

  promise = promiseDOMEvent(browser, 'hashchange');
  frame.port.emit('sdk/test/testdetachonunload');
  loader.unload("shutdown");
  yield promise;

  let hash = getURI(tab).replace(/.*#/, "");
  assert.equal(hash, "unloaded", "Saw the correct hash change.")

  closeTab(tab);

  yield cleanUI();
}

// Test that DOM event listener on the frame object works
exports["test frame event listeners"] = function*(assert) {
  let window = getMostRecentBrowserWindow();
  let loader = new Loader(module);
  let { processes, frames, remoteRequire } = yield waitForProcesses(loader);

  let promise = promiseEvent(frames, 'attach');
  let tab = openTab(window, "data:text/html,<html></html>");
  let browser = getBrowserForTab(tab);
  yield promiseDOMEvent(browser, "load", true);
  let [frame] = yield promise;
  assert.ok(!!frame, "Should have seen the new frame");

  frame.port.emit('sdk/test/registerframeevent');
  promise = Promise.all([
    promiseEvent(frame.port, 'sdk/test/sawreply'),
    promiseEvent(frame.port, 'sdk/test/eventsent')
  ]);

  frame.port.emit('sdk/test/sendevent');
  yield promise;

  frame.port.emit('sdk/test/unregisterframeevent');
  promise = promiseEvent(frame.port, 'sdk/test/eventsent');
  frame.port.on('sdk/test/sawreply', () => {
    assert.fail("Should not have seen the event listener reply");
  });

  frame.port.emit('sdk/test/sendevent');
  yield promise;

  closeTab(tab);
  loader.unload();

  yield cleanUI();
}

// Test that DOM event listener on the frames object works
exports["test frames event listeners"] = function*(assert) {
  let window = getMostRecentBrowserWindow();
  let loader = new Loader(module);
  let { processes, frames, remoteRequire } = yield waitForProcesses(loader);

  let promise = promiseEvent(frames, 'attach');
  let tab = openTab(window, "data:text/html,<html></html>");
  let browser = getBrowserForTab(tab);
  yield promiseDOMEvent(browser, "load", true);
  let [frame] = yield promise;
  assert.ok(!!frame, "Should have seen the new frame");

  frame.port.emit('sdk/test/registerframesevent');
  promise = Promise.all([
    promiseEvent(frame.port, 'sdk/test/sawreply'),
    promiseEvent(frame.port, 'sdk/test/eventsent')
  ]);

  frame.port.emit('sdk/test/sendevent');
  yield promise;

  frame.port.emit('sdk/test/unregisterframesevent');
  promise = promiseEvent(frame.port, 'sdk/test/eventsent');
  frame.port.on('sdk/test/sawreply', () => {
    assert.fail("Should not have seen the event listener reply");
  });

  frame.port.emit('sdk/test/sendevent');
  yield promise;

  closeTab(tab);
  loader.unload();

  yield cleanUI();
}

// Test that unloading unregisters frame DOM events
exports["test unload removes frame event listeners"] = function*(assert) {
  let window = getMostRecentBrowserWindow();
  let loader = new Loader(module);
  let { processes, frames, remoteRequire } = yield waitForProcesses(loader);

  let loader2 = new Loader(module);
  let { frames: frames2 } = yield waitForProcesses(loader2);

  let promise = promiseEvent(frames, 'attach');
  let promise2 = promiseEvent(frames2, 'attach');
  let tab = openTab(window, "data:text/html,<html></html>");
  let browser = getBrowserForTab(tab);
  yield promiseDOMEvent(browser, "load", true);
  let [frame] = yield promise;
  let [frame2] = yield promise2;
  assert.ok(!!frame && !!frame2, "Should have seen the new frame");

  frame.port.emit('sdk/test/registerframeevent');
  promise = Promise.all([
    promiseEvent(frame2.port, 'sdk/test/sawreply'),
    promiseEvent(frame2.port, 'sdk/test/eventsent')
  ]);

  frame2.port.emit('sdk/test/sendevent');
  yield promise;

  loader.unload();

  promise = promiseEvent(frame2.port, 'sdk/test/eventsent');
  frame2.port.on('sdk/test/sawreply', () => {
    assert.fail("Should not have seen the event listener reply");
  });

  frame2.port.emit('sdk/test/sendevent');
  yield promise;

  closeTab(tab);
  loader2.unload();

  yield cleanUI();
}

// Test that unloading unregisters frames DOM events
exports["test unload removes frames event listeners"] = function*(assert) {
  let window = getMostRecentBrowserWindow();
  let loader = new Loader(module);
  let { processes, frames, remoteRequire } = yield waitForProcesses(loader);

  let loader2 = new Loader(module);
  let { frames: frames2 } = yield waitForProcesses(loader2);

  let promise = promiseEvent(frames, 'attach');
  let promise2 = promiseEvent(frames2, 'attach');
  let tab = openTab(window, "data:text/html,<html></html>");
  let browser = getBrowserForTab(tab);
  yield promiseDOMEvent(browser, "load", true);
  let [frame] = yield promise;
  let [frame2] = yield promise2;
  assert.ok(!!frame && !!frame2, "Should have seen the new frame");

  frame.port.emit('sdk/test/registerframesevent');
  promise = Promise.all([
    promiseEvent(frame2.port, 'sdk/test/sawreply'),
    promiseEvent(frame2.port, 'sdk/test/eventsent')
  ]);

  frame2.port.emit('sdk/test/sendevent');
  yield promise;

  loader.unload();

  promise = promiseEvent(frame2.port, 'sdk/test/eventsent');
  frame2.port.on('sdk/test/sawreply', () => {
    assert.fail("Should not have seen the event listener reply");
  });

  frame2.port.emit('sdk/test/sendevent');
  yield promise;

  closeTab(tab);
  loader2.unload();

  yield cleanUI();
}

// Check that the child frame has the right properties
exports["test frame properties"] = function*(assert) {
  let loader = new Loader(module);
  let { processes, frames, remoteRequire } = yield waitForProcesses(loader);

  let promise = new Promise(resolve => {
    let count = frames.length;
    let listener = (frame, properties) => {
      assert.equal(properties.isBrowser, frame.isBrowser,
                   "Child frame should have the same isBrowser property");

      if (--count == 0) {
        frames.port.off('sdk/test/replyproperties', listener);
        resolve();
      }
    }

    frames.port.on('sdk/test/replyproperties', listener);
  })

  frames.port.emit('sdk/test/checkproperties');
  yield promise;

  loader.unload();
}

require('sdk/test/runner').runTestsFromModule(module);
