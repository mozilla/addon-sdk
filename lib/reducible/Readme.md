# reducible

[![Build Status](https://secure.travis-ci.org/Gozala/reducible.png)](http://travis-ci.org/Gozala/reducible)

Library defines higher-order abstraction for reducible data structures -
collections based upon [reduce][].

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

## reducers

This library provides an abstraction for **reducible** data structures and
implementation of internal [reduce][] for built-in data types. It can be used
to implement to define abstraction for all other types. This is also foundation
for [reducers][] - Library for higher-order manipulation of reducible
collections.

## Install

    npm install reducible

## Prior art

- [Clojure reducers][]
- [Haskell Enumerator/Iteratee][]

[Clojure reducers]:http://clojure.com/blog/2012/05/15/anatomy-of-reducer.html
[Haskell Enumerator/Iteratee]:http://www.haskell.org/haskellwiki/Enumerator_and_iteratee

[reducers]:https://github.com/Gozala/reducers
[reduce]:http://en.wikipedia.org/wiki/Reduce_%28higher-order_function%29
[map]:https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/map
[filter]:https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/filter
[complect]:http://www.infoq.com/presentations/Simple-Made-Easy
