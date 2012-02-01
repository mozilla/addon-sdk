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

Module exports `Service` exemplar object, that may be used to create a services
out of custom XPCOM components in JS:

      const { Service, Unknown } = require('api-utils/xpcom');
      const MyService = Service.new({
        component: Unknown.extend({
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
        })
      });

It's also recommended to pass additional `name` and `contract` options for a
better descriptions in runtime:

      const { Service, Unknown } = require('api-utils/xpcom');
      const MyObserver = Unknown.extend({
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

      const myService = Service.new({
        className: 'observer',
        contractID: '@foo.com/my/observer;1',
        component: MyComponent
      });

If those options are omitted generic values `'Jetpack service'` and
`'@mozilla.org/jetpack/service;1'` are used. You also may provide optional `id`
for the service that otherwise will be auto generated via `uuid` module.


## Registering / Unregistering XCOM components

Services created using `Service.new` will automatically register into runtime
unless explicitly specified otherwise:

      var manualService = Service.new({
        register: false,
        component: Unknown.extend({ /* ... */ })
      });

Module exports `register` and `unregister` function that may be used to
register / unregister XPCOM services manually.

      const { register, unregister } = require('api-utils/xpcom');
      register(manualService);

Registered services will become available to the rest of the runtime via
traditional XPCOM API:

      Cc[myService.contractID].getService(Ci.nsIObserver)

Keep in mind that traditional XPCOM interface will always return a wrapped JS
objects exposing only an properties defined by a given interface:

      Cc[myService.contractID].getService(Ci.nsIObserver) === MyObserver // => false

Underlaying JS object may be accessed via `wrappedJSObject` property:

      Cc[MyService.contractID].getService().wrappedJSObject === MyObserver // => true

All services created using `Service` will automatically be unregistered on
add-on unload unless explicitly specified otherwise via `unregister` flag:

      var manualService = Service.new({
        unregister: false,
        component: Unknown.extend({ /* ... */ })
      });

Registered services can be unregistered using `unregister` function:

      unregister(MyComponent);


## Implementing XCOM factories

Module exports `Factory` exemplar object that may be used to implement custom
XPCOM factories. `Factory` implements exact same API as already described
`Service`:

      const { Factory } = require('api-utils/xpcom');
      let Observer = Unknown.extend({
          initialize: function initialize(f) {
            this.listener = f;
          },
          interfaces: [ 'nsIObserver' ],
          observe: function() {
            // implementation
          }
        }
      });

      let ObserverFactory = xpcom.Factory.new({ component: Observer });

In contrast to services, that are singletons and are obtained via `getService`,
factories produce instances of it's components:

      let observer = Cc[ObserverFactory.contractID].createInstance(Ci.nsIObserver);

As already mentioned traditional `XPCOM` API will return wrap instances by
exposing only API defined by a given interface.

      Observer.isPrototypeOf(observer)  // => false

In order to get access to underlaying object `wrappedJSObject` property may be
used.

      Observer.isPrototypeOf(observer.wrappedJSObject) // => true

Instantiation through XPCOM API is also different from regular instantiation
`Observer.new(f)` which calls `initialize`. When creating instances through
XPCOM API initialization should be performed manually:

      let observer =  Cc[ObserverFactory.contractID].createInstance(Ci.nsIObserver);
      observer.wrappedJSObject.initialize(f);
