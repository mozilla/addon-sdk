<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

The `xpcom` module provides a low level API for implementing, registering, and
unregistering various XPCOM interfaces.

## Implementing XPCOM interfaces

This module exports the `Unknown` exemplar object that may be extended to
implement specific XPCOM interface(s). For example,
[nsIObserver](https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsIObserver)
 may be implemented as follows:

    const { Class } = require('api-utils/heritage');
    const { Unknown } = require('api-utils/xpcom');
    const { Cc, Ci } = require('chrome')
    const observerService = Cc["@mozilla.org/observer-service;1"].
                            getService(Ci.nsIObserverService);

    // Create my observer exemplar
    const SleepObserver = Class({
      extends: Unknown,
      interfaces: [ 'nsIObserver' ],    // Interfaces component implements
      topic: 'sleep_notification',
      initialize: function(fn) { this.fn = fn },
      register: function register() {
        observerService.addObserver(this, this.topic, false);
      },
      unregister: function() {
        observerService.removeObserver(this, this.topic);
      },
      observe: function observe(subject, topic, data) {
        this.fn({
          subject: subject,
          type: topic,
          data: data
        });
      }
    });

    // create instances of observers
    let observer = SleepObserver.new(function(event) {
      console.log('Going to sleep!')
    });
    // register observer
    observer.register();

## Implementing XPCOM factories

The module exports the `Factory` exemplar object that may be used to create
objects implementing the
[nsIFactory](https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsIFactory)
interface:

    const { Class } = require('api-utils/heritage');
    const { Factory } = require('api-utils/xpcom');
    let Request = Class({
      extends: Unknown,
      interfaces: [ 'nsIRequest' ],
      initialize: function initialize() {
        this.pending = false;
        // Do some initialization
      },
      isPending: function() { return this.pending },
      resume: function() { /* Implementation */ },
      suspend: function() { /* Implementation */ },
      cancel: function() { /* Implementation */ },
      initiate: function() {
        this.pending = true;
        /* Implementation */
      }
    });

    let requestFactory = Factory.new({ Component: Request });

Factories registered into a runtime may be accessed from the rest of the
application via the standard XPCOM API using the factory's auto generated `id`
(optionally you could specify the `id` by passing it as an option):

    let request = Components.classesByID[requestFactory.id].
      createInstance(Ci.nsIRequest);
    request.isPending()     // => false

Be aware that the traditional XPCOM API will always return a wrapped JS object
exposing only the properties defined by a given interface (`nsIRequest` in our
case):

    request.initiate()      // TypeError: request.initiate is not a function

You can still expose the unwrapped JS object, by a special `wrappedJSObject`
property of the component:

    let Request = Class({
      extends: Unknown,
      get wrappedJSObject() this,
      interfaces: [ 'nsIRequest' ],
      initialize: function initialize() {
        this.pending = false;
        // Do some initialization
      },
      isPending: function() { return this.pending },
      resume: function() { /* Implementation */ },
      suspend: function() { /* Implementation */ },
      cancel: function() { /* Implementation */ },
      initiate: function() {
        this.pending = true;
        /* Implementation */
      }
    });

    let requestFactory = Factory.new({ Component: Request });
    let request = Components.classesByID[requestFactory.id].
      createInstance(Ci.nsIRequest);
    request.isPending();     // => false
    request.wrappedJSObject.initiate();
    request.isPending();     // => true

Optionally `Factory.new` may be passed globally unique string in a format of:
`'@domain.com/unique/identifier;1'` as a `contract` option in order to
associate the factory with the ID:

    let namedFactory = Factory.new({
      contract: '@examples.com/request/factory;1',
      component: Request
    });

Such factories, when registered, can be accessed from the rest of the
application using human readable `contract` strings:

    let request = Components.classes['@examples.com/request/factory;1'].
                   createInstance(Components.interfaces.nsIRequest);

In addition, factories associated with a given `contract` may be replaced at
runtime:

    let renewedFactory = Factory.new({
      contract: '@examples.com/request/factory;1',
      Component: Class({ extends: Unknown, /* Implementation */ })
    })

Unfortunately the commonly used `Components.classes` won't get updated at
runtime but there is an alternative, more verbose, way to access the last
registered factory for a given `contract`:

    let id = Components.manager.QueryInterface(Ci.nsIComponentRegistrar).
      contractIDToCID('@examples.com/request/factory;1');
    Components.classesByID[requestFactory.id].
      createInstance(Ci.nsISupports);

This module also exports the `factoryByContract` function to simplify this:

    factoryByContract('@examples.com/request/factory;1').
      createInstance(Ci.nsISupports);

It's also recommended that you construct factories with an optional
`description` property, providing a human readable description for it:

    let factory = Factory.new({
      contract: '@examples.com/request/factory;1',
      description: 'Super duper request factory',
      Component: Request
    });

## Registering / Unregistering factories

All factories created using `Factory.new` get automatically registered into
the runtime unless you set the `register` option to `false`:

    var factoryToRegister = Factory.new({
      register: false,
      Component: Class({ extends: Unknown, /* Implementation */ })
    });

Such factories still may be registered manually using the exported `register`
function:

    const { register } = require('api-utils/xpcom');
    register(factoryToRegister);

All factories created using `Factory.new` also get unregistered automatically
when the add-on is unloaded. This can also be disabled, by setting the
`unregister` option to `false`.

    var factoryToUnregister = Service.new({
      unregister: false,
      Component: Class({ extends: Unknown, /* Implementation */ })
    });

All registered services may be unregistered at any time using the exported
`unregister` function:

    unregister(factoryToUnregister);

## Implementing XPCOM services

This module exports the `Service` exemplar object, that has the same API as
`Factory` and can be used to register services:

    const { Service } = require('api-utils/xpcom');
    let service = Service.new({
      contract: '@examples/demo/service;1',
      description: 'My demo service',
      Component: Class({
        extends: Unknown,
        // Implementation
        get wrappedJSObject() this
      })
    });

Registered services can be accessed through the rest of the application via
the standard XPCOM API:

    let s = Components.classes['@examples/demo/service;1'].
      getService(Components.interfaces.nsISupports);

In contrast to factories, services do not create instances of enclosed
components, they expose the component itself. Also please note that the
idiomatic way to work with a service is via its `getService` method:

    s.wrappedJSObject === service.component // => true
