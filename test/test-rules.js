/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { Rules } = require('sdk/util/rules');
const { MatchPattern } = require('sdk/util/match-pattern');
const { on, off, emit } = require('sdk/event/core');
const { has } = require('sdk/util/array');

exports.testAdd = function (test, done) {
  let rules = Rules();
  let urls = [
    'http://www.firefox.com',
    '*.mozilla.org',
    '*.html5audio.org'
  ];
  let count = 0;
  on(rules, 'add', function (rule) {
    if (count < urls.length) {
      test.ok(rules.get(rule), 'rule added to internal registry');
      test.equal(rule, urls[count], 'add event fired with proper params');
      if (++count < urls.length) rules.add(urls[count]);
      else done();
    }
  });
  rules.add(urls[0]);
};

exports.testRemove = function (test, done) {
  let rules = Rules();
  let urls = [
    'http://www.firefox.com',
    '*.mozilla.org',
    '*.html5audio.org'
  ];
  let count = 0;
  on(rules, 'remove', function (rule) {
    if (count < urls.length) {
      test.ok(!rules.get(rule), 'rule removed to internal registry');
      test.equal(rule, urls[count], 'remove event fired with proper params');
      if (++count < urls.length) rules.remove(urls[count]);
      else done();
    }
  });
  urls.forEach(function (url) rules.add(url));
  rules.remove(urls[0]);
};

exports.testGet = function (test) {
  let rules = Rules();
  let url = 'http://www.mozilla.org';

  rules.add(url);
  test.equal(rules.get(url).test(url), true, 'get returns the MatchPattern');
  test.equal(rules.get('http://norule'), undefined, 'get returns undefined if not found');
}

exports.testMatchesAny = function(test) {
  let rules = Rules();
  rules.add('*.mozilla.org');
  rules.add('data:*');
  matchTest('http://mozilla.org', true);
  matchTest('http://www.mozilla.org', true);
  matchTest('http://www.google.com', false);
  matchTest('data:text/html;charset=utf-8,', true);

  function matchTest(string, expected) {
    test.equal(rules.matchesAny(string), expected,
      'Expected to find ' + string + ' in rules');
  }
};

exports.testToArray = function(test) {
  let rules = Rules();
  rules.add('*.mozilla.org');
  rules.add('data:*');
  rules.add('http://google.com');
  rules.add('http://addons.mozilla.org');
  rules.remove('http://google.com');

  let array = rules.toArray();
  test.equal(array.length, 3, 'has correct length of keys');
  test.ok(has(array, '*.mozilla.org'));
  test.ok(has(array, 'data:*'));
  test.ok(has(array, 'http://addons.mozilla.org'));
};

exports.testForEach = function (test) {
  let rules = Rules();
  let urls = [
    'http://www.mozilla.org',
    '*.mozilla.org',
    '*'
  ];
  urls.forEach(function (url) { rules.add(url); });
  let count = 0;

  rules.forEach(function (rule, pattern) {
    test.ok(pattern.test('http://www.mozilla.org'), 'passes in pattern');
    test.ok(has(urls, rule), 'passes in rule');
    if (count++ >= urls.length) test.fail('Extra iterations');
  });
  test.equal(count, urls.length, 'all rules have been itereated over');
};

require('test').run(exports);
