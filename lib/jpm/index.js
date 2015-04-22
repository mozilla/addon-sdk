/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const gcli = require("dev/gcli");
const { Addon, ExistingDirectoryPath, mountAddon,
        reloadAddon, exportAddon, installAddon, uninstallAddon } = require("./core");

gcli.uninstall(Addon, ExistingDirectoryPath,
               mountAddon, reloadAddon, exportAddon, installAddon, uninstallAddon);
gcli.install(Addon, ExistingDirectoryPath,
             mountAddon, reloadAddon, exportAddon, installAddon, uninstallAddon);
