/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

// The Button module currently supports only Firefox.
// See: https://bugzilla.mozilla.org/show_bug.cgi?id=jetpack-panel-apps
module.metadata = {
  'stability': 'experimental',
  'engines': {
    'Firefox': '*'
  }
};



const { Cc, Ci, Cu } = require("chrome");
const { on, off, emit } = require("../../event/core");

const { id: addonID } = require("sdk/self");
const buttonPrefix = 'button--' + addonID.replace(/@/g, '-at-');

const { getMostRecentBrowserWindow } = require("../../window/utils");

const { CustomizableUI } = Cu.import("resource:///modules/CustomizableUI.jsm", {});

const SIZE = {
  'small': 16,
  'medium': 32,
  'large': 64
}

const XUL_NS = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';

const toWidgetID = function(id) buttonPrefix + '-' + id;
const toButtonID = function(id) id.substr(buttonPrefix.length + 1);

function create(options) {
  let { id, label, image, size, type } = options;
  let bus = {};

  CustomizableUI.createWidget({
      id: toWidgetID(id),
      type: 'custom',
      removable: true,
      defaultArea: CustomizableUI.AREA_NAVBAR,
      allowedAreas: [CustomizableUI.AREA_PANEL, CustomizableUI.AREA_NAVBAR],

      onBuild: function(document) {
        let window = document.defaultView;
        let isInPanel = (this.currentArea === CustomizableUI.AREA_PANEL);

        let node = document.createElementNS(XUL_NS, 'toolbarbutton');

        node.setAttribute('id', this.id);
        node.setAttribute('class', 'toolbarbutton-1 chromeclass-toolbar-additional');
        node.setAttribute('width', SIZE[size] || 16);
        node.setAttribute('type', type);

        // TODO: improve
        node.addEventListener('command', function(event) {
          emit(bus, 'click', event);
        });

        return node;
    }
  });

  return bus;
};
exports.create = create;

function dispose({id}) {
  CustomizableUI.destroyWidget(toWidgetID(id));
}
exports.dispose = dispose;

function setImage({id}, window, image) {
  let { node } = CustomizableUI.getWidget(toWidgetID(id)).forWindow(window);
  node.setAttribute("image", image);
}
exports.setImage = setImage;

function setLabel({id}, window, label) {
  let { node } = CustomizableUI.getWidget(toWidgetID(id)).forWindow(window);

  node.setAttribute('label', label);
  node.setAttribute('tooltiptext', label);
}
exports.setLabel = setLabel;

function setDisabled({id}, window, disabled) {
  let { node } = CustomizableUI.getWidget(toWidgetID(id)).forWindow(window);

  node.setAttribute("disabled", disabled);
}
exports.setDisabled = setDisabled;

function setChecked({id}, window, checked) {
  let { node } = CustomizableUI.getWidget(toWidgetID(id)).forWindow(window);

  node.setAttribute("checked", checked);
}
exports.setChecked = setChecked;

function click({id}) {
  let window = getMostRecentBrowserWindow();

  let { node } = CustomizableUI.getWidget(toWidgetID(id)).forWindow(window);

  node.click();
}
exports.click = click;
