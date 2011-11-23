'use strict';

const { env } = require('api-utils/environment');
const { Cc, Ci } = require('chrome');
const { get, set, exists } = Cc['@mozilla.org/process/environment;1'].
                             getService(Ci.nsIEnvironment);

exports['test exists'] = function(assert) {
  assert.equal('PATH' in env, exists('PATH'),
               'PATH environment variable is defined');
  assert.equal('FOO' in env, exists('FOO'),
               'FOO environment variable is not defined');
  set('FOO', 'foo');
  assert.equal('FOO' in env, true,
               'FOO environment variable was set');
  set('FOO', null);
  assert.equal('FOO' in env, false,
               'FOO environment variable was unset');
};

exports['test get'] = function(assert) {
  assert.equal(env.PATH, get('PATH'), 'PATH env variable matches');
  assert.equal(env.BAR, undefined, 'BAR env variable is not defined');
  set('BAR', 'bar');
  assert.equal(env.BAR, 'bar', 'BAR env variable was set');
  set('BAR', null);
  assert.equal(env.BAR, undefined, 'BAR env variable was unset');
};

exports['test set'] = function(assert) {
  assert.equal(get('BAZ'), '', 'BAZ env variable is not set');
  assert.equal(env.BAZ, undefined, 'BAZ is not set');
  env.BAZ = 'baz';
  assert.equal(env.BAZ, get('BAZ'), 'BAZ env variable is set');
  assert.equal(get('BAZ'), 'baz', 'BAZ env variable was set to "baz"');
};

exports['test unset'] = function(assert) {
  env.BLA = 'bla';
  assert.equal(env.BLA, 'bla', 'BLA env varibale is set');
  delete env.BLA;
  assert.equal(env.BLA, undefined, 'BLA env variable is unset');
  assert.equal('BLA' in env, false, 'BLA env variable no longer exists' );
};

require('test').run(exports);
