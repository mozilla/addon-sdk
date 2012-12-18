"use strict";

var open = require("../event")
var reduced = require("reducible/reduced")
var fold = require("reducers/fold")
var filter = require("reducers/filter")
var into = require("reducers/into")

function define(exports, document) {
  var window = document.defaultView;

  function click(target) {
    var event = document.createEvent("MouseEvents")
    event.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0,
                         false, false, false, false, 0, null)
    target.dispatchEvent(event)
  }

  exports["test the dom events are reduced"] = function(assert) {
    var element = document.createElement("div")
    document.body.appendChild(element)


    var clicks = open(element, "click")
    var count = 0
    var result = fold(clicks, function(event, state) {
      assert.equal(event.target, element, "event target is element")
      count = count + 1
    }, 0)

    click(element)
    click(element)

    assert.equal(count, 2, "reducer was called twice")
    document.body.removeChild(element)
  }

  exports["test listeners removal"] = function(assert) {
    var element = document.createElement("div")
    document.body.appendChild(element)


    var clicks = open(element, "click")
    var count = 0
    var result = fold(clicks, function(event, state) {
      count = count + 1
      assert.equal(event.target, element, "event target is element")
      return reduced("stop!")
    }, 0)

    click(element)
    click(element)
    click(element)

    assert.equal(count, 1, "reducer stopped reduction early")
    assert.deepEqual(into(result), ["stop!"], "reducer accumulates value")
    document.body.removeChild(element)
  }


  exports["test multiple reducers"] = function(assert) {
    var element = document.createElement("div")
    document.body.appendChild(element)


    var clicks = open(element, "click")
    var profile = []

    var r1 = fold(clicks, function(event, state) {
      profile.push(1)
      assert.equal(event.target, element, "event target is element #1")
      if (profile.length === 3) return reduced("stop!")
    }, 0)

    var r2 = fold(clicks, function(event, state) {
      profile.push(2)
      assert.equal(event.target, element, "event target is element #2")
    })

    click(element)
    click(element)
    click(element)
    click(element)
    click(element)
    click(element)

    assert.deepEqual(profile, [1, 2, 1, 2, 2, 2, 2, 2],
                     "events were delivered in expected order")
    assert.deepEqual(into(r1), ["stop!"], "first reduce was stopped early")
    document.body.removeChild(element)
  }
}

module.exports = define;
