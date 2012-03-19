/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const { open } = require('api-utils/window/utils');
const { create } = require('api-utils/frame/utils');

exports['test frame creation'] = function(assert) {
  let window = open('data:text/html,Window');
  let frame = create(window.document);

  assert.equal(frame.getAttribute('type'), 'content',
               'frame type is content');
  assert.ok(frame.contentWindow, 'frame has contentWindow');
  assert.equal(frame.contentWindow.location.href, 'about:blank',
               'by default "about:blank" is loaded');
  assert.equal(frame.docShell.allowAuth, false, 'auth disabled by default');
  assert.equal(frame.docShell.allowJavascript, false, 'js disabled by default');
  assert.equal(frame.docShell.allowPlugins, false,
               'plugins disabled by default');
  window.close();
};

exports['test fram has js disabled by default'] = function(assert, done) {
  let window = open('data:text/html,window');
  window.addEventListener('DOMContentLoaded', function windowReady() {
    window.removeEventListener('DOMContentLoaded', windowReady, false);
    let frame = create(window.document, {
      uri: 'data:text/html,<script>document.documentElement.innerHTML' +
           '= "J" + "S"</script>',
    });
    frame.contentWindow.addEventListener('DOMContentLoaded', function ready() {
      frame.contentWindow.removeEventListener('DOMContentLoaded', ready, false);
      assert.ok(!~frame.contentDocument.documentElement.innerHTML.indexOf('JS'),
                'JS was executed');

      window.close();
      done();
    }, false);

  }, false);
};

exports['test frame with js enabled'] = function(assert, done) {
  let window = open('data:text/html,window');
  window.addEventListener('DOMContentLoaded', function windowReady() {
    window.removeEventListener('DOMContentLoaded', windowReady, false);
    let frame = create(window.document, {
      uri: 'data:text/html,<script>document.documentElement.innerHTML' +
           '= "J" + "S"</script>',
      allowJavascript: true
    });
    frame.contentWindow.addEventListener('DOMContentLoaded', function ready() {
      frame.contentWindow.removeEventListener('DOMContentLoaded', ready, false);
      assert.ok(~frame.contentDocument.documentElement.innerHTML.indexOf('JS'),
                'JS was executed');

      window.close();
      done();
    }, false);

  }, false);
};

require('test').run(exports);
