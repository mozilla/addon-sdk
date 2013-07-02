/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { Cc, Ci, Cu } = require('chrome');
const port = 8099;
const host = 'http://localhost:' + port;
const { once } = require('sdk/system/events');
const { defer } = require('sdk/core/promise');
const tabs = require('sdk/tabs');
try {
  const { getFavicon } = require('sdk/places/favicon');
  const { onFaviconChange, serve, binFavicon } = require('./favicon-helpers');
} catch (e) { unsupported(e); }

exports.testStringGetFaviconCallbackSuccess = function (assert, done) {
  let name = 'callbacksuccess';
  let srv = makeServer(name);
  let url = host + '/' + name + '.html';
  let favicon = host + '/' + name + '.ico';
  let tab = open(url);

  onFaviconChange(url, function (faviconUrl) {
    getFavicon(url, function (url) {
      assert.equal(favicon, url, 'Callback returns correct favicon url');
      complete(tab, srv, done);
    });
  });
};

exports.testStringGetFaviconCallbackFailure = function (assert, done) {
  let name = 'callbackfailure';
  let srv = makeServer(name);
  let url = host + '/' + name + '.html';
  let tab = open(url);

  waitAndExpire(url).then(function () {
    getFavicon(url, function (url) {
      assert.equal(url, null, 'Callback returns null');
      complete(tab, srv, done);
    });
  });
};

exports.testStringGetFaviconPromiseSuccess = function (assert, done) {
  let name = 'promisesuccess'
  let srv = makeServer(name);
  let url = host + '/' + name + '.html';
  let favicon = host + '/' + name + '.ico';
  let tab = open(url);

  onFaviconChange(url, function (faviconUrl) {
    getFavicon(url).then(function (url) {
      assert.equal(url, favicon, 'Callback returns null');
    }, function (err) {
      assert.fail('Reject should not be called');
    }).then(() => complete(tab, srv, done));
  });
};

exports.testStringGetFaviconPromiseFailure = function (assert, done) {
  let name = 'promisefailure'
  let srv = makeServer(name);
  let url = host + '/' + name + '.html';
  let tab = open(url);

  waitAndExpire(url).then(function () {
    getFavicon(url).then(invalidResolve(assert), validReject(assert, 'expired url'))
      .then(() => complete(tab, srv, done));
  });
};

exports.testTabsGetFaviconPromiseSuccess = function (assert, done) {
  let name = 'tabs-success'
  let srv = makeServer(name);
  let url = host + '/' + name + '.html';
  let favicon = host + '/' + name + '.ico';
  let tab = open(url);

  onFaviconChange(url, function () {
    tab.then(getFavicon).then(function (url) {
      assert.equal(url, favicon, "getFavicon should return url for tab");
      complete(tab, srv, done);
    }, console.error);
  });
};


exports.testTabsGetFaviconPromiseFailure = function (assert, done) {
  let name = 'tabs-failure'
  let srv = makeServer(name);
  let url = host + '/' + name + '.html';
  let tab = open(url);

  waitAndExpire(url).then(function () {
    tab.then(getFavicon)
      .then(invalidResolve(assert), validReject(assert, 'expired tab'))
      .then(() => complete(tab, srv, done));
  });
};

exports.testRejects = function (assert, done) {
  getFavicon({})
    .then(invalidResolve(assert), validReject(assert, 'Object'))
  .then(getFavicon(null))
    .then(invalidResolve(assert), validReject(assert, 'null'))
  .then(getFavicon(undefined))
    .then(invalidResolve(assert), validReject(assert, 'undefined'))
  .then(getFavicon([]))
    .then(invalidResolve(assert), validReject(assert, 'Array'))
    .then(done);
};

function invalidResolve (assert) {
  return function () assert.fail('Promise should not be resolved successfully');
}

function validReject (assert, name) {
  return function () assert.pass(name + ' correctly rejected');
}

function makeServer (name) {
  return serve({name: name, favicon: binFavicon, port: port, host: host});
}

function waitAndExpire (url) {
  let deferred = defer();
  let faviconService = Cc["@mozilla.org/browser/favicon-service;1"].
                         getService(Ci.nsIFaviconService);
  onFaviconChange(url, function () {
    once('places-favicons-expired', function () {
      deferred.resolve();
    });
    faviconService.expireAllFavicons();
  });
  return deferred.promise;
}

function open (url) {
  var deferred = defer();
  tabs.open({
    url: url,
    onOpen: function (tab) {
      deferred.resolve(tab);
    },
    inBackground: true
  });
  return deferred.promise;
}

function complete(tab, srv, done) {
  tab.then(realTab => realTab.close(() => srv.stop(done)));
}

// If the module doesn't support the app we're being run in, require() will
// throw.  In that case, remove all tests above from exports, and add one dummy
// test that passes.
function unsupported (err) {
  if (!/^Unsupported Application/.test(err.message))
    throw err;

  module.exports = {
    "test Unsupported Application": function Unsupported (assert) {
      assert.pass(err.message);
    }
  };
}
require("test").run(exports);
