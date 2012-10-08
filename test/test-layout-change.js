/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// This test makes sure that require statements used by all AMO hosted
// add-ons will be able to use old require statements.
// Tests are based on following usage data:
// https://docs.google.com/spreadsheet/ccc?key=0ApEBy-GRnGxzdHlRMHJ5RXN1aWJ4RGhINkxSd0FCQXc#gid=0

exports["test compatibility"] = function(assert) {
  assert.equal(require("self"),
               require("sdk/self"), "sdk/self -> self");

  assert.equal(require("tabs"),
               require("sdk/tabs"), "sdk/tabs -> tabs");

  assert.equal(require("widget"),
               require("sdk/widget"), "sdk/widget -> widget");

  assert.equal(require("page-mod"),
               require("sdk/page-mod"), "sdk/page-mod -> page-mod");

  assert.equal(require("panel"),
               require("sdk/panel"), "sdk/panel -> panel");

  assert.equal(require("request"),
               require("sdk/request"), "sdk/request -> request");

  assert.equal(require("chrome"),
               require("chrome"), "chrome -> chrome");

  assert.equal(require("simple-storage"),
               require("sdk/simple-storage"), "sdk/simple-storage -> simple-storage");

  assert.equal(require("context-menu"),
               require("sdk/context-menu"), "sdk/context-menu -> context-menu");

  assert.equal(require("notifications"),
               require("sdk/notifications"), "sdk/notifications -> notifications");

  assert.equal(require("preferences-service"),
               require("sdk/preferences/service"), "sdk/preferences/service -> preferences-service");

  assert.equal(require("window-utils"),
               require("sdk/deprecated/window-utils"), "sdk/deprecated/window-utils -> window-utils");

  assert.equal(require("url"),
               require("sdk/core/url"), "sdk/core/url -> url");

  assert.equal(require("selection"),
               require("sdk/selection"), "sdk/selection -> selection");

  assert.equal(require("timers"),
               require("sdk/timers"), "sdk/timers -> timers");

  assert.equal(require("simple-prefs"),
               require("sdk/simple-prefs"), "sdk/simple-prefs -> simple-prefs");

  assert.equal(require("traceback"),
               require("sdk/console/traceback"), "sdk/console/traceback -> traceback");

  assert.equal(require("unload"),
               require("sdk/system/unload"), "sdk/system/unload -> unload");

  assert.equal(require("hotkeys"),
               require("sdk/hotkeys"), "sdk/hotkeys -> hotkeys");

  assert.equal(require("clipboard"),
               require("sdk/clipboard"), "sdk/clipboard -> clipboard");

  assert.equal(require("windows"),
               require("sdk/windows"), "sdk/windows -> windows");

  assert.equal(require("page-worker"),
               require("sdk/page-worker"), "sdk/page-worker -> page-worker");

  assert.equal(require("timer"),
               require("sdk/timers"), "sdk/timers -> timer");

  assert.equal(require("xhr"),
               require("sdk/io/xhr"), "sdk/io/xhr -> xhr");

  assert.equal(require("observer-service"),
               require("sdk/deprecated/observer-service"), "sdk/deprecated/observer-service -> observer-service");

  assert.equal(require("private-browsing"),
               require("sdk/private-browsing"), "sdk/private-browsing -> private-browsing");

  assert.equal(require("passwords"),
               require("sdk/passwords"), "sdk/passwords -> passwords");

  assert.equal(require("events"),
               require("sdk/deprecated/events"), "sdk/deprecated/events -> events");

  assert.equal(require("match-pattern"),
               require("sdk/match-pattern/core"), "sdk/match-pattern/core -> match-pattern");

  assert.equal(require("tab-browser"),
               require("sdk/deprecated/tab-browser"), "sdk/deprecated/tab-browser -> tab-browser");

  assert.equal(require("file"),
               require("sdk/io/file"), "sdk/io/file -> file");

  assert.equal(require("xul-app"),
               require("sdk/system/xul-app"), "sdk/system/xul-app -> xul-app");

  assert.equal(require("api-utils"),
               require("sdk/deprecated/api-utils"), "sdk/deprecated/api-utils -> api-utils");

  assert.equal(require("runtime"),
               require("sdk/system/runtime"), "sdk/system/runtime -> runtime");

  assert.equal(require("base64"),
               require("sdk/base64"), "sdk/base64 -> base64");

  assert.equal(require("xpcom"),
               require("sdk/platform/xpcom"), "sdk/platform/xpcom -> xpcom");

  assert.equal(require("traits"),
               require("sdk/deprecated/traits"), "sdk/deprecated/traits -> traits");

  assert.equal(require("keyboard/utils"),
               require("sdk/keyboard/utils"), "sdk/keyboard/utils -> keyboard/utils");

  assert.equal(require("system"),
               require("sdk/system"), "sdk/system -> system");

  assert.equal(require("querystring"),
               require("sdk/core/querystring"), "sdk/core/querystring -> querystring");

  assert.equal(require("addon-page"),
               require("sdk/addon-page"), "sdk/addon-page -> addon-page");

  assert.equal(require("tabs/utils"),
               require("sdk/tabs/utils"), "sdk/tabs/utils -> tabs/utils");

  assert.equal(require("app-strings"),
               require("sdk/deprecated/app-strings"), "sdk/deprecated/app-strings -> app-strings");

  assert.equal(require("dom/events"),
               require("sdk/dom/events"), "sdk/dom/events -> dom/events");

  assert.equal(require("tabs/tab.js"),
               require("sdk/tabs/tab"), "sdk/tabs/tab -> tabs/tab.js");

  assert.equal(require("memory"),
               require("sdk/deprecated/memory"), "sdk/deprecated/memory -> memory");

  assert.equal(require("light-traits"),
               require("sdk/deprecated/light-traits"), "sdk/deprecated/light-traits -> light-traits");

  assert.equal(require("environment"),
               require("sdk/system/environment"), "sdk/system/environment -> environment");

  assert.equal(require("utils/data"),
               require("sdk/io/data"), "sdk/io/data -> utils/data");

  assert.equal(require("test/assert"),
               require("sdk/test/assert"), "sdk/test/assert -> test/assert");
};


require('test').run(exports);
