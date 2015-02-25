/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { classes: Cc, interfaces: Ci } = Components;
const obsSvc = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);

const INTERACTIVE = Ci.nsISelectionListener.MOUSEUP_REASON |
                    Ci.nsISelectionListener.KEYPRESS_REASON |
                    Ci.nsISelectionListener.SELECTALL_REASON;

let selections = new WeakMap();
let isPrivate = docShell.QueryInterface(Ci.nsILoadContext).usePrivateBrowsing;

obsSvc.addObserver(observer, 'document-shown', false);
obsSvc.addObserver(observer, 'document-element-inserted', false);

function observer(subject, topic) {
  if (!docShell)
    obsSvc.removeObserver(observer, topic);
  else {
    let window = subject.defaultView;
    if (!window || window.top !== content)
      return;

    let selection = window.getSelection();
    if (!selection || selections.get(window) === selection)
      return;

    selections.set(window, selection);
    selection.addSelectionListener(listener);
    window.addEventListener('select', listener.onSelect, true);
  }
}

const listener = {
  notifySelectionChanged(_, selection, reason) {
    if ((reason & INTERACTIVE) && !!selection.toString())
      this.onSelect();
  },
  onSelect(_) {
    sendAsyncMessage('sdk/selection/event', { isPrivate });
  }
}
