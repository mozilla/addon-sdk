/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "experimental"
};

const { Cc, Ci, components } = require("chrome");
const { readURISync } = require("../net/url");

// Undo the auto-parentification of URLs done in bug 418356.
function deParentifyURL(url) {
  return url ? url.split(" -> ").slice(-1)[0] : url;
}

function safeGetFileLine(path, line) {
  try {
    var scheme = require("../url").URL(path).scheme;
    // TODO: There should be an easier, more accurate way to figure out
    // what's the case here.
    if (!(scheme == "http" || scheme == "https"))
      return readURISync(path).split("\n")[line - 1];
  } catch (e) {}
  return null;
}

function errorStackToJSON(stack) {
  var lines = stack.split("\n");

  var frames = [];
  lines.forEach(
    function(line) {
      if (!line)
        return;
      var atIndex = line.indexOf("@");
      var colonIndex = line.lastIndexOf(":");
      var filename = deParentifyURL(line.slice(atIndex + 1, colonIndex));
      var lineNo = parseInt(line.slice(colonIndex + 1));
      var funcSig = line.slice(0, atIndex);
      var endFuncName = funcSig.indexOf("(");
      // Bug 751149: FF15 changed function signature
      // Instead of: runTest([object Object])
      // We now have: runTest
      var funcName = endFuncName != -1
                     ? funcSig.slice(0, endFuncName)
                     : funcSig;
      frames.unshift({filename: filename,
                      funcName: funcName,
                      lineNo: lineNo});
    });

  return frames;
};

function nsIStackFramesToJSON(frame) {
  var stack = [];

  while (frame) {
    if (frame.filename) {
      var filename = deParentifyURL(frame.filename);
      stack.splice(0, 0, {filename: filename,
                          lineNo: frame.lineNumber,
                          funcName: frame.name});
    }
    frame = frame.caller;
  }

  return stack;
};

var fromException = exports.fromException = function fromException(e) {
  if (e instanceof Ci.nsIException)
    return nsIStackFramesToJSON(e.location);
  if (e.stack && e.stack.length)
    return errorStackToJSON(e.stack);
  if (e.fileName && typeof(e.lineNumber == "number"))
    return [{filename: deParentifyURL(e.fileName),
             lineNo: e.lineNumber,
             funcName: null}];
  return [];
};

var get = exports.get = function get() {
  return nsIStackFramesToJSON(components.stack.caller);
};

var format = exports.format = function format(tbOrException) {
  if (tbOrException === undefined) {
    tbOrException = get();
    tbOrException.splice(-1, 1);
  }

  var tb;
  if (typeof(tbOrException) == "object" &&
      tbOrException.constructor.name == "Array")
    tb = tbOrException;
  else
    tb = fromException(tbOrException);

  var lines = ["Traceback (most recent call last):"];

  tb.forEach(
    function(frame) {
      if (!(frame.filename || frame.lineNo || frame.funcName))
      	return;

      lines.push('  File "' + frame.filename + '", line ' +
                 frame.lineNo + ', in ' + frame.funcName);
      var sourceLine = safeGetFileLine(frame.filename, frame.lineNo);
      if (sourceLine)
        lines.push('    ' + sourceLine.trim());
    });

  return lines.join("\n");
};
