/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

let { Loader, main, unload, parseStack, getSandboxes } =
  require('toolkit/loader');

const { Cc, Ci, Cu } = require("chrome");
const { notifyObservers, addObserver } =
  Cc['@mozilla.org/observer-service;1'].getService(Ci.nsIObserverService);

let root = module.uri.substr(0, module.uri.lastIndexOf('/'))

exports['test dependency cycles'] = function(assert) {
  let uri = root + '/fixtures/loader/cycles/';
  let loader = Loader({ paths: { '': uri } });

  let program = main(loader, 'main');

  assert.equal(program.a.b, program.b, 'module `a` gets correct `b`');
  assert.equal(program.b.a, program.a, 'module `b` gets correct `a`');
  assert.equal(program.c.main, program, 'module `c` gets correct `main`');

  unload(loader);
}

exports['test syntax errors'] = function(assert) {
  let uri = root + '/fixtures/loader/syntax-error/';
  let loader = Loader({ paths: { '': uri } });

  try {
    let program = main(loader, 'main');
  } catch (error) {
    assert.equal(error.name, "SyntaxError", "throws syntax error");
    assert.equal(error.fileName.split("/").pop(), "error.js",
              "Error contains filename");
    assert.equal(error.lineNumber, 7, "error is on line 7")
    let stack = parseStack(error.stack);
    assert.equal(stack.pop().fileName, uri + "main.js",
                 "loader stack is omitted");
    assert.equal(stack.pop().fileName, module.uri,
                 "previous in the stack is test module");

  } finally {
    unload(loader);
  }
}

exports['test missing module'] = function(assert) {
  let uri = root + '/fixtures/loader/missing/'
  let loader = Loader({ paths: { '': uri } });

  try {
    let program = main(loader, 'main')
  } catch (error) {
    assert.equal(error.message, "Module `not-found` is not found at " +
                uri + "not-found.js", "throws if error not found");

    assert.equal(error.fileName.split("/").pop(), "main.js",
                 "Error fileName is requirer module");

    assert.equal(error.lineNumber, 7, "error is on line 7");

    let stack = parseStack(error.stack);

    assert.equal(stack.pop().fileName, uri + "main.js",
                 "loader stack is omitted");

    assert.equal(stack.pop().fileName, module.uri,
                 "previous in the stack is test module");
  } finally {
    unload(loader);
  }
}

exports['test exceptions in modules'] = function(assert) {
  let uri = root + '/fixtures/loader/exceptions/'

  let loader = Loader({ paths: { '': uri } });

  try {
    let program = main(loader, 'main')
  } catch (error) {
    assert.equal(error.message, "Boom!", "thrown errors propagate");

    assert.equal(error.fileName.split("/").pop(), "boomer.js",
                 "Error comes from the module that threw it");

    assert.equal(error.lineNumber, 8, "error is on line 8");

    let stack = parseStack(error.stack);

    let frame = stack.pop()
    assert.equal(frame.fileName, uri + "boomer.js",
                 "module that threw is first in the stack");
    assert.equal(frame.name, "exports.boom",
                 "name is in the stack");

    frame = stack.pop()
    assert.equal(frame.fileName, uri + "main.js",
                 "module that called it is next in the stack");
    assert.equal(frame.lineNumber, 9, "caller line is in the stack");


    assert.equal(stack.pop().fileName, module.uri,
                 "this test module is next in the stack");
  } finally {
    unload(loader);
  }
}

exports['test early errors in module'] = function(assert) {
  let uri = root + '/fixtures/loader/errors/';
  let loader = Loader({ paths: { '': uri } });

  try {
    let program = main(loader, 'main')
  } catch (error) {
    assert.equal(String(error),
                 "Error: opening input stream (invalid filename?)",
                 "thrown errors propagate");

    assert.equal(error.fileName.split("/").pop(), "boomer.js",
                 "Error comes from the module that threw it");

    assert.equal(error.lineNumber, 7, "error is on line 7");

    let stack = parseStack(error.stack);

    let frame = stack.pop()
    assert.equal(frame.fileName, uri + "boomer.js",
                 "module that threw is first in the stack");

    frame = stack.pop()
    assert.equal(frame.fileName, uri + "main.js",
                 "module that called it is next in the stack");
    assert.equal(frame.lineNumber, 7, "caller line is in the stack");


    assert.equal(stack.pop().fileName, module.uri,
                 "this test module is next in the stack");
  } finally {
    unload(loader);
  }
}

exports['test getSandboxes'] = function(assert) {
  let uri = root + '/fixtures/loader/cycles/';
  let loader = Loader({ paths: { '': uri } });
  let program = main(loader, 'main');
  
  let sandboxes = getSandboxes(loader);
  assert.ok(Object.keys(sandboxes).every(function(uri) {
    return uri.contains('cycles/main.js') ||
      uri.contains('cycles/a.js') ||
      uri.contains('cycles/b.js') ||
      uri.contains('cycles/c.js');
  }), "getSandboxes reports all, and only, modules from the addon");

  unload(loader);
}

exports['test new sandbox notification'] = function(assert) {
  let uri = root + '/fixtures/loader/sandbox-notification/';
  let loader = Loader({ paths: { '': uri } });
  let program = main(loader, 'main');
  let loadedModules = [];

  addObserver(function(eventData) {
    let module = eventData.wrappedJSObject.module;
    loadedModules.push(module.uri);
  }, 'sdk:loader:new-sandbox', false);

  // This notification is handled in main.js inside the fixture.
  notifyObservers(null, 'test:test-loader:new-sandbox-notification:go-ahead',
    null);

  // This also ensures that the notification is issued before a module is
  // evaluated.
  assert.ok(loadedModules[0].contains('sandbox-notification/a.js'),
    'modue a.js should be loaded');
  assert.ok(loadedModules[1].contains('sandbox-notification/b.js'),
    'modue b.js should be loaded');
}

require('test').run(exports);
