exports.testGlobals = function(test) {
  // the only globals in module scope should be:
  //   module, exports, require, dump, console
  test.assertEqual(typeof(module), "object", "have 'module', good");
  test.assertEqual(typeof(exports), "object", "have 'exports', good");
  test.assertEqual(typeof(require), "function", "have 'require', good");
  test.assertEqual(typeof(dump), "function", "have 'dump', good");
  test.assertEqual(typeof(console), "object", "have 'console', good");

  // in particular, these old globals should no longer be present
  test.assertEqual(typeof(packaging), "undefined", "no 'packaging', good");
  //test.assertEqual(typeof(memory), "undefined", "no 'memory', good"); // bug 620559

  test.assertMatches(module.uri, /test-globals\.js$/,
                     'should contain filename');

  test.assertEqual(typeof memory, 'object', 'should define memory');
};
