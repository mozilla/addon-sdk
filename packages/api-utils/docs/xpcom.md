<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

Module `xpcom` provides low level API for implementing and registering /
unregistering various XCOM interfaces.

## Implement interface

Module exports `Unknow` exemplar object, that may be extended to implement
specific XCOM interface(s). For example [nsIObserver]
(https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsIObserver) may be
implemented as follows:

        const { Unknown } = require('api-utils/xpcom');
        const { Cc, Ci } = require('chrome')
        const observerService = Cc["@mozilla.org/observer-service;1"].
                                getService(Ci.nsIObserverService);

        // Create my observer exemplar
        const MyObserver = Unknown.extend({
          interfaces: [ 'nsIObserver' ],    // Interfaces component implements
          topic: 'myTopic',
          initialize: function(fn) { this.fn = fn },
          register: function register() {
            observerService.addObserver(this, this.topic, this.fn);
          },
          unregister: function() {
            addObserver.removeObserver(this, this.topic, this.fn);
          },
          observer: function observer(subject, topic, data) {
            this.fn({
              subject: subject,
              type: topic,
              data: data
            });
          }
        });

        // create instances of observers
        var observer = MyObserver.new(function(event) {
          // handle notification
        });
        // register observer
        observer.register();

## Implementing XCOM services

Module exports `Service` exemplar object, that may be extended to implement
custom XPCOM services in JS:

      const { Service } = require('api-utils/xpcom');
      var MyComponent = Service.extend({
        // Interfaces implemented by this component.
        interfaces: [ 'nsIRequestObserver', 'nsIObserver' ],

        // nsIObserver properties
        observer: function() {
          // Implementation 
        },

        // nsIRequestObserver properties
        onStartRequest: function() {
          // Implementation
        },
        onStopRequest: function() {
          // Implementation
        }
      });

It's also recommended to implement `className`, `contractID` properties in your
components to have them well described. Otherwise those properties take very
generic values `'Jetpack service'` and `'@mozilla.org/jetpack/service;1'`. You
also may provide optional `classID` property that otherwise will be auto
generated via `uuid` module.

## Registering / Unregistering XCOM components

Module exports `register` and `unregister` functions to register / unregister
custom XPCOM components into runtime:

      const { register, unregister } = require('api-utils/xpcom');
      register(MyComponent);

Registered `services` may be accessed from anywhere in the runtime via
traditional XPCOM APIs.

      let observer = Cc[MyComponent.contractID].getService(Ci.nsIObserver)

Traditional XPCOM API will return a wrapped JS object exposing only an API
defined by a given interface. Underlaying JS object may be accessed via
`wrappedJSObject` property:

      observer.wrappedJSObject === MyComponent // true
      // or
      Cc[MyComponent.contractID].getService().wrappedJSObject === MyComponent // true

Unless registered component has `classUnregister` property with value `false` it
will be unregistered on add-on unload. Registered components can also be
manually unregistered using `unregister` function:

      unregister(MyComponent);

## Implementing XCOM factories

Module exports `Factory` exemplar object that may be extended to implement
custom XPCOM factories. `Factory` inherits all properties and behavior from
already described `Service` object and in addition implements `nsIFactory`
interface:

      const { Factory, register, unregister } = require('api-utils/xpcom');
      let Observer = xpcom.Factory.extend({
        interfaces: [ 'nsIObserver' ],
        observe: function() {
          // implementation
        }
      });

Unless `classRegister` properties are `false` factory very first instance
created by `Observer.new()` will register a factory component into runtime. Of
course component can be manually registered via `register` function.

Register factories can also be used with a traditional XPCOM API:

      let observer = Cc[Observer.contractID].createInstance(Ci.nsIObserver);

In contrast to `Observer.new()` such instantiation won't run `initialize` method
which should be manually called if necessary:

      observer.initialize(fn);

As mentioned above traditional `XPCOM` API will return wrap instances by
exposing only API defined by interface. For an access to underlaying object use
`wrappedJSObject` property.

      Observer.isPrototypeOf(observer.wrappedJSObject) // true
