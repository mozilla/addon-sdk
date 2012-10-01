/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

let chrome = require('chrome');


exports['test ChromeWorker'] = function(assert, done) {
  let uri = module.uri.substr(0, module.uri.lastIndexOf('/') + 1) +
            'fixtures/chrome-worker.js';

  let worker = new chrome.ChromeWorker(uri);
  worker.addEventListener('message', function(event) {
    assert.equal(event.data, 'Hello', 'message received');
    worker.terminate();
    done();
  });
};

require('test').run(exports);
