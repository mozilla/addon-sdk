"use strict";

var core = require("./core")
var spawn = core.spawn
var END = core.END

function Pipe() {}
Pipe.prototype.ended = false
Pipe.prototype.output = null

function pipe() {
  return new Pipe()
}
exports.pipe = pipe

function input(pipe) {
  var signal = {}
  spawn.implement(signal, function(self, next) {
    if (pipe.output) throw Error("Pipe is already spawned")
    pipe.output = next
  })
  return signal
}
exports.input = input

function emit(pipe, value) {
  if (pipe.ended) throw Error("Signal was ended")
  if (value === END) pipe.ended = true
  return pipe.output && pipe.output(value)
}
exports.emit = emit