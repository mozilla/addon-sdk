"use strict";

const { Protocol } = require('api-utils/protocol/about');
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

exports['test about handler must be registered'] = function (assert, done) {
  let requested = 0;
  let protocol = Protocol.extend({
    what: 'register' + new Date().getTime().toString(36),
    onRequest: function onRequest(request, response) {
      response.uri = 'data:text/html,hello ' + this.what
      requested ++;
    }
  });

  assert.throws(function() {
    readURI('about:' + protocol.what)();
  }, 'protocol is not register');

  let service = register(protocol);

  readURI('about:' + protocol.what)(function ({ responseText, status }) {
    assert.equal(status, 0, 'request was sucessful');

    unregister(service);

    assert.throws(function() {
      readURI('about:' + protocol.what)();
    }, 'protocol is unregistered');

    assert.equal(requested, 1, 'request was handled');
    done();
  });
};

exports["test about handler - redirect"] = function(assert, done) {
  let requested = 0;
  let protocol = Protocol.extend({
    what: 'redirect' + new Date().getTime().toString(36),
    onRequest: function onRequest(request, response) {
      response.uri = 'data:text/html,hello ' + this.what
      requested ++;
    }
  });
  let service = register(protocol);

  readURI('about:' + protocol.what)(function ({ responseText, status }) {
    assert.equal(status, 0, 'request was sucessful');
    assert.equal(responseText, 'hello ' + protocol.what,
                 'response content is correct');

    unregister(service);
    assert.equal(requested, 1, 'request was handled');
    done();
  });
};

exports["test about handler - async"] = function(assert, done) {
  let requested = 0;
  let protocol = Protocol.extend({
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

  let service = register(protocol);
  readURI('about:' + protocol.what)(function({ responseText, status }) {
    assert.equal(status, 0, 'request was sucessful');
    assert.equal(responseText, 'hello\n' + protocol.what,
                 'response content is correct');
    assert.equal(requested, 1, 'request was handled');

    unregister(service);
    done();
  });
};

require('test').run(exports);
