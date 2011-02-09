'use strict'

var ERR_CONFLICT = 'Remaining conflicting property: '
,   ERR_REQUIRED = 'Missing required property: '

exports.Data = function Data(value, enumerable, configurable, writable) {
  return (
  { value: value
  , enumerable: false !== enumerable
  , configurable: false !== configurable
  , writable: false !== writable
  })
}

exports.Method = function Method(method, enumerable, configurable, writable) {
  return (
  { value: method
  , enumerable: false !== enumerable
  , configurable: false !== configurable
  , writable: false !== writable
  })
}

exports.Accessor = function Accessor(get, set, enumerable, configurable) {
  return (
  { get: get
  , set: set
  , enumerable: false !== enumerable
  , configurable: false !== configurable
  })
}

exports.Required = function Required(name) {
  function required() { throw new Error(ERR_REQUIRED + name) }
  return (
  { get: required
  , set: required
  , required: true
  })
}

exports.Conflict = function Conflict(name) {
  function conflict() { throw new Error(ERR_CONFLICT + name) }
  return (
  { get: conflict
  , set: conflict
  , conflict: true
  })
}

