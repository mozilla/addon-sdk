/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "experimental"
};

// Takes DOM `element` and returns promise which is resolved
// when given element is removed from it's parent node.
const removed = element => {
  return new Promise(resolve => {
    const { MutationObserver } = element.ownerDocument.defaultView;
    const observer = new MutationObserver(mutations => {
      for (let mutation of mutations) {
        for (let node of mutation.removedNodes || []) {
          if (node === element) {
            observer.disconnect();
            resolve(element);
          }
        }
      }
    });
    observer.observe(element.parentNode, {childList: true});
  });
};
exports.removed = removed;

const when = (eventName, element, capture=false) => new Promise(resolve => {
  const listener = event => {
    element.removeEventListener(eventName, listener, capture);
    resolve(event);
  };

  element.addEventListener(eventName, listener, capture);
});
exports.when = when;
