/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { sandbox, load, evaluate, nuke, Sandbox } = require('sdk/loader/sandbox');
const xulApp = require("sdk/system/xul-app");
const fixturesURI = module.uri.split('test-sandbox.js')[0] + 'fixtures/';

// The following adds Debugger constructor to the global namespace.
const { Cu } = require('chrome');
const { addDebuggerToGlobal } =
  Cu.import('resource://gre/modules/jsdebugger.jsm', {});
addDebuggerToGlobal(this);

exports['test basics'] = function(assert) {
  let fixture = sandbox('http://example.com');
  assert.equal(evaluate(fixture, 'var a = 1;'), undefined,
               'returns expression value');
  assert.equal(evaluate(fixture, 'b = 2;'), 2,
               'returns expression value');
  assert.equal(fixture.b, 2, 'global is defined as property');
  assert.equal(fixture.a, 1, 'global is defined as property');
  assert.equal(evaluate(fixture, 'a + b;'), 3, 'returns correct sum');
};

exports['test async basics'] = function(assert, done) {
  let fixture = Sandbox('http://example.com');
  fixture.
    evaluate('var a = 1;').
    then(result => assert.equal(result, undefined, 'returns expression value')).

    then(_ => fixture.evaluate('b = 2;')).
    then(result => assert.equal(result, 2, 'returns expression value')).

    then(_ => {
      assert.equal(fixture._sandbox.b, 2, 'global is defined as property');
      assert.equal(fixture._sandbox.a, 1, 'global is defined as property');
    }).

    then(_ => fixture.evaluate('a + b;')).
    then(result => assert.equal(result, 3, 'returns correct sum')).

    then(done);
}

exports['test async non-privileged'] = function(assert, done) {
  let fixture = Sandbox('http://example.com');
  fixture.
    evaluate('Compo' + 'nents.utils').
    then(_ => assert.fail("Access to Components should be restricted")).
    catch(e => assert.equal(e.message, "Components is not defined")).

    then(_ => {
      fixture._sandbox.Cu = Cu;
      return fixture.evaluate("Cu");
    }).
    then(_ => assert.fail("Should not be able to call priviliged code")).
    catch(e => assert.ok(e.message.match("Permission denied"))).

    then(done);
}

exports['test non-privileged'] = function(assert) {
  let fixture = sandbox('http://example.com');
  if (xulApp.versionInRange(xulApp.platformVersion, "15.0a1", "18.*")) {
    let rv = evaluate(fixture, 'Compo' + 'nents.utils');
    assert.equal(rv, undefined,
                 "Components's attributes are undefined in content sandboxes");
  }
  else {
    assert.throws(function() {
      evaluate(fixture, 'Compo' + 'nents.utils');
    }, 'Access to components is restricted');
  }
  fixture.sandbox = sandbox;
  assert.throws(function() {
    evaluate(fixture, sandbox('http://foo.com'));
  }, 'Can not call privileged code');
};


exports['test async injection'] = function(assert, done) {
  Sandbox().init.
    then(fixture => {
      fixture._sandbox.hi = (name) => 'Hi ' + name;
      return fixture.evaluate('hi("sandbox");');
    }).    
    then(result => assert.equal(result, 'Hi sandbox', 'injected functions are callable')).

    then(done);
};

exports['test injection'] = function(assert) {
  let fixture = sandbox();
  fixture.hi = function(name) 'Hi ' + name
  assert.equal(evaluate(fixture, 'hi("sandbox");'), 'Hi sandbox',
                'injected functions are callable');
};

exports['test async exceptions'] = function(assert, done) {
  let fixture = Sandbox();
  fixture.
    evaluate('new ' + function() {
      var message = 'boom';
      throw Error(message);
    }).
    then(_ => assert.fail("Should not resolve")).
    catch(e => {
      assert.equal(e.fileName, '', 'no fileName reported');
      assert.equal(e.lineNumber, 3, 'reports correct line number');
    }).

    then(_ => fixture.evaluate('new ' + function() {
      var message = 'boom';
      throw Error(message);
    }, 'foo.js')).
    then(_ => assert.fail("Should not resolve")).
    catch(e => {
      assert.equal(e.fileName, 'foo.js', 'correct fileName reported');
      assert.equal(e.lineNumber, 3, 'reports correct line number');
    }).

    then(done);
}

exports['test exceptions'] = function(assert) {
  let fixture = sandbox();
  try {
    evaluate(fixture, '!' + function() {
      var message = 'boom';
      throw Error(message);
    } + '();');
  }
  catch (error) {
    assert.equal(error.fileName, '', 'no fileName reported');
    assert.equal(error.lineNumber, 3, 'reports correct line number');
  }

  try {
    evaluate(fixture, '!' + function() {
      var message = 'boom';
      throw Error(message);
    } + '();', 'foo.js');
  }
  catch (error) {
    assert.equal(error.fileName, 'foo.js', 'correct fileName reported');
    assert.equal(error.lineNumber, 3, 'reports correct line number');
  }

  try {
    evaluate(fixture, '!' + function() {
      var message = 'boom';
      throw Error(message);
    } + '();', 'foo.js', 2);
  }
  catch (error) {
    assert.equal(error.fileName, 'foo.js', 'correct fileName reported');
    assert.equal(error.lineNumber, 4, 'line number was opted');
  }
};

exports['test async opt version'] = function(assert, done) {
  Sandbox().
    evaluate('let a = 2;', 'test.js', 1, '1.5').
    then(_ => assert.fail("Should not resolve")).
    catch(e => assert.equal(e.name, "SyntaxError", "No let in js 1.5")).
    then(done);
}

exports['test opt version'] = function(assert) {
  let fixture = sandbox();
  assert.throws(function() {
    evaluate(fixture, 'let a = 2;', 'test.js', 1, '1.5');
  }, 'No let in js 1.5');
};

exports['test async load'] = function(assert, done) {
  let fixture = Sandbox();
  fixture.
    load(fixturesURI + 'sandbox-normal.js').
    then(_ => {
      assert.equal(fixture._sandbox.a, 1, 'global variable defined');
      assert.equal(fixture._sandbox.b, 2, 'global via `this` property was set');
      assert.equal(fixture._sandbox.f(), 4, 'function was defined');
    }).
    then(done);
}

exports['test load'] = function(assert) {
  let fixture = sandbox();
  load(fixture, fixturesURI + 'sandbox-normal.js');
  assert.equal(fixture.a, 1, 'global variable defined');
  assert.equal(fixture.b, 2, 'global via `this` property was set');
  assert.equal(fixture.f(), 4, 'function was defined');
};

exports['test async load with data: URI'] = function(assert, done) {
  let code = "var a = 1; this.b = 2; function f() 4";
  let fixture = Sandbox();
  fixture.
    load("data:," + encodeURIComponent(code)).
    then(_ => {
      assert.equal(fixture._sandbox.a, 1, 'global variable defined');
      assert.equal(fixture._sandbox.b, 2, 'global via `this` property was set');
      assert.equal(fixture._sandbox.f(), 4, 'function was defined');
    }).
    then(done);
}

exports['test load with data: URL'] = function(assert) {
  let code = "var a = 1; this.b = 2; function f() 4";
  let fixture = sandbox();
  load(fixture, "data:," + encodeURIComponent(code));

  assert.equal(fixture.a, 1, 'global variable defined');
  assert.equal(fixture.b, 2, 'global via `this` property was set');
  assert.equal(fixture.f(), 4, 'function was defined');
};

exports['test async script with complex char'] = function(assert, done) {
  let fixture = Sandbox();
  fixture.
    load(fixturesURI + 'sandbox-complex-character.js').
    then(_ => assert.equal(fixture._sandbox.chars, 'გამარჯობა', 
                          'complex chars were loaded correctly')).
    then(done);
}

exports['test load script with complex char'] = function(assert) {
  let fixture = sandbox();
  load(fixture, fixturesURI + 'sandbox-complex-character.js');
  assert.equal(fixture.chars, 'გამარჯობა', 'complex chars were loaded correctly');
};

exports['test async load with data: URI and complex char'] = function(assert, done) {
  let code = "var chars = 'გამარჯობა';";
  let fixture = Sandbox();
  fixture.
    load("data:," + encodeURIComponent(code)).
    then(_ => assert.equal(fixture._sandbox.chars, 'გამარჯობა', 
                          'complex chars were loaded correctly')).
    then(done);
}

exports['test load script with data: URL and complex char'] = function(assert) {
  let code = "var chars = 'გამარჯობა';";
  let fixture = sandbox();
  load(fixture, "data:," + encodeURIComponent(code));

  assert.equal(fixture.chars, 'გამარჯობა', 'complex chars were loaded correctly');
};

exports['test async metadata']  = function(assert, done) {
  let dbg = new Debugger();
  dbg.onNewGlobalObject = function(global) {
    let metadata = Cu.getSandboxMetadata(global.unsafeDereference());
    assert.ok(metadata, 'this global has attached metadata');
    assert.equal(metadata.addonID, self.id, 'addon ID is set');

    dbg.onNewGlobalObject = undefined;
    done();
  }

  let fixture = Sandbox();
  let self = require('sdk/self');
}

exports['test metadata']  = function(assert) {
  let dbg = new Debugger();
  dbg.onNewGlobalObject = function(global) {
    let metadata = Cu.getSandboxMetadata(global.unsafeDereference());
    assert.ok(metadata, 'this global has attached metadata');
    assert.equal(metadata.addonID, self.id, 'addon ID is set');

    dbg.onNewGlobalObject = undefined;
  }

  let fixture = sandbox();
  let self = require('sdk/self');
}

exports['test async nuke sandbox'] = function(assert, done) {
  let fixture = Sandbox('http://example.com');
  let ref = null;
  fixture.init.
    then(_ => fixture._sandbox.foo = 'foo').
    then(_ => fixture.evaluate('let a = {bar: "bar"}; a')).
    then(result => ref = result).

    then(_ => fixture.nuke()).

    then(_ => assert.ok(Cu.isDeadWrapper(fixture._sandbox), "sandbox should be dead")).

    then(_ => fixture._sandbox.foo).
    then(_ => assert.fail("should not resolve")).
    catch(e => assert.equal(e.message, "can't access dead object")).

    then(_ => assert.ok(Cu.isDeadWrapper(ref), "ref object should be dead")).

    then(_ => ref.bar).
    then(_ => assert.fail("should not resolve")).
    catch(e => assert.equal(e.message, "can't access dead object")).

    then(done);
}

exports['test nuke sandbox'] = function(assert) {

  let fixture = sandbox('http://example.com');
  fixture.foo = 'foo';

  let ref = evaluate(fixture, 'let a = {bar: "bar"}; a');

  nuke(fixture);

  assert.ok(Cu.isDeadWrapper(fixture), 'sandbox should be dead');

  assert.throws(
    () => fixture.foo,
    /can't access dead object/,
    'property of nuked sandbox should not be accessible'
  );

  assert.ok(Cu.isDeadWrapper(ref), 'ref to object from sandbox should be dead');

  assert.throws(
    () => ref.bar,
    /can't access dead object/,
    'object from nuked sandbox should not be alive'
  );
}

require('test').run(exports);
