# Changes

## 2.0.0 / 2012-11-23

  - Factor out [reducible][https://github.com/Gozala/reducible] abstraction
    into own package, that way we can avoid most of the API breaks.
  - Remove most of the non-essential / not commonly used APIs.
  - Remove **reduce** function in favor of [fold](./fold.js) with a more
    useful API.

## 1.0.3 / 2012-11-10

  - Update dependencies

## 1.0.2 / 2012-11-09

  - Improve definition for `arguments` object.

## 1.0.1 / 2012-11-06

  - Define API for [lazy](./lazy.js) creation of reducibles.
  - Improvements for [print][] function so that it could handle objects with
    circular references.
  - Fix [reduce][] so that errors thrown by handler are captured and cause
    rejections in returned promise.

## 1.0.0 / 2012-11-02

  - Add integration for browser based testing using [phantomify][].
  - Removed lots of low level APIs like `transform`, `trasformer`, `convert`
    in favor of enhanced `reducible` that also takes care of collection
    normalizations.
  - Errors no longer require boxing, instances of `Error`-s are treated as
    exceptions in a collection. Such collections are considered as broken &
    after error no values will be dispatched. Also [emit](./emit.js)-ing
    errors on [signal](./signal.js) / [channel](./channel.js) marks them
    as broken.
  - [End](./end.js) of stream no longer requires boxing, it's just a special
    data value that indicates end of stream. Anything followed in a collection
    passed that is ignored, also reducible's will ignore any subsequent values
    and will return [reduced](./reduced.js) result to signal they've done
    consuming.
  - Adding missing test cases.
  - Improvement to a `print` function that now also works in the browser.
  - New low level utility function [reducer](./reducer.js) that is just a sugar
    over [reducible](./reducible.js) that takes care of the boilerplate code
    for stateless transformation functions.
  - New [normalize](./normalize.js) utility function that can be used to wrap
    collections that are not guaranteed to comply to API contracts. Resulting
    collection is guaranteed to end or error only once and always pass in
    accumulated value returned in a last iteration.

## 0.2.1 / 2012-10-30

  - Fix bug in [hub](./hub.js) implementation that was not multiplexing on
    values that have derived from it like [channel](./channel.js) for example.

## 0.2.0 / 2012-10-28

  - Break API change for [signal](./signal.js) / [channel](./channel.js).
    They no longer throw exceptions on attempts to close or emit more data
    instead they return `accumulated` boxed value to signal they're closed.
  - Implement [pipe](./pipe.js) that can be used to pipe input right to an
    output (signal / channel / whatever implements [emit](./emit.js)).

## 0.1.6 / 2012-10-26

  - Add a lot more tests.
  - Create index with all end user functions.
  - Fix subtle bug in `hub` implementation.
  - Fix bug in `delay` implementation.

## 0.1.5 / 2012-10-25

  - Fix bug in implementation of `capture` that caused multiple ends.
  - Implement `delay` utility module.
  - Fix flatten that in edge cases leaked end of stream before it actually ended.
  - Implement lot's of new tests.

## 0.1.4 / 2012-10-24

  - Add transformation support for primitive types.

## 0.1.3 / 2012-10-24

  - Removed JSHint comments.
  - Remove experimental modules.
  - Implement `zip` function.
  - Remove dependency on zip package.

## 0.1.2 / 2012-10-24

  - Make `reduce` API on eventuals equivalent of API on values they resolve to.

## 0.1.1 / 2012-10-23

  - Define implementation of `accumulate` for eventual data types.

## 0.1.0 / 2012-10-21

  - Refactor reducers into idiomatic node structure of function per module.
  - Document each individual function.

## 0.0.3 / 2012-10-15

  - Implement client http API for reducers.
  - Implement clojure like `reductions` function.
  - Implement experimental `adjust` function.
  - Implement `concat` for parallel data structures.
  - Update to eventuals@0.3.0

## 0.0.2 / 2012-07-23

  - Rename channel abstraction to signal and define alternative
    channel abstraction
  - Implement lazy stream abstraction.
  - Extend `accumulate` with a default implementation for all values.
  - Define experimental `Binoid` type.
  - Define `sequential` decorator.
  - Implement error handling for reducers.
  - Implement `capture` function for error handling.
  - Implement `hub` function for sharing sequences across multiple consumers.
  - Make core independent of `promise` abstraction.
  - Implement `list` type.

## 0.0.1 / 2012-05-19

  - Initial release


[phantomify]:https://github.com/Gozala/phantomify
[print]:./debug/print.js
[reduce]:./reduce.js
