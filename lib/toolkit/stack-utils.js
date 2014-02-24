/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

;(function(id, factory) { // Module boilerplate :(
  if (typeof(define) === "function") { // RequireJS
    define(factory);
  } else if (typeof(require) === "function") { // CommonJS
    factory.call(this, require, exports, module);
  } else if (~String(this).indexOf("BackstagePass")) { // JSM
    this[factory.name] = {};
    factory(function require(uri) {
      var imports = {};
      this["Components"].utils.import(uri, imports);
      return imports;
    }, this[factory.name], { uri: __URI__, id: id });
    this.EXPORTED_SYMBOLS = [factory.name];
  } else if (~String(this).indexOf("Sandbox")) { // Sandbox
    factory(function require(uri) {}, this, { uri: __URI__, id: id });
  } else {  // Browser or alike
    var globals = this
    factory(function require(id) {
      return globals[id];
    }, (globals[id] = {}), { uri: document.location.href + "#" + id, id: id });
  }
}).call(this, "stackUtils", function stackUtils (require, exports, module) {

"use strict";

module.metadata = {
  "stability": "unstable"
};

function parseURI(uri) { return String(uri).split(" -> ").pop(); }
exports.parseURI = parseURI;

function parseStack(stack) {
  let lines = String(stack).split("\n");
  return lines.reduce(function(frames, line) {
    if (line) {
      let atIndex = line.indexOf("@");
      let columnIndex = line.lastIndexOf(":");
      let lineIndex = line.lastIndexOf(":", columnIndex - 1);
      let fileName = sourceURI(line.slice(atIndex + 1, lineIndex));
      let lineNumber = parseInt(line.slice(lineIndex + 1, columnIndex));
      let columnNumber = parseInt(line.slice(columnIndex + 1));
      let name = line.slice(0, atIndex).split("(").shift();
      frames.unshift({
        fileName: fileName,
        name: name,
        lineNumber: lineNumber,
        columnNumber: columnNumber
      });
    }
    return frames;
  }, []);
}
exports.parseStack = parseStack;

function serializeStack(frames) {
  return frames.reduce(function(stack, frame) {
    return frame.name + "@" +
           frame.fileName + ":" +
           frame.lineNumber + ":" +
           frame.columnNumber + "\n" +
           stack;
  }, "");
}
exports.serializeStack = serializeStack;

});
