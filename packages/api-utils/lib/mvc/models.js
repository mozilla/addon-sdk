/* vim:set ts=2 sw=2 sts=2 expandtab */
/*jshint undef: true es5: true node: true devel: true
         forin: true, eqnull: true */
/*global define: true */

(typeof define === "undefined" ? function ($) { $(require, exports, module); } : define)(function (require, exports, module, undefined) {

"use strict";

var { EventEmitter } = require('./events');

var isArray = Array.isArray;
function isFunction(value) { return typeof value === "function"; }
function getOwnPropertyDescriptors(object) {
  var descriptors = {};
  Object.getOwnPropertyNames(object).forEach(function(name) {
    descriptors[name] = Object.getOwnPropertyDescriptor(object, name);
  });
  return descriptors;
}
function extend(target) {
  Array.prototype.forEach.call(arguments, function(source) {
    if (source !== target)
      Object.defineProperties(target, getOwnPropertyDescriptors(source));
  });
  return target;
}

var Model = EventEmitter.extend({
  new: function Model(attributes, options) {
    var model = Object.create(this, { attributes: { value: {} } });
    var defaults = model.defaults;
    if (isFunction(defaults))
      defaults = defaults();
    attributes = extend({}, defaults, attributes || {});

    model.set(attributes, { silent : true });
    if (options && 'collection' in options && options.collection)
      model.collection = model.collection;
    model.initialize(attributes, options);
    return model
  },
  isNew: function isNew() {
    return !this.id;
  },
  /**
   * The attributes property is the internal hash containing the model's state.
   * Please use set to update the attributes instead of modifying them
   * directly. If you'd like to retrieve and munge a copy of the model's
   * attributes, use `toJSON` instead.
   */
  // attributes: null,
  /**
   * The defaults hash can be used to specify the default attributes for your
   * model. When creating an instance of the model, any unspecified attributes
   * will be set to their default value.
   */
  defaults: {},
  /**
   * A special property of models, the id is an arbitrary string (integer id
   * or UUID). If you set the id in the attributes hash, it will be copied onto
   * the model as a direct property. Models can be retrieved by id from
   * collections.
   */
  //id: null,
  /**
   * Attribute name that is mapped to an `id` property of this model. Analog to
   * primary key in DB.
   */
  '@' : 'id',
  /**
   * Initialize is an empty function by default. Override it with your own
   * initialization logic.
   * @param {Object} attributes
   * @param {Object} options
   */
  initialize : function initialize(attributes, options) { return this; },
  /**
   * Consumer must implement custom validation logic in this method. Method is
   * called by a `set`, and is passed the attributes that are about to be
   * updated. If the model and attributes are valid, don't return anything from
   * validate. If the attributes are invalid, throw an Error of your choice. It
   * can be as simple `Error` with an error message to be displayed, or a
   * complete error object that describes the error programmatically. `set` and
   * save will not continue if validate returns an error.
   * Failed validations trigger an "error" event.
   * @param {Object} attributes
   *    Map of key values that needs to be validated before they are set.
   */
  validate: function validate(attributes) { return attributes; },
  prase: function parse(data) { return data; },
    // Returns `true` if the attribute contains a value that is not null
  // or undefined.
  has: function(attr) {
    return this.attributes[attr] != null;
  },

  /**
   * Get the current value of an attribute from the model.
   */
  get: function get(key) {
    return this.attributes[key];
  },
  /**
   * Set a hash of attributes (one or many) on the model. If any of the
   * attributes change the models state, a "change" event will be triggered,
   * unless {silent: true} is passed as an option. Change events for specific
   * attributes are also triggered, and you can bind to those as well, for
   * example change:title, and change:content.
   */
  set: function set(attributes, options) {
    var changes, silent, id;
    // Validate all the attributes using internal validation mechanism. If
    // new attributes are returned that means that values were formated or
    // overridden by a validator.
    attributes = Model.isPrototypeOf(attributes) ? attributes.attributes
                                                 : attributes;
    attributes = this.validate(attributes);

    silent = options && options.silent;

    // Check for changes of `id`.
    if ((id = attributes[this['@']]))
      this.id = id;

    Object.keys(attributes).forEach(function(key) {
      var previous = this.attributes[key];
      var value = this.attributes[key] = attributes[key];

      if (!silent && previous !== value) {
        this.emit("change:" + key, ((changes || (changes = {}))[key] = {
          key: key, previous: previous, value: value
        }), this, options);
      }
    }, this);

    if (!silent && changes)
      this.emit("change", changes, this, options);

    return this;
  },

  clone: function clone() {
    return new Object.getPrototypeOf(this).new(this.attributes);
  },

  save: function save(attributes, options) {
    options = options || {};
    if (attributes)
      this.set(attributes, options);

    this.sync({
      type: this.isNew() ? "create" : "update",
      model: this,
      options: options
    })
  },

  fetch: function fetch(options) {
    options = options || {};
    var model = this;
    var success = options.success;
    options.success = function(response) {
      model.set(model.parse(response), options);
      if (success) success(model, response);
    };

    this.sync({ type: "read", model: this, options: options });
  },

  /**
   * Remove an attribute by deleting it from the internal attributes hash.
   * Fires a "change" event unless silent is passed as an option.
   */
  unset: function unset(attributes, options) {
    var changes, silent;

    silent = options && options.silent;
    (isArray(attributes) ? attributes : [attributes]).forEach(function(key) {
      // Check for changes of `id`.
      if (key === this['@'])
        this.id = null;

      var previous = this.attributes[key];
      delete this.attributes[key];
      var value = this.attributes[key];

      if (!silent && previous !== value) {
        this.emit("change:" + key, ((changes || (changes = {}))[key] = {
          key: key, previous: previous, value: value
        }));
      }
    }, this);

    if (!silent && changes)
      this.emit("change", changes);
  },
  /**
   * Removes all attributes from the model. Fires a "change" event unless
   * silent is passed as an option.
   */
  clear: function clear(options) {
    this.unset(Object.keys(this.attributes), options);
  },

  destroy: function destroy(options) {
    this.sync({ type: "delete", model: this, options: options });
  },

  /**
   * Return a copy of the model's attributes for JSON stringification. This can
   * be used for persistence, serialization, or for augmentation before being
   * handed off to a view. The name of this method is a bit confusing, as it
   * doesn't actually return a JSON string — but I'm afraid that it's the way
   * that the [JavaScript API for JSON.stringify works]
   * (https://developer.mozilla.org/en/JSON#toJSON()_method).
   */
  toJSON: function toJSON() {
    return JSON.parse(JSON.stringify(this.attributes));
  }
});
exports.Model = Model;

});
