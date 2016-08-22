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
const { on, off, emit, setListeners } = require('../event/core');
const { EventTarget } = require('../event/target');
const { ns } = require('../core/namespace');
const { id: addonID } = require('../self');
const { contract: menuitemContract } = require('./menuitem/contract');
const { create, update, dispose } = require('./menuitem/view');
const { ensure } = require('../system/unload');
const { identify } = require('./id');
const { uuid } = require('../util/uuid');
const { MENUS } = require('./menuitem/constants');
const { contract } = require('../util/contract');
const models = require('./model');

const menuitemNS = ns();
const menuitems = Set();

function modelFor(menuitem) models.get(menuitem);

// exporting list of menu constants
Object.keys(MENUS).forEach(function(key) {
  exports[key] = MENUS[key];
})

const Menuitem = Class({
  implements: [ Disposable ],
  extends: EventTarget,
  setup: function(options) {
    menuitems.add(this);

    const internals = menuitemNS(this);

    // inital validation for the model information
    let model = menuitemContract(options);

    // save the model information
    models.set(this, model);

    // generate an id if one was not provided
    model.id = addonID + '-' + uuid();

    // see bug https://bugzilla.mozilla.org/show_bug.cgi?id=886148
    ensure(this, 'destroy');

    setListeners(this, options);

    let { events: bus } = internals.view = create(model);
    let self = this;
    on(bus, 'click', function() {
      emit(self, 'click');
    });
  },
  dispose: function() {
    menuitems.delete(this);

    const internals = menuitemNS(this);

    off(this);

    internals.view = null;

    dispose(modelFor(this));
  },
  get label() modelFor(this).label,
  set label(value) {
    let model = modelFor(this);
    model.label = (contract({ label: menuitemContract.rules.label })({ label: value })).label;
    update(model);
    return value;
  },
  get disabled() !!modelFor(this).disabled,
  set disabled(value) {
    let model = modelFor(this);
    model.disabled = (contract({ disabled: menuitemContract.rules.disabled })({ disabled: value })).disabled;
    update(model);
    return value;
  }
});
exports.Menuitem = Menuitem;

identify.define(Menuitem, function(menuitem) {
  return modelFor(menuitem).id;
});
