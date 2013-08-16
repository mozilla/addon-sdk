/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

module.metadata = {
  "stability": "unstable"
};

const { Cu } = require("chrome");
const method = require("method/core");
const { curry, compose, partial, when,
        method: asMethod, apply, constant } = require("../lang/functional");
const { viewFor } = require("../view/core");
const { find } = require("../util/array");


// Utility function that is just an enhancement over `method` to
// allow predicate based dispatch in addition to polymorphic
// dispatch. Unfortunately polymorphic dispatch does not quite
// cuts it in the world of XPCOM where no types / classes exist
// and all the XUL nodes share same type / prototype.
// Probably this is more generic and belongs some place else, but
// we can move it later once this will be relevant.
let dispatcher = (hint) => {
  let base = method(hint);
  // Make a map for storing predicate, implementation mappings.
  let implementations = new Map();

  // Dispatcher function goes through `predicate, implementation`
  // pairs to find predicate that matches first argument and
  // returns application of arguments on the associated
  // `implementation`. If no matching predicate is found delegates
  // to a `base` polymorphic function.
  let dispatch = (...args) => {
    var value = args[0]
    for (let [predicate, implementation] of implementations) {
      if (predicate(value))
        return implementation.apply(implementation, args);
    }

    return base.apply(base, args);
  };

  // TODO: Remove this line
  dispatch.implementations = implementations;
  // Expose base API.
  dispatch.define = base.define;
  dispatch.implement = base.implement;
  dispatch.toString = base.toString;

  // Add a `where` function to allow extending function via
  // predicates.
  dispatch.where = (predicate, implementation) => {
    if (implementations.has(predicate))
      throw TypeError("Already implemented for the given condition")
    implementations.set(predicate, implementation);
  }

  return dispatch;
};

// Define `modelFor` accessor function that can be implemented
// for different types of views. Since view's we'll be dealing
// with don't quite have reliable prototypes we're gonig to use
// extension over polymorphic dispatch. This allows models to
// extend implementations by providing predicates:
//
// modelFor.where($ => $ instanceof Ci.nsIDOMWindow, getModel(Browser))
let modelFor = dispatcher("modelFor");
exports.modelFor = modelFor;

// Map that maps model prototypes to a map of model instances to
// views. This abstraction let's us care less about
let viewsByType = new WeakMap();

// Given a `model` and `options.view` does a side effect of
// mapping them. From this point calling `viewFor(model)` will
// return `options.view` until `detachView(model)` is called.
let attachView = (model, {view}) => {
  let prototype = Object.getPrototypeOf(model);
  // If model prototype has no model to view map associated
  // yet create one.
  if (!viewsByType.has(prototype))
    viewsByType.set(prototype, new WeakMap());

  let views = viewsByType.get(prototype);

  views.set(model, view);
}
exports.attachView = attachView;

// Given a `model` that has view attached by calling:
// `attachView(model, { view: view })`
// function detaches view.
let detachView = (model) => {
  let prototype = Object.getPrototypeOf(model);
  let views = viewsByType.get(prototype);
  // If mapping for views does not even existis, something is really
  // wrong!
  if (!views)
    throw Error("Can't detach view form untracked model type");

  views.delete(model);
}
exports.detachView = detachView;

// Given a `model` returns view that was previously attached to it.
let getView = (model) => {
  let prototype = Object.getPrototypeOf(model);
  let views = viewsByType.get(prototype);
  return views.get(model);
}
// Make `getView` a default implementation for
// the `viewFor` polymorphic function.
viewFor.define(getView);
exports.getView = getView;

// Given a model constructor and a `view` returns model it is
// associated with. For convinience `getModel` supports implicit
// currying so that view accessors per type can be easily created.
let getModel = curry((Type, view) => {
  let prototype = Type.prototype;
  let views = viewsByType.get(prototype);
  // To avoid circular references that needs to be broken up
  // use internal API for accessing keys of the weak map
  // that will be a models.
  let models = views && Cu.nondeterministicGetWeakMapKeys(views);
  // Find & return model for the the given view or
  // create one if model does not existist
  return models && find(models, model => viewFor(model) === view) ||
         Type({view: view});
});
exports.getModel = getModel;

let warnDisposed = partial(console.warn,
                           "Attempt to interact with disposed instance");

// Takes `f` that expects `model` as it's first argument and returns
// composite function intended to be used as method. Composite function
// attempts to get `view` associated with `this` pseudo variable, if
// there is no `view` associated with it returns `null` otherwies invokes
// `f` with `view` and rest of the arguments passed.
exports.withView = f => asMethod(when(viewFor,
                                      (model, ...params) =>
                                        apply(f, viewFor(model), params),
                                      compose(constant(null), warnDisposed)));
