<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

The `test/utils` module provides additional helper methods to be used in the CommonJS Unit Testing test suite.

## Before and After

Helper functions `before` and `after` are available for running a function before or after each test in a suite. Useful for when asynchronous cleanup is required between tests, and unsure of state changes from previous tests.

    let { before, after } = require('sdk/test/utils');
    let { search } = require('sdk/places/bookmarks');

    exports.testCountBookmarks = function (assert, done) {
      search().on('end', function (results) {
        assert.equal(results, 0, 'should be no bookmarks');
        done();
      });
    };

    before(exports, function (name, assert) {
      removeAllBookmarks();
    });

    require('sdk/test').run(exports);

Both `before` and `after` may be asynchronous, provided that a third argument is used in the function passed in.

    let { before, after } = require('sdk/test/utils');
    let { search } = require('sdk/places/bookmarks');

    exports.testCountBookmarks = function (assert, done) {
      search().on('end', function (results) {
        assert.equal(results, 0, 'should be no bookmarks');
        done();
      });
    };

    before(exports, function (name, assert, done) {
      removeAllBookmarksAsync(function () {
        done();
      });
    });

    require('sdk/test').run(exports);

<api name="before">
@function
  Runs `beforeFn` before each test in the file. May be asynchronous if `beforeFn` accepts a third argument of a callback.

 @param exports {Object}
    A test file's `exports` object
 @param beforeFn {Function}
    The function to be called before each test. It is called with the
    first argument being a `String` of the test's name, followed by the
    second argument being the `assert` object for the test.
    Optionally takes a third callback argument.
    If the callback is defined, then the `beforeFn` is considered
    asynchronous, and the callback must eventually be invoked
    before each test runs.
</api>

<api name="after">
@function
  Runs `afterFn` after each test in the file. May be asynchronous if `afterFn` accepts a third argument of a callback.

 @param exports {Object}
    A test file's `exports` object
 @param afterFn {Function}
    The function to be called after each test. It is called with the
    first argument being a `String` of the test's name, followed by the
    second argument being the `assert` object for the test.
    Optionally takes a third callback argument.
    If the callback is defined, then `afterFn` is considered
    asynchronous, and the callback must eventually be invoked
    after each test runs.
</api>

