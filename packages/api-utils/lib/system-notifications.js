/* vim:set ts=2 sw=2 sts=2 expandtab */
/*jshint asi: true undef: true es5: true node: true devel: true browser: true
         forin: true latedef: false */
/*global define: true */

'use strict';

const { Cc, Ci, Cr, Cm, components: { Constructor: CC } } = require('chrome')
const observerService = Cc["@mozilla.org/observer-service;1"].
                        getService(Ci.nsIObserverService)

exports.notifications = function notifications(topic) {
  return function stream(next, stop) {
    observerService.addObserver(function observe(subject, topic, data) {
        if (false === next({ subject: subject, topic: topic, data: data }))
          observerService.removeObserver(observer, topic)
    }, topic, false)
  }
}

exports.next = function next({ subject, topic, data }) {
  observerService.notifyObservers(subject, topic, data)
}
