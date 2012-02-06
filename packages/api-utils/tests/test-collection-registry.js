'use strict';

const { register, unregister, get, has, registry  } = require('api-utils/collections/registry');

exports['test registry'] = function(assert) {
  let r1 = registry({});
  let v1 = {}, v2 = {};
  let id1 = register(r1, v1), id2 = register(r1, v1), id3 = register(r1, v2);

  assert.equal(typeof(id1), 'string', 'register returns string id1');
  assert.equal(typeof(id2), 'string', 'register returns string id2');
  assert.equal(typeof(id3), 'string', 'register returns string id3');

  assert.notEqual(id1, id2, 'registers element with new id each time');
  assert.notEqual(id1, id3, 'id is always unique');

  assert.equal(has(r1, id1), true, 'element is registered');
  assert.equal(get(r1, id1), v1, 'element is associated with returned id');
  assert.equal(get(r1, id1), get(r1, id2),
               'element can be registered many times');
  assert.equal(unregister(r1, id1), undefined, 'unregister element');
  assert.equal(has(r1, id1), false, 'element is unregistered');
  assert.equal(get(r1, id2), v1,
               'unregistratino of element does not affects other same elemens');

  assert.equal(get(r1, id3), v2, 'element is registered');
};

require("test").run(exports);
