const { Class } = require("../core/heritage");
const { extend } = require("../util/object");
const readers = require("./readers");

// Context class is required to implement a single `isCurrent(target)` method
// that must return boolean value indicating weather given target matches a
// context or not. Most context implementations below will have an associated
// reader that way context implementation can setup a reader to extract necessary
// information to make decision if target is matching a context.
const Context = Class({
  isCurrent(target) {
    throw Error("Context class must implement isCurrent(target) method");
  }
});


// Next few context implementations use an associated reader to extract info
// from the context target and story it to a private symbol associtaed with
// a context implementation. That way name collisions are avoided while required
// information is still carried along.
const isPage = Symbol("context/page?")
const PageContext = Class({
  read: {[isPage]: new readers.isPage()},
  isCurrent: target => target[isPage]
});
exports.Page = PageContext;

const isFrame = Symbol("context/frame?");
const FrameContext = Class({
  read: {[isFrame]: new readers.isFrame()},
  isCurrent: target => target[isFrame]
});
exports.Frame = FrameContext;

const selection = Symbol("context/selection")
const SelectionContext = Class({
  read: {[selection]: new readers.Selection()},
  isCurrent: target => target[selection]
});
exports.Selection = SelectionContext;

const isSelectorMatch = Symbol("context/selector/mathches?")
const SelectorContext = Class({
  initialize(selector) {
    this.selector = selector;
    // Each instance of selector context will need to store read
    // data into different field, so that case with multilpe selector
    // contexts won't cause a conflicts.
    this[isSelectorMatch] = Symbol(selector);
    this.read = {[this[isSelectorMatch]]: new readers.SelectorMatch(selector)};
  },
  isCurrent(target) {
    return target[this[isSelectorMatch]];
  }
});
exports.Selector = SelectorContext;

const url = Symbol("context/url");
const URLContext = Class({
  initialize(pattern) {
    this.pattern = pattern
  },
  read: {[url]: new readers.PageURL()},
  isCurrent(target) {
    this.pattern.test(target[url]);
  }
});
exports.URL = URLContext;


var PredicateContext = Class({
  initialize(isMatch) {
    this.isMatch = isMatch
  },
  isCurrent(target) {
    return this.isMatch(target);
  }
});
exports.Predicate = PredicateContext;


// TODO: Consider adding other contexts that are supported by chrome:
// Link, Editable, Image, Video, Audio
