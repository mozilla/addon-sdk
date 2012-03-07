<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

Module provides core (low level) API for working with events in the SDK. This
API is mainly for implementing higher level event APIs.

Event `listener` may be registered on any (event `target`) object using
provided `on` function:

    var { on, once, off, emit } = require('api-utils/event/core');
    var target = { name: 'target' };
    on(target, 'message', function listener(event) {
      console.log('hello ' + event);
    });
    on(target, 'data', console.log);

Event of specific `type` may be emitted on any event `target` object using
`emit` function. This will call all registered `listener`s for the given `type`
on the given event `target` in the same order they were registered.

    emit(target, 'message', 'event');
    // info: 'hello event'
    emit(target, 'data', { type: 'data' }, 'second arg');
    // info: [Object object] 'second arg'

Registered event listeners may be removed using `off` function:

    off(target, 'message');
    emit(target, 'message', 'bye');
    // info: 'hello bye'

Sometimes listener only cares about first event of specific `type`. To avoid
hassles of removing such listeners there is convenient `once` function:

    once(target, 'load', function() {
      console.log('ready');
    });
    emit(target, 'load')
    // info: 'ready'
    emit(target, 'load')

There are also convenient ways to remove registered listeners. All listeners of
the specific type can be easily removed (only two argument must be passed):

    off(target, 'message');

Also, removing all registered listeners is possible (only one argument must be
passed):

    off(target);
