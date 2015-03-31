/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var fs = require("fs");
var path = require("path");
var Promise = require("promise");
var chai = require("chai");
var expect = chai.expect;
var teacher = require("teacher");

var rootURI = path.join(__dirname, "..", "..");

// get a list of words that fail spell check but are still acceptable
var NEW_WORDS = fs.readFileSync(path.join(__dirname, "words.txt")).toString().trim().split("\n");

describe("Spell Checking", function () {

  it("Spellcheck CONTRIBUTING.md", function (done) {
   var readme = path.join(rootURI, "CONTRIBUTING.md");

    fs.readFile(readme, function (err, data) {
      if (err) {
        throw err;
      }
      var text = data.toString();

      teacher.check(text, function(err, data) {
        expect(err).to.be.equal(null);

        var results = data || [];
        results = results.filter(function(result) {
          if (NEW_WORDS.indexOf(result.string.toLowerCase()) != -1) {
            return false;
          }

          // ignore anything that starts with a dash
          if (result.string[0] == "-") {
            return false;
          }

          if (!(new RegExp(result.string)).test(text)) {
            return false;
          }

          return true;
        })

        if (results.length > 0) {
          console.log(results);
        }
        expect(results.length).to.be.equal(0);

        setTimeout(done, 500);
      });
    });
  });

  it("Spellcheck README.md", function (done) {
   var readme = path.join(rootURI, "README.md");

    fs.readFile(readme, function (err, data) {
      if (err) {
        throw err;
      }
      var text = data.toString();

      teacher.check(text, function(err, data) {
        expect(err).to.be.equal(null);

        var results = data || [];
        results = results.filter(function(result) {
          if (NEW_WORDS.indexOf(result.string.toLowerCase()) != -1) {
            return false;
          }

          // ignore anything that starts with a dash
          if (result.string[0] == "-") {
            return false;
          }

          // ignore anything that we don't find in the original text,
          // for some reason "bootstrap.js" becomes "bootstrapjs".
          if (!(new RegExp(result.string)).test(text)) {
            return false;
          }

          return true;
        })

        if (results.length > 0) {
          console.log(results);
        }
        expect(results.length).to.be.equal(0);

        done();
      });
    });
  });
});
