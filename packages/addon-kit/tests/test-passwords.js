"use strict";

const { store, search, remove } = require("passwords");

exports["test store requires `password` field"] = function(assert, done) {
  store({
    username: "foo",
    realm: "bar",
    onComplete: function onComplete() {
      assert.fail("onComplete should not be called");
    },
    onError: function onError() {
      assert.pass("'`password` is required");
      done();
    }
  });
};

exports["test store requires `username` field"] = function(assert, done) {
  store({
    password: "foo",
    realm: "bar",
    onComplete: function onComplete() {
      assert.fail("onComplete should not be called");
    },
    onError: function onError() {
      assert.pass("'`username` is required");
      done();
    }
  });
};

exports["test store requires `realm` field"] = function(assert, done) {
  store({
    username: "foo",
    password: "bar",
    onComplete: function onComplete() {
      assert.fail("onComplete should not be called");
    },
    onError: function onError() {
      assert.pass("'`realm` is required");
      done();
    }
  });
};

exports["test can't store same login twice"] = function(assert, done) {
  store({
    username: "user",
    password: "pass",
    realm: "realm",
    onComplete: function onComplete() {
      assert.pass("credential saved");

      store({
        username: "user",
        password: "pass",
        realm: "realm",
        onComplete: function onComplete() {
          assert.fail("onComplete should not be called");
        },
        onError: function onError() {
          assert.pass("re-saving credential failed");

          remove({
            username: "user",
            password: "pass",
            realm: "realm",
            onComplete: function onComplete() {
              assert.pass("credential was removed");
              done();
            },
            onError: function onError() {
              assert.fail("remove should not fail");
            }
          });
        }
      });
    },
    onError: function onError() {
      assert.fail("onError should not be called");
    }
  });
};

require("test").run(exports);
