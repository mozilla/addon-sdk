/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

let { defer, promise, future, failure } = require("api-utils/promise");

exports['test all observers are notified'] = function(assert, done) {
  let expected = 'Taram pam param!';
  let { promise, resolve } = defer();
  let pending = 10, i = 0

  function resolved(value) {
    assert.equal(value, expected, 'value resoved as expected: #' + pending);
    if (!--pending) done();
  }

  while (i++ < pending) promise.then(resolved);

  resolve(expected);
};

exports['test exceptions dont stop nitifactions'] = function(assert, done) {
  let threw = false, boom = Error('Boom!');
  let { promise, resolve } = defer();

  let promise2 = promise.then(function() {
    threw = true;
    throw boom;
  });

  promise.then(function() {
    assert.ok(threw, 'observer is called even though previos one threw')
    promise2.then(function() {
      assert.fail('should not resolve');
    }, function(reason) {
      assert.equal(reason, boom, 'rejects to thrown error');
      done();
    });
  });

  resolve('go!');
};

exports['test subsequent resolves are ignored'] = function(assert, done) {
  let { promise, resolve, reject } = defer();
  resolve(1);
  resolve(2);
  reject(3);

  promise.then(function(actual) {
    assert.equal(actual, 1, 'resolves to firts value');
  }, function() {
    assert.fail('must not reject');
  });
  promise.then(function(actual) {
    assert.equal(actual, 1, 'subsequent resolutions are ignored');
    done();
  }, function() {
    assert.fail('must not reject');
  });
};

exports['test subsequent rejections are ignored'] = function(assert, done) {
   let { promise, resolve, reject } = defer();
  reject(1);
  resolve(2);
  reject(3);

  promise.then(function(actual) {
    assert.fail('must not resolve');
  }, function(actual) {
    assert.equal(actual, 1, 'must reject to first');
  });
  promise.then(function(actual) {
    assert.fail('must not resolve');
  }, function(actual) {
    assert.equal(actual, 1, 'must reject to first');
    done();
  });
};

exports['test error recovery'] = function(assert, done) {
  let error = Error('Boom!');
  let { promise, reject } = defer();

  promise.then(function() {
    assert.fail('rejected promise should not resolve');
  }, function(reason) {
    assert.equal(reason, error, 'rejection reason delivered');
    return 'recovery';
  }).then(function(value) {
    assert.equal(value, 'recovery', 'error handled by a handler');
    done();
  });

  reject(error);
};


exports['test falure recovery with promise'] = function(assert, done) {
  let { promise, reject } = defer();

  promise.then(function() {
    assert.fail('must rejcet');
  }, function(actual) {
    assert.equal(actual, 'reason', 'rejected');
    let { promise, resolve } = defer();
    resolve('recovery');
    return promise;
  }).then(function(actual) {
    assert.equal(actual, 'recovery', 'recorvered via promise');
    let { promise, reject } = defer();
    reject('error')
    return promise;
  }).then(null, function(actual) {
    assert.equal(actual, 'error', 'rejected via promise')
    let { promise, reject } = defer();
    reject('end');
    return promise;
  }).then(null, function(actual) {
    assert.equal(actual, 'end', 'rejeced via promise')
    done()
  });

  reject('reason');
};

exports['test propagation'] = function(assert, done) {
  let { promise, resolve } = defer(), d2 = defer(), d3 = defer();

  promise.then(function(actual) {
    assert.equal(actual, 'expected', 'resolves to expecetd value');
    done();
  });

  resolve(d2.promise)
  d2.resolve(d3.promise)
  d3.resolve('expected');
};

exports['test chaining'] = function(assert, done) {
  let boom = Error('boom'), brax = Error('braxXXx');
  let { promise, resolve } = defer();

  promise.then().then().then(function(actual) {
    assert.equal(actual, 2, 'value propagets unchanged');
    return actual + 2;
  }).then(null, function(reason) {
    assert.fail('should not reject');
  }).then(function(actual) {
    assert.equal(actual, 4, 'value propagets through if not handled');
    throw boom;
  }).then(function(actual) {
    assert.fail('exception must reject promise');
  }).then().then(null, function(actual) {
    assert.equal(actual, boom, 'reason propagets unchanged');
    throw brax;
  }).then().then(null, function(actual) {
    assert.equal(actual, brax, 'reason changed becase of exception');
    return 'recovery';
  }).then(function(actual) {
    assert.equal(actual, 'recovery', 'recorverd from error');
    done();
  });

  resolve(2);
};


exports['test failure'] = function(assert, done) {
  let expected = Error('boom');

  failure(expected).then(function() {
    assert.fail('should reject');
  }, function(actual) {
    assert.equal(actual, expected, 'rejected with expected reason');
  }).then(function() {
    done();
  });
};

exports['test resovel in failure'] = function(assert, done) {
  let expected = Error('boom');
  let { promise, resolve } = defer();

  promise.then(function() {
    assert.fail('should reject');
  }, function(actual) {
    assert.equal(actual, expected, 'rejected with expected failure');
  }).then(function() {
    done()
  });

  resolve(failure(expected));
};

exports['test promise'] = function(assert, done) {
  var expected = 'value'
  promise(expected).then(function(actual) {
    assert.equal(actual, expected, 'resolved as expected');
  }).then(function() {
    done();
  });
};

exports['test future'] = function(assert, done) {
  future(function(x) {
    return x + 2
  }, 10).then(function(actual) {
    assert.equal(actual, 12, 'resolves as expected');
    done();
  });
};

exports['test future error handleing'] = function(assert, done) {
  var expected = Error('boom');
  future(function() {
    throw expected;
  }).then(function() {
    assert.fail('should reject');
  }, function(actual) {
    assert.equal(actual, expected, 'rejected as expected');
    done();
  });
};

exports['test pass promise to future'] = function(assert, done) {
  future(function(value) {
    return value + 7
  }, promise(10)).then(function(actual) {
    assert.equal(actual, 17, 'resolved to an expected value');
    done();
  });
};

exports['test return promise form future'] = function(assert, done) {
  future(function() {
    return promise(17);
  }).then(function(actual) {
    assert.equal(actual, 17, 'resolves to a promise resolution');
    done();
  });
};

exports['test future returning failure'] = function(assert, done) {
  let expected = Error('boom')
  future(function() {
    return failure(expected);
  }).then(function() {
    assert.fail('must reject');
  }, function(actual) {
    assert.equal(actual, expected, 'rejects with expected reason');
    done();
  });
};

exports['test futures are greedy'] = function(assert, done) {
  let runs = 0, promise = future(function() { ++runs; });
  assert.equal(runs, 1, 'future runs task right away');
  done();
};

exports['test lazy futurues are lazy'] = function(assert, done) {
  let runs = 0, promise = future.lazy(function() { ++runs; });
  assert.equal(runs, 0, 'lazy future runs on demand');
  promise.then(function() {
    assert.equal(runs, 1, 'lazy future runs task when required');
    promise.then();
    assert.equal(runs, 1, 'lazy future runs task only once');
    done();
  });
};

require("test").run(exports);

