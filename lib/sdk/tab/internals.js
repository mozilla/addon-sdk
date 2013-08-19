/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

module.metadata = {
  'stability': 'experimental'
};

const { method} = require('method/core');
const { tabNS, rawTabNS } = require('../tabs/namespace');

const getRawTab = exports.getRawTab = method('getRawTab');
getRawTab.define(function getRawTab(thing) {
  let ns = tabNS(thing);
  return (ns && ns.tab) || null;
});

const getSDKTab = exports.getSDKTab = method('getSDKTab');
getSDKTab.define(function getSDKTab(thing) {
  let ns = rawTabNS(thing);
  return (ns && ns.tab) || null;
});
