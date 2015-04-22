"use strict"

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Cu } = require("chrome");
const { CommandUtils } = require("resource:///modules/devtools/DeveloperToolbar.jsm");
const { devtools } = require("resource://gre/modules/devtools/Loader.jsm");
const { gcli } = require("resource://gre/modules/devtools/gcli.jsm");

const { getActiveTab } = require("sdk/tabs/utils");
const { getMostRecentBrowserWindow } = require("sdk/window/utils");
const { Conversion, Status } = devtools.require("gcli/types/types");

const targetFor = ({target, tab, window}) =>
  target ? target :
  tab ? devtools.TargetFactory.forTab(tab) :
  window ? devtools.TargetFactory.forTab(getActiveTab(window)) :
  devtools.TargetFactory.forTab(getActiveTab(getMostRecentBrowserWindow()))
exports.targetFor = targetFor

const environmentFor = options =>
  options.environment ? options.environment :
  CommandUtils.createEnvironment({target: targetFor(options)})
exports.environmentFor = environmentFor


const run = (command, options={}) => {
  const environment = environmentFor(options)
  return CommandUtils.createRequisition(environment).then(requisition => {
    return requisition.updateExec(command).then(({error, data}) => {
      if (error) {
        throw data
      }
      return data
    })
  })
}
exports.run = run

const isUpperCase = text => text.toUpperCase() === text

const install = (...items) => {
  gcli.addItems(items.map(item => isUpperCase(item.name.charAt(0)) ?
                                    Object.assign(item, {item: "type"}) :
                                    item))
}
exports.install = install

const uninstall = (...items) => gcli.removeItems(items)
exports.uninstall = uninstall

exports.Conversion = Conversion
exports.Status = Status
