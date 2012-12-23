# pending

[![Build Status](https://secure.travis-ci.org/Gozala/pending.png)](http://travis-ci.org/Gozala/pending)

Package defines pending value abstraction in form of three [polymorphic
methods][method], where each one can be extended per type. This abstraction
likely to be used in conjunction with [watchable][watchable].


### isPending

[pending/is](./pending/blob/master/is.js) module provides method that must
return `true` for all pending values and return `false` for all others. Method
has default implementation that returns `false`. Types that wish to implement
this abstraction should return `true` while value is considered pending.

```js
var isPending = require("pending/is")

function Pending() {
  this._result = this
  this._pending = true
  this._listeners = []
}
isPending.define(Pending, function(value) {
  return value._pending
})

isPending(5)              // => false
isPending({})             // => false
isPending(new Pending)    // => true
```

### await

[pending/await](./pending/blob/master/await.js) module provides method that
can be used to register listener that must be called once value is no longer
pending. Method has default implementation that calls listener immediately
with a value since non of the built-in types considered to be pending. Custom
types wishing to implement this abstraction should define this method such
that all registered listeners will be invoked with a delivery value once
they it transitions to non-pending state.

```js
var await = require("pending/await")
await(3, console.log)       // => info: 3
await({}, console.log)      // => info: {}

await.define(Pending, function(value, handler) {
  if (!isPending(value)) handler(value._result)
  else if (!~value._listeners.indexOf(handler)) value._listeners.push(handler)
})
```

### deliver

[pending/deliver](./pending/blob/master/deliver.js) module provides method
that can is supposed to doliver pending values and transition them form
pending to non-pending state, such transition supposed to happen only once.
Method does not comes with default implementation as non of the built-ins are
considered pending, there for attempt to call it on values that don't
implement it will throw. Custom types wishing to implement pending
abstraction may choose to implement it, although it's optional since some
pending values may be observable but not deliverable.


```js
var deliver = require("pending/deliver")
deliver.define(Pending, function(value, result) {
  // Ignore delivery for no longer pending values, or
  // if value delivery is already in progress.
  if (isPending(value) && value._result === value) {
    // Empty listeres array to allow registration of new listeners
    // in side effect to dispatch, in order to guarantee FIFO order.
    var count = 0
    var index = 0
    var listeners
    value._result = result
    while (index <= count) {
      if (index === count) {
        listeners = value._listeners.splice(0)
        count = listeners.length
        index = 0
        if (count === index) {
          value._pending = false
          index = index + 1
        }
      } else {
        listeners[index](result)
        index = index + 1
      }
    }
  }
})
```

## Install

    npm install pending

[watchable]:https://github.com/Gozala/watchable
