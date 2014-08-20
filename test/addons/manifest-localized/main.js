/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Cu } = require('chrome');
const self = require('sdk/self');
const { AddonManager } = Cu.import('resource://gre/modules/AddonManager.jsm', {});

exports["test add-on manifest was localized"] = (assert, done) => {
  AddonManager.getAddonByID(self.id, addon => {
    assert.equal(addon.name, "title-en", "title was translated");
    assert.equal(addon.description, "description-en", "description was translated");
    assert.equal(addon.creator, "author-en", "author was translated");
    assert.equal(addon.homepageURL, "homepage-en", "homepage was translated");
    done();
  });
};

require("sdk/test/runner").runTestsFromModule(module);
