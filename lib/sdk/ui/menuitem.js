/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

module.metadata = {
  'stability': 'experimental',
  'engines': {
    'Firefox': '*',
    'Fennec': '*'
  }
};

const { Class } = require('../core/heritage');
const { Disposable } = require('../core/disposable');
const { off, emit, setListeners } = require('../event/core');
const { EventTarget } = require('../event/target');
const { ns } = require('../core/namespace');
const { id: addonID } = require('../self');
const { contract: menuitemContract } = require('./menuitem/contract');
const { create, update, dispose } = require('./menuitem/view');
const { ensure } = require('../system/unload');
const { identify } = require('./id');
const { uuid } = require('../util/uuid');
const { MENUS } = require('./menuitem/constants');
const { models, modelFor } = require('./menuitem/namespace');
const { contract } = require('../util/contract');

const menuitemMS = ns();

// exporting list of menu constants
Object.keys(MENUS).forEach(function(key) {
  exports[key] = MENUS[key];
})

const Menuitem = Class({
  implements: [ Disposable ],
  extends: EventTarget,
  setup: function(options) {
    // inital validation for the model information
    let model = menuitemContract(options);

    // save the model information
    models.set(this, model);

    // generate an id if one was not provided
    model.id = addonID + '-' + uuid();

    // see bug https://bugzilla.mozilla.org/show_bug.cgi?id=886148
    ensure(this, 'destroy');

    setListeners(this, options);

    create(this, model);
  },
  dispose: function() {
    const internals = menuitemMS(this);

    off(this);

    dispose(this);
  },
  get label() modelFor(this).label,
  set label(value) {
    let model = modelFor(this);
    model.label = (contract({ label: menuitemContract.rules.label })({ label: value })).label;
    update(this, model);
    return value;
  },
  get disabled() !!modelFor(this).disabled,
  set disabled(value) {
    let model = modelFor(this);
    model.disabled = (contract({ disabled: menuitemContract.rules.disabled })({ disabled: value })).disabled;
    update(this, model);
    return value;
  }
});
exports.Menuitem = Menuitem;

identify.define(Menuitem, function(menuitem) {
  return modelFor(menuitem).id;
});
