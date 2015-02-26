/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { utils: Cu } = Components;

// workers for windows in this tab
let keepAlive = new Map();

addMessageListener('sdk/worker/create', ({ data: { options, addon }}) => {
  options.manager = this;
  let { loader } = Cu.import(addon.paths[''] + 'framescript/LoaderHelper.jsm', {});
  let { WorkerChild } = loader(addon).require('sdk/content/worker-child');
  sendAsyncMessage('sdk/worker/attach', { id: options.id });
  keepAlive.set(options.id, new WorkerChild(options));
})

addMessageListener('sdk/worker/event', ({ data: { id, args: [event]}}) => {
  if (event === 'detach')
    keepAlive.delete(id);
})
