<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

Module provide low level API for implementing custom 'about:' pages (like
[about:robots](about:robots) for example). Module exports `Protocol` base
exemplar that can be extended in order to implement custom page:

    const { Protocol } = require('api-utils/protocol/about');
    Protocol.extend({
      // ...
    });

### URIs

You must implement `what` string property that will represent part of URI after
`'about:'`. For example in order to register [about:foo](about:foo) page you
need to implement `what` property with value `'foo'`:

    const { Protocol } = require('api-utils/protocol/about');
    Protocol.extend({
      what: 'foo',
      // ...
    });

### Redirects

Easiest way to define 'about:' style page is to redirect request to a different
page URL:

    const { Protocol } = require('api-utils/protocol/about');
    let foo = Protocol.extend({
      what: 'foo',
      onRequest: function onRequest(request, response) {
        console.log(request.uri);  // => about:foo
        response.uri = 'data:text/html,hello ' + this.what;
      }
    });

*Note:* Requests may be redirected to other types of URLs like: 'resource',
'chrome' or even different 'about' page URLs.

### Generate responses

It is also possible to generate and write responses on incoming requests:

    const { Protocol } = require('api-utils/protocol/about');
    let n = 0
    let bar = Protocol.extend({
      what: 'bar',
      onRequest: function onRequest(request, response) {
        console.log(request.uri);  // => about:bar
        n ++;
        response.write('<body>hello bar#' + n + '</bar>');
      }
    });

### Asynchronous responses

Asynchronous streaming of responses is also possible:

    const { Protocol } = require('api-utils/protocol/about');
    const { setTimeout } = require('timers');
    Protocol.extend({
      what: 'bar',
      onRequest: function onRequest(request, response) {
        response.write('hello\n')
        setTimeout(function() {
          response.end('world);
        }, 100);
      }
    });

Note: Make sure to close response when done streaming responses to avoid longer
page loads.

### Advanced responses properties

In addition there are some more advanced `response` properties that can be
tweaked to give a browser more hints about the content:

    const { Protocol } = require('api-utils/protocol/about');
    const { setTimeout } = require('timers');
    Protocol.extend({
      what: 'bar',
      onRequest: function onRequest(request, response) {
        response.contentType = 'text/html';
        response.contentLength = 4;
        response.contentCharset = 'utf-8';
        response.write('bye\n')
      }
    });

*Note:* There is also `response.principalURI` that must be used with great care.
If `response.principalURI` property is set page inherits privileges from it,
which is useful with redirects, in order preserve access to all the assets that
original page had.

### Registering protocol

In order to make protocol available to the runtime it must be registered. SDK's
**xpcom** module can be used to do this:

    const { Service } = require('api-utils/xpcom');
    let protocol = Protocol.extend({ /*...*/ });
    Service.new({
      contract: protocol.contract,
      description: protocol.description,
      component: protocol
    });

For more details on registration / unregistration see **xpcom** module
documentation.

