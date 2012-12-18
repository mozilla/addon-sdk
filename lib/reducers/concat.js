"use strict";

var reducible = require("reducible/reducible")
var reduce = require("reducible/reduce")
var end = require("reducible/end")

var slicer = Array.prototype.slice

function append(left, right) {
  /**
  Returns sequences of items in the `left` sequence followed by the
  items in the `right` sequence.
  **/
  return reducible(function reduceConcatination(next, initial) {
    reduce(left, function reduceLeft(value, result) {
      return value === end ? reduce(right, next, result) :
             next(value, result)
    }, initial)
  })
}

function concat(left, right /*, ...rest*/) {
  /**
  Returns a sequence representing the concatenation of the elements in the
  supplied arguments, in the given order.

  print(concat([ 1 ], [ 2, 3 ], [ 4, 5, 6 ])) // => <stream 1 2 3 4 5 6 />

  **/
  switch (arguments.length) {
    case 1: return left
    case 2: return append(left, right)
    default: return slicer.call(arguments).reduce(append)
  }
}

module.exports = concat
