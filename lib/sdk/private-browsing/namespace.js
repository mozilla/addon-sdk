'use strict';

const privateNS = require('../core/namespace').ns();

function getOwnerWindow(thing) {
  if (thing === undefined)
  	return undefined;
  let fn = (privateNS(thing.prototype) || {}).getOwnerWindow;
  if (fn)
    return fn.apply(fn, [thing].concat(arguments))
  return undefined;
}
getOwnerWindow.define = function(Type, fn) {
  privateNS(Type.prototype).getOwnerWindow = fn;
}

exports.getOwnerWindow = getOwnerWindow;
