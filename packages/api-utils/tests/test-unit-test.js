const timer = require("timer");

exports.testModuleOverrides = function(test) {
  var options = {
    moduleOverrides: {
      'unit-test': {
        foo: 5
      }
    }
  };
  var loader = test.makeSandboxedLoader(options);
  test.assertEqual(loader.require('unit-test').foo, 5,
                   "options.moduleOverrides works");
  loader.unload();
};

exports.testWaitUntilInstant = function(test) {
  test.waitUntilDone();
  
  test.waitUntil(function () true, "waitUntil with instant true pass")
      .then(function () test.done());
}

exports.testWaitUntil = function(test) {
  test.waitUntilDone();
  let succeed = false;
  
  test.waitUntil(function () succeed, "waitUntil pass")
      .then(function () test.done());
  
  timer.setTimeout(function () {
    succeed = true;
  }, 200);
}

exports.testWaitUntilEqual = function(test) {
  test.waitUntilDone();
  let succeed = false;
  
  test.waitUntilEqual("foo", function () succeed ? "foo" : "bar", 
                      "waitUntilEqual pass")
      .then(function () test.done());
  
  timer.setTimeout(function () {
    succeed = true;
  }, 200);
}

exports.testWaitUntilNotEqual = function(test) {
  test.waitUntilDone();
  let succeed = false;
  
  test.waitUntilNotEqual("foo", function () succeed ? "bar" : "foo",
                         "waitUntilNotEqual pass")
      .then(function () test.done());
  
  timer.setTimeout(function () {
    succeed = true;
  }, 200);
}

exports.testWaitUntilMatches = function(test) {
  test.waitUntilDone();
  let succeed = false;
  
  test.waitUntilMatches(function () succeed ? "foo" : "bar",
                        /foo/, "waitUntilEqual pass")
      .then(function () test.done());
  
  timer.setTimeout(function () {
    succeed = true;
  }, 200);
}
