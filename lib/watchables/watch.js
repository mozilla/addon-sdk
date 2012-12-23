"use strict";

var method = require("method")
var watchers = require("./watchers")

var watch = method("watch")
watch.define(function(value, watcher) {
  // Registers a `value` `watcher`, unless it"s already registered.
  var registered = watchers(value)
  if (registered && registered.indexOf(watcher) < 0)
    registered.push(watcher)
  return value
})

module.exports = watch
