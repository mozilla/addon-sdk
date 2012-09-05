/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

function Worker(options, window) {
  let { Worker } = require('api-utils/content/worker');
  options.window = window;

  let worker = Worker(options);
  worker.once("detach", function detach() {
    worker.destroy();
  });
  return worker;
}
exports.Worker = Worker;