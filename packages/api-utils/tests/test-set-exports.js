
let four = require("set-exports");

exports.testSet = function(test) {
  test.assertEqual(four, 4);
}

exports.testModule = function(test) {
  // module.id is not cast in stone yet. For now, it's just the module name.
  // In the future, it may include the package name too, or may possibly be a
  // URL of some sort.
  test.assertEqual(module.id, "test-set-exports")
}
