# eventual

[![Build Status](https://secure.travis-ci.org/Gozala/eventual.png)](http://travis-ci.org/Gozala/eventual)

This library defines abstraction for eventual values & data type implementing
this abstraction. This abstraction is identical to [promises][Promises/A] in
their intent and could be even called promises. Although API and behavior has
subtle differences from popular [Promises/A][Promises/A] specification there
for different name was chosen.

Main intent of the eventual abstraction is to represent eventual values, ones
that functions need to compute asynchronously and there for can not be returned.
Returning from functions is important, this enables us to form programs units in
form of black boxes defining data transformation flow between input and output.

### when

[when](./eventual/blob/master/when.js) module exports polymorphic function
that is implemented by eventual data type. It maybe used to track pending
eventual's realization. It also comes with default implementation that
calls `onRealize` handler with a value it's called with, unless it's type of
error. For `Error` values `when` is defined differently, error values are
treated as rejections and `onError` handler is called. This is one of the
key differences from the typical promise API. Another difference is that
if value passed to when is not pending, return of `onRealize` called with
values realization is returned, instead of eventual.


```js
var when = require("eventual/when")

when(1)                                         // => 1
when(2, function(x) { return x + 1 })           // => 3
when(Error("boom"), console.log, console.error) // => error: boom
```

## defer

[defer](./eventual/blob/master/defer.js) module exports function that may be 
used to make pending eventual value that later can be delivered.

```js
var defer = require("eventual/defer")
var deliver = require("pending/deliver")

var foo = defer()
deliver(foo, 3)

when(foo)   // => 3


var bar = defer()
var baz = defer()

deliver(bar, baz)
deliver(baz, 2)

when(bar)  // => 2
```

## apply

[apply](./eventual/blob/master/apply.js) module exports function that can be
used with eventual values, it treats each of it's arguments as eventual value
and returns a fresh one in return. Once all of the arguments are realized first
one is invoked with rest ones and return value is delivered to the resulting
eventual. If everything happens synchronously actual value is returned.


```js
var apply = require("eventual/apply")
var defer = require("eventual/defer")
var deliver = require("pending/deliver")

function sum(x y) { return x + y }
var x = defer()
var y = apply(sum, x, 3)

deliver(x, 2)
when(y)       // => 5
```


### decorate

[decorate](./eventual/blob/master/decorate.js) module exports function that
can be used to compose functions which take eventual values as arguments,
and returns eventual realized with result of applying realization values of
eventuals to a decorated `f`. If result is delivered in sync realization value
is returned instead.


```js
var eventual = require("eventual/apply")
var defer = require("eventual/defer")
var deliver = require("pending/deliver")

var sum = eventual(function(x y) { return x + y })
var x = defer()
var y = defer()

var xy = sum(x, y)

deliver(x, 2)
deliver(y, 3)
when(xy)       // => 5

sum(2, 2)      // => 4
sum(x, 1)      // => 3
```

### recover

[recover](./eventual/blob/master/recover.js) module exports function that
allows one to recover from an error if eventual value happen to be rejected.
It renturns an eventual that is either equivalent of given one or is realized
to return value of the recovery function, invoked with a rejection error.

```js
var recover = require("eventual/recover")
var defer = require("eventual/defer")
var deliver = require("pending/deliver")
var when = require("eventual/when")

var p1 = defer()
deliver(p1, Error("boom"))

var p2 = recover(p1, function() { return "np" })
when(p2)    // => np

var v1 = defer()
deliver(v1, "bye")

var v2 = recover(v1, function() { return "np" })
when(v2)    // => bye
```

### group

[group](./eventual/blob/master/group.js) module exports function that takes
array of eventual values and return single eventual value that is relized to
an array of delivery values for those eventuals. If any of the eventuals is
rejeceted with error, result is rejected with it too.

```js
var group = require("eventual/group")
var a = defer()
var b = defer()
var c = defer()
var abc = group([ a, b, c ])

deliver(a, 1)
deliver(b, 2)
deliver(c, 3)

when(abc)  // => [ 1, 2, 3 ]
```

### Eventual

[type](./eventual/blob/master/type.js) module exports function representing
data type of eventual values. Type implements `watchables`, `pending` and
`eventual` abstractions, where first two are defined in an external libraries.


## Install

    npm install eventual

[Promises/A]:http://wiki.commonjs.org/wiki/Promises/A
[pending]:https://github.com/Gozala/pending
[deliver]:https://github.com/Gozala/pending#deliver
