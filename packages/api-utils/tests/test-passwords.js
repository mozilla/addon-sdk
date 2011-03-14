"use strict";

const { store, search, remove } = require("passwords/utils");

exports["test store requires `password` field"] = function(assert) {
  assert.throws(function() {
    store({ username: "foo", realm: "bar" });
  }, '`passowrd` is required');
};

exports["test store requires `username` field"] = function(assert) {
  assert.throws(function() {
    store({ passowrd: "foo", realm: "bar" });
  }, '`passowrd` is required');
};

exports["test store requires `realm` field"] = function(assert) {
  assert.throws(function() {
    store({ username: "foo", passowrd: "bar" });
  }, '`passowrd` is required');
};

exports["test can't store same login twice"] = function(assert) {
  let options = { username: "user", password: "pass", realm: "realm" };
  store(options);
  assert.throws(function() {
    store(options);
  }, "can't store same pass twice");
  remove(options);
};

exports["test remove throws if no login found"] = function(assert) {
  assert.throws(function() {
    remove({ username: "foo", password: "bar", realm: "baz" });
  }, "can't remove unstored credentials");
};

exports["test addon associated credentials"] = function(assert) {
  let options = { username: "foo", password: "bar", realm: "baz" };
  store(options);

  assert.ok(search().length, "credential was stored");
  assert.ok(search(options).length, "stored credential found");
  assert.ok(search({ username: options.username }).length, "found by username");
  assert.ok(search({ password: options.password }).length, "found by password");
  assert.ok(search({ realm: options.realm }).length, "found by realm");

  let credential = search(options)[0];
  assert.equal(credential.url.indexOf("jetpack:"), 0,
               "`jetpack:` uri is used for add-on associated credentials");
  assert.equal(credential.username, options.username, "username matches");
  assert.equal(credential.password, options.password, "password matches");
  assert.equal(credential.realm, options.realm, "realm matches");
  assert.equal(credential.formSubmitURL, null,
               "`formSubmitURL` is `null` for add-on associated credentials");
  assert.equal(credential.usernameField, "", "usernameField is empty");
  assert.equal(credential.passwordField, "", "passwordField is empty");

  remove(search(options)[0]);
  assert.ok(!search(options).length, "remove worked");
};

exports["test web page associated credentials"] = function(assert) {
  let options = {
    url: "http://foo.bar.com",
    formSubmitURL: "http://login.foo.bar.com",
    username: "user",
    password: "pass",
    usernameField: "user-f",
    passwordField: "pass-f"
  };
  store(options);

  assert.ok(search().length, "credential was stored");
  assert.ok(search(options).length, "stored credential found");
  assert.ok(search({ username: options.username }).length, "found by username");
  assert.ok(search({ password: options.password }).length, "found by password");
  assert.ok(search({ formSubmitURL: options.formSubmitURL }).length,
            "found by formSubmitURL");
  assert.ok(search({ usernameField: options.usernameField }).length,
            "found by usernameField");
  assert.ok(search({ passwordField: options.passwordField }).length,
            "found by passwordField");

  let credential = search(options)[0];
  assert.equal(credential.url, options.url, "url matches");
  assert.equal(credential.username, options.username, "username matches");
  assert.equal(credential.password, options.password, "password matches");
  assert.equal(credential.realm, null, "realm is ");
  assert.equal(credential.formSubmitURL, options.formSubmitURL,
               "`formSubmitURL` matches");
  assert.equal(credential.usernameField, options.usernameField,
               "usernameField matches");
  assert.equal(credential.passwordField, options.passwordField,
               "passwordField matches");

  remove(search(options)[0]);
  assert.ok(!search(options).length, "remove worked");
};

require("test").run(exports);
