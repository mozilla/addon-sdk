<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

Module `xpcom` provides low level API for implementing and registering /
unregistering various XCOM interfaces.

## Implementing XPCOM interfaces

Module exports `Unknow` exemplar object, that may be extended to implement
specific XCOM interface(s). For example [nsIObserver]
(https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsIObserver) may be
implemented as follows:

    const { Unknown } = require('api-utils/xpcom');
    const { Cc, Ci } = require('chrome')
    const observerService = Cc["@mozilla.org/observer-service;1"].
                            getService(Ci.nsIObserverService);

    // Create my observer exemplar
    const SleepObserver = Unknown.extend({
      interfaces: [ 'nsIObserver' ],    // Interfaces component implements
      topic: 'sleep_notification',
      initialize: function(fn) { this.fn = fn },
      register: function register() {
        observerService.addObserver(this, this.topic, false);
      },
      unregister: function() {
        addObserver.removeObserver(this, this.topic, false);
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

## Implementing XCOM factories

Module exports `Factory` exemplar, object that may be used to create objects
implementing
[nsIFactory](https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsIFactory)
interface:

    const { Factory } = require('api-utils/xpcom');
    let Request = Unknown.extend({
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

    let requestFactory = Factory.new({ component: Request });

Factories registered into a runtime may be accessed from the rest of the
application via standard XPCOM API using factory's auto generated `id`
(optionally you could specify specific `id` by passing it as an option):

    let request = Components.classesByID[requestFactory.id].
      createInstance(Ci.nsIRequest);
    request.isPending()     // => false

Be aware that traditional XPCOM API will always return a wrapped JS objects
exposing only properties defined by a given interface (`nsIRequest`) in our
case:

    request.initiate()      // TypeError: request.initiate is not a function

You still can expose unwrapped JS object, by a special `wrappedJSObject`
property of the component:

    let Request = Unknown.extend({
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

    let requestFactory = Factory.new({ component: Request });
    let request = Components.classesByID[requestFactory.id].
      createInstance(Ci.nsIRequest);
    request.isPending();     // => false
    request.wrappedJSObject.initiate();
    request.isPending();     // => true

Optionally `Factory.new` may be passed globally unique string in a format of:
`'@domain.com/unique/identifier;1'` as a `contract` option in order to
associate it with it:

    let namedFactory = Factory.new({
      contract: '@examples.com/request/factory;1',
      component: Request
    });

Such factories when registered can be accessed form rest of the application by
human readable `contract` strings:

    let request = Components.classes['@examples.com/request/factory;1'].
                   createInstance(Components.interfaces.nsIRequest);

In addition factories associated with a given `contract` may be replaced at
runtime:

    let renewedFactory = Factory.new({
      contract: '@examples.com/request/factory;1',
      component: Unknown.extend({ /* Implementation */ })
    })

Unfortunately commonly used `Components.classes` won't get updated at runtime
but there is an alternative, more verbose way to access last registered factory
for a given `contract`:

    let id = Components.manager.QueryInterface(Ci.nsIComponentRegistrar).
      contractIDToCID('@examples.com/request/factory;1');
    Components.classesByID[requestFactory.id].
      createInstance(Ci.nsISupports);

Module also exports `factoryByContract` function to simplify this:

    factoryByContract('@examples.com/request/factory;1').
      createInstance(Ci.nsISupports);

It's also recommended to construct factories with an optional `description`
property, providing human readable description of it:

    let factory = Factory.new({
      contract: '@examples.com/request/factory;1',
      description: 'Super duper request factory',
      component: Request
    });

## Registering / Unregistering factories

All factories created using `Factory.new` get automatically registered into
runtime unless explicitly specified otherwise by setting `register` option to
`false`:

    var factoryToRegister = Factory.new({
      register: false,
      component: Unknown.extend({ /* Implementation */ })
    });

Such factories still may be registered manually using exported `register`
function:

    const { register } = require('api-utils/xpcom');
    register(factoryToRegister);

All factories created using `Factory.new` also get unregistered automatically
when add-on is unloaded. This also can be disabled by setting `unregister`
option to `false`.

    var factoryToUnregister = Service.new({
      unregister: false,
      component: Unknown.extend({ /* Implementation */ })
    });

All registered services may be unregistered at any time using exported
`unregister` function:

    unregister(factoryToUnregister);

## Implementing XCOM services

Module exports `Service` exemplar object, that has exact same API as `Factory`
and can be used to register services:

    const { Service } = require('api-utils/xpcom');
    let service = Service.new({
      contract: '@examples/demo/service;1',
      description: 'My demo service',
      component: Unknown.extend({
        // Implementation
        get wrappedJSObject() this
      })
    });

Registered services can be accessed through the rest of the application via
standard XPCOM API:

    let s = Components.classes['@examples/demo/service;1'].
      getService(Components.interfaces.nsISupports);

In contrast to factories, services do not create instances of enclosed
components, they expose component itself. Also please note that idiomatic way
to work with a service is via `getService` method:

    s.wrappedJSObject === service.component // => true
