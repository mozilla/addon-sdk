const { Loader } = require("./helpers");

exports.testLoader = function(test) {
  var prints = [];
  function print(message) {
    prints.push(message);
  }

  var loader = Loader(module, { dump: print, foo: 1 });

  var fixture = loader.require('./loader/fixture');

  test.assertEqual(fixture.foo, 1, "custom globals must work.");

  test.assertEqual(prints[0], "info: testing 1 2,3,4\n",
                   "global console must work.");

  var unloadsCalled = '';

  loader.require("unload").when(function() {
    unloadsCalled += 'a';
  });
  loader.require("unload.js").when(function() {
    unloadsCalled += 'b';
  });

  loader.unload();

  test.assertEqual(unloadsCalled, 'ba',
                   "loader.unload() must call cb's in LIFO order.");
};
