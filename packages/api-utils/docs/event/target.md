<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

Provides an exemplar `EventTarget` object, that implements interface for
adding removing event listeners of a specific type. `EventTarget` is a
base of all objects in SDK on which events are emitted.

### Instantiation

It's easy to create event target objects, no special arguments are required.

    const { EventTarget } = require('api-utils/event/target');
    let target = EventTarget.new();

For a convenience though optional `options` arguments may be used, in which
case all the function properties with keys like: `onMessage`, `onMyEvent`...
will be auto registered for associated `'message'`, `'myEvent'` events on
the created instance. _All other properties of `options` will be ignored_.

### Adding listeners

`EventTarget` interface defines `on` method, that can be used to register
event listeners on them for the given event type:

    target.on('message', function onMessage(message) {
      // Note: `this` pseudo variable is an event `target` unless
      // intentionally overridden via `.bind()`.
      console.log(message);
    });

Sometimes event listener may care only about very first event of specific
`type`. `EventTarget` interface defines convenience method for adding one
shot event listeners via method `once`. Such listeners are called only once
next time event of the specified type is emitted:

    target.once('ready', function onReady() {
      // Do the thing once ready!
    });

### Removing listeners

`EventTarget` interface defines API for unregistering event listeners, via
`removeListener` method:

    target.removeListener('message', onMessage);

### Emitting events

`EventTarget` interface intentionally does not defines an API for emitting
events. In majority of cases party emitting events is different from party
registering listeners. In order to emit events one needs to use `event/core`
module instead:

    let { emit } = require('api-utils/event/core');

    target.on('hi', function(person) { console.log(person + 'tells hi'); });
    emit(target, 'hi', 'Mark');
    // info: 'Mark tells hi'

For more details see **event/core** documentation.

### More details

Listeners registered during the event propagation (by one of the listeners)
won't be triggered until next emit of the matching type:

    let { emit } = require('api-utils/event/core');

    target.on('message', function onMessage(message) {
      console.log('listener trigerred');
      target.on('message', function() {
        console.log('nested listener triggered');
      });
    });

    emit(target, 'message');
    // info: 'listener trigerred'
    emit(target, 'message');
    // info: 'listener trigerred'
    // info: 'nested listener trigerred'

Exceptions in the listeners can be handled via `'error'` event listeners:

    target.on('boom', function() {
      throw Error('Boom!');
    });
    target.once('error', function(error) {
      console.log('caught an error: ' + error.message);
    });
    emit(target, 'boom');
    // info: caught an error: Boom!

If there is no listener registered for `error` event or if it also throws
exception then such exceptions are logged into a console.
