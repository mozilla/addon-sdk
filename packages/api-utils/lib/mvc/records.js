/* vim:set ts=2 sw=2 sts=2 expandtab */
/*jshint undef: true es5: true node: true devel: true
         forin: true latedef: false supernew: true */
/*global define: true */

(typeof define === "undefined" ? function ($) { $(require, exports, module); } : define)(function (require, exports, module, undefined) {

"use strict";

var Model = require("./models").Model;

exports.Record = Model.extend({
  initialize: function initialize() {
    var fields = this.fields, attributes = this.attributes, values = {};
    Object.keys(fields).forEach(function(name) {
      values[name] = fields[name](attributes[name]);
    });
    this.set(values, { silent: true });
  },
  validate: function validate(attributes) {
    var fields = this.fields, values = {};
    Object.keys(attributes).forEach(function(name, field) {
      if ((field = fields[name]))
        values[name] = field(attributes[name]);
      else
        throw Error("Record does not defines field '" + name + "'");
    });
    return values;
  }
});

/*

var Record = require("mvc/record").Record;
var guards = require('guards');

var PointModel = Record.extend({
  fields: {
    x: guards.Number(0),
    y: guards.Number(0)
  }
});

var point = PointModel.new({ x: 0, y: 0 });
point.set({ x: '5' })
*/

})
