/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

require("../index");
const {Cc, Ci} = require("chrome");
const {run} = require("dev/gcli");
const core = require("../core");
const {toFilename} = require("sdk/url");
const path = require("sdk/fs/path");
const {tmpdir} = require("node/os");
const {remove, exists} = require("../io");

const root = path.join(toFilename(module.uri), "..", "fixtures");

const {addObserver, removeObserver} = Cc['@mozilla.org/observer-service;1']
                                        .getService(Ci.nsIObserverService);

const receiveNotification = topic => new Promise((resolve) => {
  addObserver({
    observe(subject, topic, data) {
      removeObserver(this, topic);
      resolve({subject, topic, data});
    }
  }, topic, false);
});

const requestNotifications = () =>
  ({install: receiveNotification("test-addon-install"),
    startup: receiveNotification("test-addon-startup"),
    shutdown: receiveNotification("test-addon-shutdown"),
    uninstall: receiveNotification("test-addon-uninstall"),

    construct: receiveNotification("test-jetpack-construct"),
    dispose: receiveNotification("test-jetpack-dispose")});


const readMeta = ({description, name, params}) => ({
  name, description,
  params: params.map(({name, description}) =>
                     ({name, description}))
})

exports["test addon commands are installed"] = function*(assert) {
  const mount = yield run("help addon mount");

  assert.deepEqual(readMeta(mount.command), readMeta(core.mountAddon));

  const install = yield run("help addon install");
  assert.deepEqual(readMeta(install.command), readMeta(core.installAddon));

  const uninstall = yield run("help addon uninstall");
  assert.deepEqual(readMeta(uninstall.command), readMeta(core.uninstallAddon));

  const reload = yield run("help addon reload");
  assert.deepEqual(readMeta(reload.command), readMeta(core.reloadAddon));

  const _export = yield run("help addon export");
  assert.deepEqual(readMeta(_export.command), readMeta(core.exportAddon));
};

exports["test addon install / uninstall"] = function*(assert) {
  const {install, startup, shutdown, uninstall} = requestNotifications();

  const id = yield run(`addon install ${root}/addon-install-unit-test@mozilla.com.xpi`);

  assert.equal(id, "addon-install-unit-test@mozilla.com");

  assert.deepEqual((yield install),
                   {subject: null,
                    topic: "test-addon-install",
                    data: "install"},
                   "addon was installed");

  assert.deepEqual((yield startup),
                   {subject: null,
                    topic: "test-addon-startup",
                    data: "startup"},
                   "addon was started");

  yield run(`addon uninstall Addon_install_test_1.0`);

  assert.deepEqual((yield shutdown),
                   {subject: null,
                    topic: "test-addon-shutdown",
                    data: "shutdown"},
                   "addon was shutdown");

  assert.deepEqual((yield uninstall),
                   {subject: null,
                    topic: "test-addon-uninstall",
                    data: "uninstall"},
                   "addon was uninstalled");
};

exports["test addon mount"] = function*(assert) {
  const {construct, dispose} = requestNotifications();

  yield run(`addon mount ${root}/jetpack/`);

  assert.deepEqual((yield construct),
                   {subject: null,
                    topic: "test-jetpack-construct",
                    data: "construct"},
                   "jetpack object was constructed");

  yield run(`addon uninstall jetpack_0.0.1`);

  assert.deepEqual((yield dispose),
                   {subject: null,
                    topic: "test-jetpack-dispose",
                    data: "dispose"},
                   "jetpack object was disposed");
};

exports["test addon reload"] = function*(assert) {
  const {construct, dispose} = requestNotifications();

  yield run(`addon mount ${root}/jetpack/`);

  assert.deepEqual((yield construct),
                   {subject: null,
                    topic: "test-jetpack-construct",
                    data: "construct"},
                   "jetpack object was constructed");

  const reload = requestNotifications().construct;

  yield run(`addon reload jetpack_0.0.1`);

  assert.deepEqual((yield reload),
                   {subject: null,
                    topic: "test-jetpack-construct",
                    data: "construct"},
                   "jetpack was reconstructed");

  yield run(`addon uninstall jetpack_0.0.1`);

  assert.deepEqual((yield dispose),
                   {subject: null,
                    topic: "test-jetpack-dispose",
                    data: "dispose"},
                   "jetpack object was disposed");
};


exports["test export addon"] = function*(assert) {
  const {tmpdir} = require("node/os");
  const mounted = requestNotifications();
  const file = `${tmpdir()}/jetpack.xpi`

  yield run(`addon mount ${root}/jetpack/`);

  assert.deepEqual((yield mounted.construct),
                   {subject: null,
                    topic: "test-jetpack-construct",
                    data: "construct"},
                   "jetpack object was constructed");

  assert.ok(!(yield exists(file)));

  yield run(`addon export jetpack_0.0.1 ${tmpdir()}`);


  assert.ok(yield exists(file));

  yield run(`addon uninstall jetpack_0.0.1`);

  assert.deepEqual((yield mounted.dispose),
                   {subject: null,
                    topic: "test-jetpack-dispose",
                    data: "dispose"},
                   "jetpack object was disposed");

  const installed = requestNotifications();

  const id = yield run(`addon install ${file}`);

  assert.equal(id, "@jetpack");

  assert.deepEqual((yield installed.construct),
                   {subject: null,
                    topic: "test-jetpack-construct",
                    data: "construct"},
                   "jetpack object was constructed");

  yield run(`addon uninstall jetpack_0.0.1`);

  assert.deepEqual((yield mounted.dispose),
                   {subject: null,
                    topic: "test-jetpack-dispose",
                    data: "dispose"},
                   "jetpack object was disposed");

  yield remove(file);
};
require("sdk/test").run(exports);
