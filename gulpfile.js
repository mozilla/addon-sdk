/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var gulp = require('gulp');
var patch = require("./bin/node-scripts/apply-patch");
var ini = require("./bin/node-scripts/update-ini");
var test = require("./bin/jpm-test").run;
var Promise = require("promise");
var getFilters = require("./bin/node-scripts/last-commit-msg").getFilters;

var resolve = function() {
  return new Promise(function(resolve) {
    return resolve();
  });
}

gulp.task('travis', function(done) {
  var filters = {};
  var filtersExist = false;

  getFilters().
  then(function(f) {
    filters = f;
    filtersExist = Object.keys(filters).length > 0;
    return resolve();
  }).
  then(function() {
    if (filtersExist && !filters["addons"]) {
      return resolve();
    }

    return test("addons", {
      filter: filters["addons"]
    }).then(resolve);
  }).
  then(function() {
    if (filtersExist && !filters["examples"]) {
      return resolve();
    }

    return test("examples", {
      filter: filters["examples"]
    });
  }).
  then(function() {
    if (filtersExist) {
      return resolve();
    }

    return test("docs");
  }).
  then(function() {
    if (filtersExist && !filters["modules"]) {
      return resolve();
    }

    return test("modules", {
      filter: filters["modules"]
    });
  }).
  catch(console.error).then(done);
});

gulp.task('test', function(done) {
  test().then(done);
});

gulp.task('test:addons', function(done) {
  test("addons").catch(console.error).then(done);
});

gulp.task('test:docs', function(done) {
  test("docs").catch(console.error).then(done);
});

gulp.task('test:examples', function(done) {
  test("examples").catch(console.error).then(done);
});

gulp.task('test:modules', function(done) {
  test("modules").catch(console.error).then(done);
});

gulp.task('patch:clean', function(done) {
  patch.clean().catch(console.error).then(done);
});

gulp.task('patch:apply', function(done) {
  patch.apply().catch(console.error).then(done);
});

gulp.task('update:ini', function(done) {
  ini.updateAddonINI().catch(console.error).then(done);
});
