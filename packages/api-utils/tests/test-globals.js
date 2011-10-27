exports.testGlobals = function(test) {
  test.assertMatches(module.uri, /test-globals\.js$/,
                     'should contain filename');

  test.assertEqual(typeof console, 'object', 'should define console');
  test.assertEqual(typeof memory, 'object', 'should define memory');
};
