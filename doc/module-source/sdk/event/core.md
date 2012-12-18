<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

Many modules in the SDK can broadcast events. For example, the
[`tabs`](modules/sdk/tabs.html) module emits an `open` event when a new tab
is opened.

The `event/core` module enables you to create APIs that broadcast events.
Users of your API can listen to the events using the standard `on()` and
`once()` functions.

Also see the
[tutorial on implementing event targets](dev-guide/tutorials/event-targets.html)
to get started with this API.

An event `listener` may be registered to any event `target` using the
`on` function:

    var { on, once, off, emit } = require('api-utils/event/core');
    var target = { name: 'target' };
    on(target, 'message', function listener(event) {
      console.log('hello ' + event);
    });
    on(target, 'data', console.log);

An event of a specific `type` may be emitted on any event `target`
object using the `emit` function. This will call all registered
`listener`s for the given `type` on the given event `target` in the
same order they were registered.

    emit(target, 'message', 'event');
    // info: 'hello event'
    emit(target, 'data', { type: 'data' }, 'second arg');
    // info: [Object object] 'second arg'

Registered event listeners may be removed using `off` function:

    off(target, 'message');
    emit(target, 'message', 'bye');
    // info: 'hello bye'

Sometimes listener only cares about first event of specific `type`. To avoid
hassles of removing such listeners there is a convenient `once` function:

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
