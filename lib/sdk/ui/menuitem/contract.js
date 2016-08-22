/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { contract } = require('../../util/contract');
const { isValidURI, URL, isLocalURL } = require('../../url');
const { isNil, isObject, isString } = require('../../lang/type');

exports.contract = contract({
  label: {
    is: [ 'string' ],
    ok: v => v.length
  },
  menu: {
    is: [ 'array' ],
    ok: v => v.length,
    msg: 'The option "menu" must be an array with some MENU constants.'
  },
  disabled: {
    is: [ 'boolean', 'undefined' ]
  }
});
