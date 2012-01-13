/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


function setLibraryInfo(element) {
  self.port.emit('setLibraryInfo', element.target.title);
}

var elements = document.getElementsByTagName('img');

for (var i = 0; i < elements.length; i++) {
  elements[i].addEventListener('mouseover', setLibraryInfo, false);
}
