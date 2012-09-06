/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { readURI, readURISync } = require("api-utils/url/io");
const { data } = require("self");
const { Cc, Ci } = require('chrome');

const WM = Cc['@mozilla.org/appshell/window-mediator;1'].
               getService(Ci.nsIWindowMediator);

const utf8text = 'Hello, ゼロ!\n';
const latin1text = 'Hello, ã‚¼ãƒ­!\n';

exports["test async readURI"] = function(assert, done) {
  let content = "";

  readURI(data.url("test-uri-io.txt")).then(function(data) {
    content = data;
    assert.equal(data, utf8text, "The URL content is loaded properly");
    done();
  }, function() {
    assert.fail("should not reject");
    done();
  })

  assert.equal(content, "", "The URL content is not load yet");
}

exports["test sync readURI"] = function(assert) {
  let content = "";

  readURI(data.url("test-uri-io.txt"), { sync: true }).then(function(data) {
    content = data;
  }, function() {
    assert.fail("should not reject");
  })

  assert.equal(content, utf8text, "The URL content is loaded properly");
}

exports["test readURISync"] = function(assert) {
  let content = readURISync(data.url("test-uri-io.txt"));

  assert.equal(content, utf8text, "The URL content is loaded properly");
}

exports["test async readURI with ISO-8859-1 charset"] = function(assert, done) {
  let content = "";

  readURI(data.url("test-uri-io.txt"), { charset : "ISO-8859-1"}).then(function(data) {
    content = data;
    assert.equal(data, latin1text, "The URL content is loaded properly");
    done();
  }, function() {
    assert.fail("should not reject");
    done();
  })

  assert.equal(content, "", "The URL content is not load yet");
}

exports["test sync readURI with ISO-8859-1 charset"] = function(assert) {
  let content = "";

  readURI(data.url("test-uri-io.txt"), { 
    sync: true,
    charset: "ISO-8859-1"
  }).then(function(data) {
    content = data;
  }, function() {
    assert.fail("should not reject");
  });

  assert.equal(content, latin1text, "The URL content is loaded properly");
}

exports["test readURISync with ISO-8859-1 charset"] = function(assert) {
  let content = readURISync(data.url("test-uri-io.txt"), "ISO-8859-1");

  assert.equal(content, latin1text, "The URL content is loaded properly");
}

exports["test async readURI with not existing file"] = function(assert, done) {
  readURI(data.url("test-uri-io-fake.txt")).then(function(data) {
    assert.fail("should not resolve");
    done();
  }, function(reason){
    assert.ok(reason.indexOf("Failed to read:") === 0);
    done();
  })
}

exports["test sync readURI with not existing file"] = function(assert) {
  readURI(data.url("test-uri-io-fake.txt"), { sync: true }).then(function(data) {
    assert.fail("should not resolve");
  }, function(reason){
    assert.ok(reason.indexOf("Failed to read:") === 0);
  })
}

exports["test readURISync with not existing file"] = function(assert) {
  assert.throws(function(){
    readURISync(data.url("test-uri-io-fake.txt"));
  }, /NS_ERROR_FILE_NOT_FOUND/);
}

exports['test chrome URI sync'] = function(assert) {
  let { location } = WM.getMostRecentWindow('navigator:browser');
  let content = readURISync(location);
  assert.ok(content, 'chrome URI is read correctly');
}

exports['test chrome URI sync with not existing file'] = function(assert) {
  let { location } = WM.getMostRecentWindow('navigator:browser');
  readURI(location + '_fail', {sync: true}).then(function() {
    asert.fail('fail file should not be found');
  }, function() {
    assert.ok(true, 'bad chrome URI did not read');
  });
}

exports['test chrome URI async'] = function(assert, done) {
  let { location } = WM.getMostRecentWindow('navigator:browser');
  readURI(location).then(function(data) {
    assert.equal(data, readURISync(location), 'chrome URI was read');
    done();
  }, function() {
    asert.fail('fail file should be found');
    done();
  });
}

exports['test chrome URI async with not existing file'] = function(assert, done) {
  let { location } = WM.getMostRecentWindow('navigator:browser');
  readURI(location + '_fail').then(function() {
    asert.fail('fail file should not be found');
    done();
  }, function() {
    assert.ok(true, 'bad chrome URI did not read');
    done();
  });
}

require('test').run(exports);
