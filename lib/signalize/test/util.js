"use strict";

var spawn = require("../core").spawn

function into(signal) {
  var items = []
  spawn(signal, function(item) {
    items.push(item)
  })
  return items
}
exports.into = into