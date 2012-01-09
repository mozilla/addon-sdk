/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Cc,Ci} = require("chrome");
const errors = require("api-utils/errors");
const apiUtils = require("api-utils/api-utils");
 
/*
While these data flavors resemble Internet media types, they do
no directly map to them.
*/
const kAllowableFlavors = [
  "text/unicode",
  "text/html"
  /* CURRENTLY UNSUPPORTED FLAVORS
  "text/plain",
  "image/png",
  "image/jpg",
  "image/gif"
  "text/x-moz-text-internal",
  "AOLMAIL",
  "application/x-moz-file",
  "text/x-moz-url",
  "text/x-moz-url-data",
  "text/x-moz-url-desc",
  "text/x-moz-url-priv",
  "application/x-moz-nativeimage",
  "application/x-moz-nativehtml",
  "application/x-moz-file-promise-url",
  "application/x-moz-file-promise-dest-filename",
  "application/x-moz-file-promise",
  "application/x-moz-file-promise-dir"
  */
];

/*
Aliases for common flavors. Not all flavors will
get an alias. New aliases must be approved by a
Jetpack API druid.
*/
const kFlavorMap = [
  { short: "text", long: "text/unicode" },
  { short: "html", long: "text/html" }
  // Images are currently unsupported.
  //{ short: "image", long: "image/png" },
];

let clipboardService = Cc["@mozilla.org/widget/clipboard;1"].
                       getService(Ci.nsIClipboard);

let clipboardHelper = Cc["@mozilla.org/widget/clipboardhelper;1"].
                      getService(Ci.nsIClipboardHelper);


exports.set = function(aData, aDataType) {
  let options = {
    data: aData,
    datatype: aDataType || "text"
  };
  options = apiUtils.validateOptions(options, {
    data: {
      is: ["string"]
    },
    datatype: {
      is: ["string"]
    }
  });

  var flavor = fromJetpackFlavor(options.datatype);

  if (!flavor)
    throw new Error("Invalid flavor");

  // Additional checks for using the simple case
  if (flavor == "text/unicode") {
    clipboardHelper.copyString(options.data);
    return true;
  }

  // Below are the more complex cases where we actually have to work with a
  // nsITransferable object
  var xferable = Cc["@mozilla.org/widget/transferable;1"].
                 createInstance(Ci.nsITransferable);
  if (!xferable)
    throw new Error("Couldn't set the clipboard due to an internal error " + 
                    "(couldn't create a Transferable object).");

  switch (flavor) {
    case "text/html":
      // add text/html flavor
      let (str = Cc["@mozilla.org/supports-string;1"].
                 createInstance(Ci.nsISupportsString))
      {
        str.data = options.data;
        xferable.addDataFlavor(flavor);
        xferable.setTransferData(flavor, str, str.data.length * 2);
      }

      // add a text/unicode flavor (html converted to plain text)
      let (str = Cc["@mozilla.org/supports-string;1"].
                 createInstance(Ci.nsISupportsString),
           converter = Cc["@mozilla.org/feed-textconstruct;1"].
                       createInstance(Ci.nsIFeedTextConstruct))
      {
        converter.type = "html";
        converter.text = options.data;
        str.data = converter.plainText();
        xferable.addDataFlavor("text/unicode");
        xferable.setTransferData("text/unicode", str, str.data.length * 2);
      }
      break;
    // TODO: images!
    default:
      throw new Error("Unable to handle the flavor " + flavor + ".");
  }

  // TODO: Not sure if this will ever actually throw. -zpao
  try {
    clipboardService.setData(
      xferable,
      null,
      clipboardService.kGlobalClipboard
    );
  } catch (e) {
    throw new Error("Couldn't set clipboard data due to an internal error: " + e);
  }
  return true;
};


exports.get = function(aDataType) {
  let options = {
    datatype: aDataType || "text"
  };
  options = apiUtils.validateOptions(options, {
    datatype: {
      is: ["string"]
    }
  });

  var xferable = Cc["@mozilla.org/widget/transferable;1"].
                 createInstance(Ci.nsITransferable);
  if (!xferable)
    throw new Error("Couldn't set the clipboard due to an internal error " + 
                    "(couldn't create a Transferable object).");

  var flavor = fromJetpackFlavor(options.datatype);

  // Ensure that the user hasn't requested a flavor that we don't support.
  if (!flavor)
    throw new Error("Getting the clipboard with the flavor '" + flavor +
                    "' is > not supported.");

  // TODO: Check for matching flavor first? Probably not worth it.

  xferable.addDataFlavor(flavor);

  // Get the data into our transferable.
  clipboardService.getData(
    xferable,
    clipboardService.kGlobalClipboard
  );

  var data = {};
  var dataLen = {};
  try {
    xferable.getTransferData(flavor, data, dataLen);
  } catch (e) {
    // Clipboard doesn't contain data in flavor, return null.
    return null;
  }

  // There's no data available, return.
  if (data.value === null)
    return null;

  // TODO: Add flavors here as we support more in kAllowableFlavors.
  switch (flavor) {
    case "text/unicode":
    case "text/html":
      data = data.value.QueryInterface(Ci.nsISupportsString).data;
      break;
    default:
      data = null;
  }

  return data;
};

exports.__defineGetter__("currentFlavors", function() {
  // Loop over kAllowableFlavors, calling hasDataMatchingFlavors for each.
  // This doesn't seem like the most efficient way, but we can't get
  // confirmation for specific flavors any other way. This is supposed to be
  // an inexpensive call, so performance shouldn't be impacted (much).
  var currentFlavors = [];
  for each (var flavor in kAllowableFlavors) {
    var matches = clipboardService.hasDataMatchingFlavors(
      [flavor],
      1,
      clipboardService.kGlobalClipboard
    );
    if (matches)
      currentFlavors.push(toJetpackFlavor(flavor));
  }
  return currentFlavors;
});

// SUPPORT FUNCTIONS ////////////////////////////////////////////////////////

function toJetpackFlavor(aFlavor) {
  for each (let flavorMap in kFlavorMap)
    if (flavorMap.long == aFlavor)
      return flavorMap.short;
  // Return null in the case where we don't match
  return null;
}

function fromJetpackFlavor(aJetpackFlavor) {
  // TODO: Handle proper flavors better
  for each (let flavorMap in kFlavorMap)
    if (flavorMap.short == aJetpackFlavor || flavorMap.long == aJetpackFlavor)
      return flavorMap.long;
  // Return null in the case where we don't match.
  return null;
}
