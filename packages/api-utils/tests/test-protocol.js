"use strict";

const { AboutHandler, ProtocolHandler } = require('api-utils/protocol');
const { register, unregister } = require('api-utils/xpcom');
const { setTimeout } = require('api-utils/timer');
const { XMLHttpRequest } = require('api-utils/xhr');

function readURI(uri) {
  return function promise(deliver) {
    let request = new XMLHttpRequest();
    request.open('GET', uri);
    request.onreadystatechange = function() {
      if (request.readyState === 4) deliver(request)
    };
    request.send(null);
  }
}

function run() {
  return Array.slice(arguments).reduce(function(value, test) {
    return !test ? value : function promise(deliver) {
      value(function(value) {
        let promise = test(value)
        if (promise) promise(deliver)
      })
    };
  }, function promise(deliver) { deliver() })
}

exports['test about handler must be registered'] = function (assert, done) {
   let requested = 0;
  let protocol = AboutHandler.extend({
    what: 'register' + new Date().getTime().toString(36),
    onRequest: function onRequest(request, response) {
      response.uri = 'data:text/html,hello ' + this.what
      requested ++;
    }
  });

  assert.throws(function() {
    readURI('about:' + protocol.what)();
  }, 'protocol is not register');
  register(protocol);

  readURI('about:' + protocol.what)(function ({ responseText, status }) {
    assert.equal(status, 0, 'request was sucessful');

    unregister(protocol);

    assert.throws(function() {
      readURI('about:' + protocol.what)();
    }, 'protocol is unregistered');

    assert.equal(requested, 1, 'request was handled');
    done();
  });
};

exports["test about handler - redirect"] = function(assert, done) {
  let requested = 0;
  let protocol = AboutHandler.extend({
    what: 'redirect' + new Date().getTime().toString(36),
    onRequest: function onRequest(request, response) {
      response.uri = 'data:text/html,hello ' + this.what
      requested ++;
    }
  });
  register(protocol);

  readURI('about:' + protocol.what)(function ({ responseText, status }) {
    assert.equal(status, 0, 'request was sucessful');
    assert.equal(responseText, 'hello ' + protocol.what,
                 'response content is correct');

    unregister(protocol);
    assert.equal(requested, 1, 'request was handled');
    done();
  });
};

exports["test about handler - async"] = function(assert, done) {
  let requested = 0;
  let protocol = AboutHandler.extend({
    what: 'async' + new Date().getTime().toString(36),
    onRequest: function onRequest(request, response) {
      response.contentType = 'text/html';
      response.write('hello\n')
      setTimeout(function() {
        requested ++;
        response.end(protocol.what);
      }, 100);
    }
  });

  register(protocol);
  readURI('about:' + protocol.what)(function({ responseText, status }) {
    assert.equal(status, 0, 'request was sucessful');
    assert.equal(responseText, 'hello\n' + protocol.what,
                 'response content is correct');
    assert.equal(requested, 1, 'request was handled');

    unregister(protocol);
    done();
  });
};

exports['test uri handler must be registered'] = function(assert, done) {
  let requested = 0;
  let protocol = ProtocolHandler.extend({
    scheme: 'register' + new Date().getTime().toString(36),
    onRequest: function onRequest(request, response) {
      requested ++;
      assert.equal(request.uri, uri, 'expected request uri');
      response.uri = 'data:text/html,done'
    }
  });
  let uri = protocol.scheme + '://root/index.html'

  assert.throws(function() {
    readURI(url)();
  }, 'protocol is not register');
  register(protocol);

  readURI(uri)(function ({ responseText, status }) {
    assert.equal(status, 0, 'request was sucessful');

    unregister(protocol);

    assert.throws(function() {
      readURI(url)();
    }, 'protocol is unregistered');

    assert.equal(requested, 1, 'request was handled');
    done();
  });
};

exports['test uri redirect'] = function(assert, done) {
  let requested = 0;
  let protocol = ProtocolHandler.extend({
    scheme: 'register' + new Date().getTime().toString(36),
    onRequest: function onRequest(request, response) {
      requested ++;
      assert.equal(request.uri, uri, 'expected request uri');
      response.uri = 'data:text/html,done'
    }
  });
  let uri = protocol.scheme + '://root/index.html';

  register(protocol);
  readURI(uri)(function ({ responseText, status }) {
    assert.equal(status, 0, 'request was sucessful');
    assert.equal(responseText, 'done', 'expected response text');
    assert.equal(requested, 1, 'request was handled');

    unregister(protocol);
    done();
  });
};

exports['test uri async'] = function(assert, done) {
  let requested = 0;
  let protocol = ProtocolHandler.extend({
    scheme: 'async' + new Date().getTime().toString(36),
    onRequest: function onRequest(request, response) {
      assert.equal(request.uri, uri, 'expected request uri');
      requested ++;
      setTimeout(function() {
        response.write('hello\n');
        setTimeout(function() {
          response.end('async')
        }, 10)
      }, 10);
    }
  });
  register(protocol);

  let uri = protocol.scheme + '://root/index.html'
  readURI(uri)(function ({ responseText, status }) {
    assert.equal(status, 0, 'request was sucessful');
    assert.equal(requested, 1, 'request was handled');
    assert.equal(responseText, 'hello\nasync', 'expected response text');

    unregister(protocol);
    done();
  });
};

require('test').run(exports);
