# reducers

[![Build Status](https://secure.travis-ci.org/Gozala/reducers.png)](http://travis-ci.org/Gozala/reducers)

Library for higher-order manipulation of collections, based upon [reduce][].

## Rationale

Most functional languages (including beloved JS) typically come with some
collection transformation functions like [filter][] and [map][] that take a
logical collections and return transformed version of it. Unfortunately they
tend to [complect][], by implying mechanism, order, laziness and
representation. This library is an attempt to provide simple solution for
some of the hard problems by decomplecting and building upon simple premise -
minimum definition of collection is something that is reducible.

More specifically library defines super-generalized and minimal abstraction for
collections - a collection is some set of things that, when given a function to
apply to its contents, can do so and give you the result, i.e. a collection is
(at minimum) **reducible**. In other words, you can call `reduce` on it.

A very minimal abstraction for collection is more powerful than it may seem at
first!

## Basics

Demonstration of features of this library requires some basic understanding of
the abstraction above. So let's take a more practical look at the idea. Let's
say we have a `reduce` function with *(very familiar)* API:

```js
reduce(source, f, initial) // => accumulated result
```

It takes reducing function, a reducible `source` and `initial` value to
accumulate reductions upon. In return it outputs an accumulated result.
Reducing functions performing accumulation have a following shape:

```js
f(result, value) // => new result
```

A reducing function is simply a binary function, akin to the one you might pass
to reduce. While the two arguments might be treated symmetrically by the
function, there is an implied semantic that distinguishes the arguments:
the first argument is a `result` or accumulator that is being built up by the
reduction, while the second is some new input `value` from the source being
reduced.

## Transformations

All of the collection operations can be expressed in terms of transformations.
By the definition all transformations will produce **reducible** collections
that can be reduced via `reduce` function defined above:

```js
map(source, JSON.parse) // => reducible collection
filter(numbers, isEven) // => reducible collection
```

In order to explain transformations we'll need a primitive API for producing
**reducible** collections. Let's define one in form of `reducible` function
that takes `accumulator` function and returns something that can be reduced
via `reduce` function:


```js
reducible(accumulator) // => reducible
```

Argument it takes, `accumulator` is a function that performs has following shape:

```js
accumulate(next, initial) // => accumulated result
```

And when invoked it performs reductions via `next` reducing function starting
from `initial` result.


Now consider following implementation of `map` & `filter` transformation
functions:

```js
function map(f, source) {
  return reducible(function accumulator(next, initial) {
    return reduce(source, function reducer(result, input) {
      return next(result, f(input))
    }, initial)
  })
}

function filter(predicate, source) {
  return reducible(function accumulator(next, initial) {
    return reduce(source, function reducer(result, input) {
      return predicate(input) ? next(result, input) : result
    }, initial)
  })
}
```

There are a few things to note here:

  - Type of the source is irrelevant as long as it is reducible and there for
    can be reduced via `reduce` function.
  - Transformations do not traverse collections, instead they compose results
    that can be reduced by a receiver of the result later.
  - Transformations do not imply timing in which `reducer` in invoked with an
    each `input` of the `source`, there for `source` can be asynchronous.
  - Filtering can *skip* inputs by simply returning the incoming result.


## Features

### Laziness

Library consists of transformation functions which, as seen above, when called
do nothing except the creation of a recipe for a new collection, a recipe that
is itself reducible. No work is done yet to the contained elements and no
concrete collection is produced. All the transformations defer actual work
to a point where result of transformations pipeline is being reduced.

The beautiful thing is that this mechanism also works for all other traditional
transformations `take`, `drop`, `merge` etc. Note the fact that `filter` is
(potentially) contractive, and flatten is (potentially) expansive per step -
the mechanism is general and not limited to 1:1 transformations.

### Uniformity

Transformation functions are absolutely agnostic of the actual type of the
`source`, as they just describe transformations and leave it up to `source`
to do a reduction when result is consumed.

Library takes a advantage of this feature and takes it even step further by
treating every possible value as a reducible collection. Non collection values
like numbers, booleans, objects etc. are treated as collection of single item,
item being a value. Also `null` and `undefined` are considered as empty
collections.

This means that library can be used on any data type and more importantly
transformations between different data types & compose naturally, which is
great, let's you define logic in terms of abstractions instead of specific
types.

### Composability

All the transformations are fully composable as a matter of fact transformation
pipelines produce compositions equivalent of a function compositions created by
a [compose][]. Also type agnostic nature of the transformation functions enables
compositions between different types of data.

### Performance

Since transformations doesn't do the work, but merely create a recipe, there is
no per-step allocation overhead, so it's faster. Also note that transformations
are composed by curring transformation functions and all the actual work happens
in a pipe line at the end when result is consumed, which means that no
intermediate collections are produced, unlike it's a case with arrays etc..

Think [monad][] & [category theory][] if you fancy that.

It can even [outperform arrays][benchmarks] when used wisely, although it's not
the point & arrays are not the primary use case.

### Asynchronicity

As it was already pointed out transformation functions do not imply any timing
of individual value delivery, which means they can be used on asynchronous
data structures like [node streams][stream-reduce] or [FRP][] events & signals.

This feature is extremely powerful as it allows structuring complex asynchronous
programs in simple intuitive code without a [callback hell][] and manual error
propagation. _See [lstree][] for examples_.

Even better actually exact same code can be used with both synchronous and
asynchronous data structures. For example exact same code in [fs-reduce][]
can be forced to do blocking IO by via `options.sync` option.

### Extensibility

Since transformations are `source` type agnostic it's highly extensible. In
fact implementation is based of polymorphic [method][] dispatch library and
enables one to add support for new data types without any changes to this
library or data types / classes them self. This feature is used by
[stream-reduce][] library to add support for node streams. There are more
examples of this feature in [callback-reduce][], [dom-reduce][],
[http-reduce][]...

Very likely all data types like `signal` provided by this library will be move
out into own libraries too.

### Automatic disposal

Reducible data structures feature auto cleanup of the resources at the end of
consumption. For example [dom-reduce][] and [fs-reduce][] use this feature to
remove event listeners / close file descriptors once input is consumed and to
set you free from clean up constraints. This means you spend more time on
actual problems rather and less on plumbing.

### Infinity

Infinite data structures can be trivially represented via reducibles since
nothing implies the end. In fact [dom-reduce][] uses this feature to represent
user events in form of reducibles that pretty much can be infinite.

That being said reducibles are not the best abstraction for the some types of
infinite data structures specially ones that rather better be polled instead.

## F.A.Q.


##### 1. Q: Can this handle "back pressure" ?  
   
**A:** Short answer is **Yes**.

See [IO Coordination] for more detailed answer




## Install

    npm install reducers

## Prior art

- [Clojure reducers][]
- [Haskell Enumerator/Iteratee][]

[Clojure reducers]:http://clojure.com/blog/2012/05/15/anatomy-of-reducer.html
[Haskell Enumerator/Iteratee]:http://www.haskell.org/haskellwiki/Enumerator_and_iteratee

[reduce]:http://en.wikipedia.org/wiki/Reduce_%28higher-order_function%29
[map reduce]:http://en.wikipedia.org/wiki/MapReduce
[map]:https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/map
[filter]:https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/filter
[Uniformity]:http://en.wikipedia.org/wiki/Uniformity_%28complexity%29#Uniformity
[complect]:http://www.infoq.com/presentations/Simple-Made-Easy
[compose]:http://underscorejs.org/#compose
[monad]:http://en.wikipedia.org/wiki/Monad_%28category_theory%29
[Category theory]:http://en.wikipedia.org/wiki/Category_theory]
[benchmarks]:http://jsperf.com/reducibles/4
[stream-reduce]:https://github.com/Gozala/stream-reduce
[FRP]:http://en.wikipedia.org/wiki/Functional_reactive_programming
[method]:https://github.com/Gozala/method
[callback-reduce]:https://github.com/Gozala/callback-reduce
[dom-reduce]:https://github.com/Gozala/dom-reduce
[http-reduce]:https://github.com/Gozala/http-reduce
[callback hell]:http://callbackhell.com/
[fs-reduce]:https://github.com/Gozala/fs-reduce
[lstree]:https://github.com/Gozala/callback-reduce

[IO Coordination]:https://github.com/Gozala/reducers/wiki/IO-Coordination
