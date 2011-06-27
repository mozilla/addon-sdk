var array = require("array");

exports.testHas = function(test) {
  var testAry = [1, 2, 3];
  test.assertEqual(array.has([1, 2, 3], 1), true);
  test.assertEqual(testAry.length, 3);
  test.assertEqual(testAry[0], 1);
  test.assertEqual(testAry[1], 2);
  test.assertEqual(testAry[2], 3);
  test.assertEqual(array.has(testAry, 2), true);
  test.assertEqual(array.has(testAry, 3), true);
  test.assertEqual(array.has(testAry, 4), false);
  test.assertEqual(array.has(testAry, "1"), false);
};

exports.testAdd = function(test) {
  var testAry = [1];
  test.assertEqual(array.add(testAry, 1), false);
  test.assertEqual(testAry.length, 1);
  test.assertEqual(testAry[0], 1);
  test.assertEqual(array.add(testAry, 2), true);
  test.assertEqual(testAry.length, 2);
  test.assertEqual(testAry[0], 1);
  test.assertEqual(testAry[1], 2);
};

exports.testRemove = function(test) {
  var testAry = [1, 2];
  test.assertEqual(array.remove(testAry, 3), false);
  test.assertEqual(testAry.length, 2);
  test.assertEqual(testAry[0], 1);
  test.assertEqual(testAry[1], 2);
  test.assertEqual(array.remove(testAry, 2), true);
  test.assertEqual(testAry.length, 1);
  test.assertEqual(testAry[0], 1);
};
