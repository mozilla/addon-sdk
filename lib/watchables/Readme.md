# Watchables

[![Build Status](https://secure.travis-ci.org/Gozala/watchables.png)](http://travis-ci.org/Gozala/watchables)

Library defines watchable value abstraction, in form of three [polymorphic
methods][method], where each one can be extended per type.

### watchers

[watchables/watchers](./watchables/blob/master/watchers.js) module provides
method that has no default implementation and supposed to be defined per type
that wishes to implement this watchable abstraction:

```js
var watchers = require("watchables/watchers")
function Type() { /* ... */ }
watchers.define(Type, function(value) {
  // return array of registered observes for the given value,
  // wthich is instance of `Type`.
})
```

### watch

[watchables/watch](./watchables/blob/master/watch.js) module provides
polymorphic method that comes with a default implementation. Given that it's
called with a value that implements `watchers` method and a observer function,
it will register given observer for the value unless it's already being
registered. Method can be defined for a specific type to better reflect
it's needs.

```js
var watch = require("wathchables/watch")
watch(new Type(), function() {
  console.log("!!!!")
})
```

Method can also be extended with a type specific implementation.


```js
var watch = require("wathchables/watch")
watch.define(Type, function(value, listener) {
  var listeners = value._listeners
  if (typeof(listeners) === "undefined")
    value._listeners = listener
  else if (typeof(listeners) === "function")
    value._listeners = [value._listeners, listener]
  else
    listeners.push(listener)
})
```


### unwatch

[watchables/unwatch](./watchables/blob/master/unwatch.js) module provides
polymorphic method that comes with a default implementation. Given that it's
called with a value that implements `watchers` method and a observer function,
it will unregister given observer for the value, if it's registered.

```js
var unwatch = require("wathchables/unwatch")
unwatch(value, myListener)
```

Method can be extended with a type specific implementation.

```js
var unwatch = require("wathchables/unwatch")
unwatch.define(Type, function(value, listener) {
  var listeners = value._listeners
  var index = -1
  if (typeof(listeners) === "function") {
    if (listeners === listener) value._listeners = void(0)
  } else if (listeners && ~(index = listeners.indexOf(listener))) {
    if (listeners.length === 2) {
      value._listeners = index === 0 ? listeners[1] : listeners[0]
    } else {
      listeners.splice(index, 1)
    }
  }
  return value
})

```


## Install

    npm install watchables

[method]:https://github.com/Gozala/method
