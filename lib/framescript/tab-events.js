/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const observerSvc = Components.classes["@mozilla.org/observer-service;1"].
                    getService(Components.interfaces.nsIObserverService);

const LOADER = sendSyncMessage('sdk/loader/helper')[0];

// map observer topics to tab event names
const EVENTS = {
  'content-document-interactive': 'ready',
  'chrome-document-interactive': 'ready',
  'content-document-loaded': 'load',
  'chrome-document-loaded': 'load',
// 'content-page-shown': 'pageshow', // bug 1024105
}

function listener(subject, topic) {
  // observer service keeps a strong reference to the listener, and this
  // method can get called after the tab is closed, so we should remove it.
  if (!docShell)
    observerSvc.removeObserver(listener, topic);
  else if (subject === content.document)
    sendAsyncMessage('sdk/tab/event', { type: EVENTS[topic] });
}

for (let topic in EVENTS)
  observerSvc.addObserver(listener, topic, false);

// bug 1024105 - content-page-shown notification doesn't pass persisted param
addEventListener('pageshow', ({ target, type, persisted }) => {
  if (target === content.document)
    sendAsyncMessage('sdk/tab/event', { type, persisted });
}, true);

// workers for windows in this tab
let keepAlive = {};

addMessageListener('sdk/worker/create', ({ data: { options, addon }}) => {
  let { loader } = Components.utils.import(LOADER, {});
  options.manager = this;
  sendAsyncMessage('sdk/worker/attach', { id: options.id });
  const { WorkerChild } = loader(addon).require('sdk/content/worker-child');
  keepAlive[options.id] = WorkerChild(options);
})

addMessageListener('sdk/worker/event', ({ data: { id, args: [event]}}) => {
  if (event === 'detach')
    delete keepAlive[id];
})
