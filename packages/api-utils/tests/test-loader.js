const { Loader } = require("@loader");
const options = require("@packaging");

exports.testLoader = function(test) {
  var prints = [];
  function print(message) {
    prints.push(message);
  }

  var loader = Loader.new(Object.create(options, {
                          globals: { value: { dump: print, foo: 1 } } }));

  var require = loader.require.bind(loader, module.uri);

  var fixture = require('./loader/fixture');

  test.assertEqual(fixture.foo, 1, "custom globals must work.");

  test.assertEqual(prints[0], "info: testing 1 2,3,4\n",
                   "global console must work.");

  var unloadsCalled = '';

  require("unload").when(function() {
    unloadsCalled += 'a';
  });
  require("unload.js").when(function() {
    unloadsCalled += 'b';
  });

  loader.unload();

  test.assertEqual(unloadsCalled, 'ba',
                   "loader.unload() must call cb's in LIFO order.");
};
