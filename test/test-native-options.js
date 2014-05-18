/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { setDefaults, injectOptions, validate } = require('sdk/preferences/native-options');
const { activeBrowserWindow: { document } } = require("sdk/deprecated/window-utils");
const { emit, on, off, once } = require('sdk/system/events');
const { setTimeout, setImmediate } = require('sdk/timers');
const { preferencesBranch, id } = require('sdk/self');
const { get } = require('sdk/preferences/service');
const simple = require('sdk/simple-prefs');
const fixtures = require('./fixtures');
const { Cc, Ci, Cu } = require('chrome');

const { AddonManager } = Cu.import('resource://gre/modules/AddonManager.jsm', {});

exports.testValidate = function(assert) {
  let { preferences } = packageJSON('simple-prefs');

  let block = () => validate(preferences);

  delete preferences[3].options[0].value;
  assert.throws(block, /option requires both a value/, "option missing value error");

  delete preferences[2].options;
  assert.throws(block, /'test3' pref requires options/, "menulist missing options error");

  preferences[1].type = 'control';
  assert.throws(block, /'test2' control requires a label/, "control missing label error");

  preferences[1].type = 'nonvalid';
  assert.throws(block, /'test2' pref must be of valid type/, "invalid pref type error");

  delete preferences[0].title;
  assert.throws(block, /'test' pref requires a title/, "pref missing title error");
}

exports.testNoPrefs = function(assert, done) {
  let { preferences } = packageJSON('no-prefs');

  let parent = document.createDocumentFragment();
  injectOptions(preferences || [], preferencesBranch, document, parent);
  assert.equal(parent.children.length, 0, "No setting elements injected");

  // must test with events because we can't reset default prefs
  function onPrefChange(name) {
    assert.fail("No preferences should be defined");
  }

  simple.on('', onPrefChange);
  setDefaults(preferences || [], preferencesBranch);
  setTimeout(function() {
    assert.pass("No preferences were defined");
    simple.off('', onPrefChange);
    done();
  }, 100);
}

exports.testCurlyID = function(assert) {
  let { preferences, id } = packageJSON('curly-id');

  let parent = document.createDocumentFragment();
  injectOptions(preferences, id, document, parent);
  assert.equal(parent.children.length, 1, "One setting elements injected");
  assert.equal(parent.firstElementChild.attributes.pref.value, 
               "extensions.{34a1eae1-c20a-464f-9b0e-000000000000}.test13",
               "Setting pref attribute is set properly");

  setDefaults(preferences, id);
  assert.equal(get('extensions.{34a1eae1-c20a-464f-9b0e-000000000000}.test13'), 
               26, "test13 is 26");
}

exports.testPreferencesBranch = function(assert) {
  let { preferences, 'preferences-branch': prefsBranch } = packageJSON('preferences-branch');

  let parent = document.createDocumentFragment();
  injectOptions(preferences, prefsBranch, document, parent);
  assert.equal(parent.children.length, 1, "One setting elements injected");
  assert.equal(parent.firstElementChild.attributes.pref.value, 
               "extensions.human-readable.test42",
               "Setting pref attribute is set properly");

  setDefaults(preferences, prefsBranch);
  assert.equal(get('extensions.human-readable.test42'), true, "test42 is true");
}

exports.testSimplePrefs = function(assert) {
  let { preferences } = packageJSON('simple-prefs');

  function assertPref(setting, name, type, title) {
    assert.equal(setting.getAttribute('data-jetpack-id'), id,
                 "setting 'data-jetpack-id' attribute correct");
    assert.equal(setting.getAttribute('pref'), 'extensions.' + id + '.' + name,
                 "setting 'pref' attribute correct");
    assert.equal(setting.getAttribute('pref-name'), name,
                 "setting 'pref-name' attribute correct");
    assert.equal(setting.getAttribute('type'), type,
                 "setting 'type' attribute correct");
    assert.equal(setting.getAttribute('title'), title,
                 "setting 'title' attribute correct");
  }

  function assertOption(option, value, label) {
    assert.equal(option.getAttribute('value'), value, "value attribute correct");
    assert.equal(option.getAttribute('label'), label, "label attribute correct");
  }

  let parent = document.createDocumentFragment();
  injectOptions(preferences, preferencesBranch, document, parent);
  assert.equal(parent.children.length, 8, "Eight setting elements injected");

  assertPref(parent.children[0], 'test', 'bool', 't\u00EBst');
  assertPref(parent.children[1], 'test2', 'string', 't\u00EBst');
  assertPref(parent.children[2], 'test3', 'menulist', '"><test');
  assertPref(parent.children[3], 'test4', 'radio', 't\u00EBst');

  assertPref(parent.children[4], 'test5', 'boolint', 'part part, particle');
  assertPref(parent.children[5], 'test6', 'color', 'pop pop, popscicle');
  assertPref(parent.children[6], 'test7', 'file', 'bike bike');
  assertPref(parent.children[7], 'test8', 'directory', 'test test');

  let menuItems = parent.children[2].querySelectorAll('menupopup>menuitem');
  let radios = parent.children[3].querySelectorAll('radiogroup>radio');

  assertOption(menuItems[0], '0', 'label1');
  assertOption(menuItems[1], '1', 'label2');
  assertOption(radios[0], 'red', 'rouge');
  assertOption(radios[1], 'blue', 'bleu');

  setDefaults(preferences, preferencesBranch);
  assert.strictEqual(simple.prefs.test, false, "test is false");
  assert.strictEqual(simple.prefs.test2, "\u00FCnic\u00F8d\u00E9", "test2 is unicode"); 
  assert.strictEqual(simple.prefs.test3, "1", "test3 is '1'");
  assert.strictEqual(simple.prefs.test4, "red", "test4 is 'red'");

  // default pref branch can't be "reset", bug 1012231
  Cc['@mozilla.org/preferences-service;1'].getService(Ci.nsIPrefService).
    getDefaultBranch('extensions.' + preferencesBranch).deleteBranch('');
}

function packageJSON(dir) {
  return require(fixtures.url('preferences/' + dir + '/package.json'));
}

exports.testAddonDisable = function(assert, done) {
  let addon = null;
  
  // create a mock container for <setting> elements
  let parent = document.createElement('parent');
  document.documentElement.appendChild(parent);
  let child = document.createElement('child');
  child.setAttribute('id', 'detail-downloads');
  parent.appendChild(child);

  // install an addon with a single pref
  AddonManager.getInstallForURL(
    fixtures.url('preferences/empty.xpi'), 
    function(install) {
      install.addListener({ onInstallEnded: (install) => addon = install.addon });
      install.install();
    },
    'application/x-xpinstall'
  );

  // wait for addon startup event
  once('test-addon-startup', ({ data }) => {
    assert.equal(data, addon.id, "startup event from the right addon");

    // addon needs a tick before it is ready to observe this notification
    setImmediate( _ => 
      emit('addon-options-displayed', { data: addon.id, subject: document }) );
  });

  let called = 0;
  on('addon-options-displayed', function optionsObserver({ data }) {

    called++;
    assert.equal(data, addon.id, "options event for the right addon");

    if (called === 1) {
      let settings = parent.querySelectorAll('setting');
      assert.equal(settings.length, 1, "expecting one <setting> in the document");
      addon.userDisabled = true;
      parent.removeChild(settings[0]);
      emit('addon-options-displayed', { data: addon.id, subject: document });
    }
    else if (called === 2) {
      let settings = parent.querySelectorAll('setting');
      assert.equal(settings.length, 0, "expecting no <setting> after disabling");
      off('addon-options-displayed', optionsObserver);
      parent.parentNode.removeChild(parent);
      addon.uninstall();
      done();
    }
  });
}

require('sdk/test').run(exports);
