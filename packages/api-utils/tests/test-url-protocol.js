"use strict";

const { Protocol } = require('api-utils/protocol/url');
const { Service, unregister } = require('api-utils/xpcom');
const { setTimeout } = require('api-utils/timer');
const { XMLHttpRequest } = require('api-utils/xhr');

function register(protocol) {
  return Service.new({
    contract: protocol.contract,
    description: protocol.description,
    component: protocol
  });
}

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

exports['test uri handler must be registered'] = function(assert, done) {
  let requested = 0;
  let protocol = Protocol.extend({
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
  let service = register(protocol);

  readURI(uri)(function ({ responseText, status }) {
    assert.equal(status, 0, 'request was sucessful');

    unregister(service);

    assert.throws(function() {
      readURI(url)();
    }, 'protocol is unregistered');

    assert.equal(requested, 1, 'request was handled');
    done();
  });
};

exports['test uri redirect'] = function(assert, done) {
  let requested = 0;
  let protocol = Protocol.extend({
    scheme: 'register' + new Date().getTime().toString(36),
    onRequest: function onRequest(request, response) {
      requested ++;
      assert.equal(request.uri, uri, 'expected request uri');
      response.uri = 'data:text/html,done'
    }
  });
  let uri = protocol.scheme + '://root/index.html';

  let service = register(protocol);
  readURI(uri)(function ({ responseText, status }) {
    assert.equal(status, 0, 'request was sucessful');
    assert.equal(responseText, 'done', 'expected response text');
    assert.equal(requested, 1, 'request was handled');

    unregister(service);
    done();
  });
};

exports['test uri async'] = function(assert, done) {
  let requested = 0;
  let protocol = Protocol.extend({
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
  let service = register(protocol);

  let uri = protocol.scheme + '://root/index.html'
  readURI(uri)(function ({ responseText, status }) {
    assert.equal(status, 0, 'request was sucessful');
    assert.equal(requested, 1, 'request was handled');
    assert.equal(responseText, 'hello\nasync', 'expected response text');

    unregister(service);
    done();
  });
};

require('test').run(exports);
