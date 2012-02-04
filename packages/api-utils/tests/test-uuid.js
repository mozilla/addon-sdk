"use strict";

const { uuid } = require('api-utils/uuid');

exports['test uuid'] = function(assert) {
  let signature = /{[0-9a-f\-]+}/
  let first = String(uuid());
  let second = String(uuid());

  assert.ok(signature.test(first), 'first guid has a correct signature');
  assert.ok(signature.test(second), 'second guid has a correct signature');
  assert.notEqual(first, second, 'guid generates new guid on each call');
};

require('test').run(exports);
