"use strict";

const { AboutHandler, ProtocolHandler } = require('api-utils/protocol');
const { register, unregister } = require('api-utils/xpcom');
const { setTimeout } = require('api-utils/timer');
const tabs = require('addon-kit/tabs');
const { PageMod } = require('addon-kit/page-mod');

exports['test protocol handler dirs'] = function(assert, done) {
  let requested = 0;
  let content = {
    html: [
      '<!DOCTYPE html>',
      '<html>',
      '  <head>',
      '      <meta charset="utf-8">',
      '      <link rel="stylesheet" type="text/css" href="about.css">',
      '      <script type="text/javascript" src="about.js"></script>',
      '  </head>',
      '  <body>',
      '  </body>',
      '</html>'
    ].join('\n'),
    css: [
      'body {',
      '  background: black;',
      '  color: white;',
      '}'
    ].join('\n'),
    js: 'new ' + function() {
        var req = new XMLHttpRequest();
        req.open("GET", "./assets/about.md", true);
        req.onreadystatechange = function (aEvt) {
          if (req.readyState == 4) {
            if (req.status === 200 || req.status === 0) {
              document.body.innerHTML = '<h1>' + req.responseText + '</h1>';
            }
          }
        }
        req.send(null);
    },
    md: 'hello world'
  };

  let protocol = ProtocolHandler.extend({
    scheme: 'map' + new Date().getTime().toString(36),
    onRequest: function onRequest(request, response) {
      requested ++;
      if (request.uri === this.scheme + '://foo/index.html') {
        assert.pass('html page is loaded')
        response.end(content.html);
      }
      if (response.uri === this.scheme + '://foo/about.css') {
        assert.pass('css page was loaded')
        response.end(content.css);
      }
      if (response.uri === this.scheme + '://foo/about.js') {
        assert.pass('js is loaded');
        response.end(content.js);
      }
      if (response.uri === this.scheme + '://foo/assets/about.md') {
        assert.pass('markdown file is loaded');
        setTimeout(function() {
          response.end(content.md);
        });
      }
    }
  });
  register(protocol);

  let mod = PageMod({
    include: protocol.scheme + '://foo/index.html',
    contentScript: 'new ' + function() {
      setTimeout(function () {
        self.postMessage(document.body.textContent);
      }, 10);
    },
    onAttach: function onAttach(worker) {
      worker.on('message', function(data) {
        assert.equal(data, content.md, 'script changed a body');
        done();
      })
    }
  });
  tabs.open(protocol.scheme + '://foo/index.html');
};

require('test').run(exports);
