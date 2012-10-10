/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

let { Loader, main, unload } = require('api-utils/loader');

exports['test dependency cycles'] = function(assert) {
  let uri = module.uri.substr(0, module.uri.lastIndexOf('/')) +
            '/fixtures/loader/cycles/'

  let loader = Loader({
    paths: { '': uri }
  });

  let program = main(loader, 'main')

  assert.equal(program.a.b, program.b, 'module `a` gets correct `b`')
  assert.equal(program.b.a, program.a, 'module `b` gets correct `a`')
  assert.equal(program.c.main, program, 'module `c` gets correct `main`')

  unload(loader);
};

require('test').run(exports);

