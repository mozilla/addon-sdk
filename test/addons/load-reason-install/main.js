'use strict';

const self = require('sdk/self');

exports.testLoadReasonIsInstall = function(assert) {
  assert.equal(self.loadReason, 'install', 'the laodReason is install');
};

require('sdk/test/runner').runTestsFromModule(module);
