# dom-reduce

[![Build Status](https://secure.travis-ci.org/Gozala/dom-reduce.png)](http://travis-ci.org/Gozala/dom-reduce)

Small library for dealing with browser DOM events in a [reducible][reducers]
style. This lets operate on user events as with regular collection data
structures in composable manner.

## Usage

```js
var open = require("dom-reduce/event")
var map = require("reducers/map")
var filter = require("reducers/filter")
var fold = require("reducers/fold")
var takeWhile = require("reducers/take-while")

// Take stream of mouse move events.
var moves = open(document.documentElement, "mousemove")
// Map it to the axis positions
var axis = map(moves, function(event) {
  return { x: event.clientX, y: event.clientY }
})
// Filter down to the area we're interested in.
var lineAxis = filter(axis, function(value) {
  return value.x > 190 && value.x < 200
})

// Take positions only until mouse reaches the edge.
// Note that when this contidion is met event listeners
// will automatically be removed.
var values = takeWhile(lineAxis, function(value) {
  return value.y > 0
})

// Drow sowething in the given range.
fold(lineAxis, function(position) {
  draw(position)
})
```

## Install

    npm install dom-reduce

## Develop

Library is developed using awesome [browserify][]! [Phantomify][] is used
for running test in a [PhantomJS][].

[reducers]:https://github.com/Gozala/reducers
[browserify]:https://github.com/substack/node-browserify
[phantomify]:https://github.com/Gozala/phantomify
[phantomjs]:https://github.com/ariya/phantomjs
