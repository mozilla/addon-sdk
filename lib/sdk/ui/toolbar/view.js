/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

function create(window, details) {
  let { document } = window;
  let navtoolbox = document.getElementById('navigator-toolbox');
  let oldData = JSON.parse(navtoolbox.getAttribute('data-sdk-toolbars') || '{}');
  oldData[details.id] = oldData[details.id] || {};
  oldData[details.id].collapsed = oldData[details.id].collapsed || false;
  navtoolbox.setAttribute('sdk-toolbars', JSON.stringify(oldData));

  let toolbar = document.createElementNS(NS_XUL, 'toolbar');
  toolbar.setAttribute('id', details.id);
  toolbar.setAttribute('style', 'max-height: 40px;');
  toolbar.setAttribute('mode', 'full');
  toolbar.setAttribute('iconsize', 'small');
  toolbar.setAttribute('toolbarname', details.title);
  toolbar.setAttribute('context', 'toolbar-context-menu');
  toolbar.setAttribute('collapsed', oldData[details.id].collapsed);
  toolbar.setAttribute('customizable', 'true');

  let browser = document.createElementNS(NS_XUL, 'iframe');
  browser.setAttribute('type', 'content');
  browser.setAttribute('transparent', 'transparent');
  browser.setAttribute('style', 'overflow: hidden;')
  browser.setAttribute('disablehistory', 'true');
  browser.setAttribute('flex', '1');
  browser.setAttribute('clickthrough', 'never');
  browser.setAttribute('src', details.url);

  let closeButton = document.createElementNS(NS_XUL, 'toolbarbutton');
  closeButton.setAttribute('class', 'close-icon tabs-closebutton');
  //closeButton.setAttribute('style', 'right: 0;');
  closeButton.addEventListener('command', function() {
    toolbar.collapsed = true;
  }, false);

  // add the toolbar item to the window
  navtoolbox.appendChild(toolbar);
  toolbar.appendChild(browser);
  toolbar.appendChild(closeButton);

  return {
  	browser: browser,
  	toolbar: toolbar,
    closeButton: closeButton
  }
}
exports.create = create;
