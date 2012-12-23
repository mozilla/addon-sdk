"use strict";

var method = require("method")
var watchers = require("./watchers")

var unwatch = method()
unwatch.define(function(value, watcher) {
  // Unregisters a `value` `watcher` if it"s being registered.
  var registered = watchers(value)
  var index = registered && registered.indexOf(watcher)
  if (index >= 0) registered.splice(index, 1)
  return value
})

module.exports = unwatch
