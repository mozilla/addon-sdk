/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Base, Class } = require("api-utils/base");
const { ns } = require("api-utils/namespace");
const { emit, off } = require("api-utils/event/core");
const { merge } = require("api-utils/utils/object");
const { EventTarget } = require('api-utils/event/target');
const { XMLHttpRequest } = require("api-utils/xhr");
const apiUtils = require("api-utils/api-utils");

const response = ns();
const request = ns();

// Instead of creating a new validator for each request, just make one and
// reuse it.
const { validateOptions, validateSingleOption } = new OptionsValidator({
  url: {
    //XXXzpao should probably verify that url is a valid url as well
    is:  ["string"]
  },
  headers: {
    map: function (v) v || {},
    is:  ["object"],
  },
  content: {
    map: function (v) v || null,
    is:  ["string", "object", "null"],
  },
  contentType: {
    map: function (v) v || "application/x-www-form-urlencoded",
    is:  ["string"],
  },
  overrideMimeType: {
    map: function(v) v || null,
    is: ["string", "null"],
  }
});

const REUSE_ERROR = "This request object has been used already. You must " +
                    "create a new one to make a new request."

// Utility function to prep the request since it's the same between GET and
// POST
function runRequest(mode, target) {
  let source = request(target)
  let { xhr, url, content, contentType, headers, overrideMimeType } = source;

  // If this request has already been used, then we can't reuse it.
  // Throw an error.
  if (xhr)
    throw new Error(REUSE_ERROR);

  xhr = source.xhr = new XMLHttpRequest();

  // Build the data to be set. For GET requests, we want to append that to
  // the URL before opening the request.
  let data = makeQueryString(content);
  // If the URL already has ? in it, then we want to just use &
  if (mode == "GET" && data)
    url = url + (/\?/.test(url) ? "&" : "?") + data;

  // open the request
  xhr.open(mode, url);

  // request header must be set after open, but before send
  xhr.setRequestHeader("Content-Type", contentType);

  // set other headers
  Object.keys(headers).forEach(function(name) {
    xhr.setRequestHeader(name, headers[name]);
  });

  // set overrideMimeType
  if (overrideMimeType)
    xhr.overrideMimeType(overrideMimeType);

  // handle the readystate, create the response, and call the callback
  xhr.onreadystatechange = function onreadystatechange() {
    if (xhr.readyState === 4) {
      let response = Response.new(xhr);
      source.response = response;
      emit(target, 'complete', response);
    }
  };

  // actually send the request. we only want to send data on POST requests
  xhr.send(mode == "POST" ? data : null);
}

const Request = EventTarget.extend({
  initialize: function initialize(options) {
    // set up event listeners.
    EventTarget.initialize.call(this, options);

    // copy options.
    merge(request(this), validateOptions(options));
  },
  get url() { return request(this).url; },
  set url(value) { request(this).url = validateSingleOption('url', value); },
  get headers() { return request(this).headers; },
  set headers(value) {
    return request(this).headers = validateSingleOption('headers', value);
  },
  get content() { return request(this).content; },
  set content(value) {
    request(this).content = validateSingleOption('content', value);
  },
  get contentType() { return request(this).contentType; },
  set contentType(value) {
    request(this).contentType = validateSingleOption('contentType', value);
  },
  get response() { return request(this).response; },
  get: function() {
    runRequest('GET', this);
    return this;
  },
  post: function() {
    runRequest('POST', this);
    return this;
  }
});
exports.Request = Class(Request);

// Converts an object of unordered key-vals to a string that can be passed
// as part of a request
function makeQueryString(content) {
  // Explicitly return null if we have null, and empty string, or empty object.
  if (!content)
    return null;

  // If content is already a string, just return it as is.
  if (typeof(content) == "string") {
    return content;
  }

  // At this point we have a k:v object. Iterate over it and encode each value.
  // Arrays and nested objects will get encoded as needed. For example...
  //
  //   { foo: [1, 2, { omg: "bbq", "all your base!": "are belong to us" }], bar: "baz" }
  //
  // will be encoded as
  //
  //   foo[0]=1&foo[1]=2&foo[2][omg]=bbq&foo[2][all+your+base!]=are+belong+to+us&bar=baz
  //
  // Keys (including "[" and "]") and values will be encoded with
  // fixedEncodeURIComponent before returning.
  //
  // Execution was inspired by jQuery, but some details have changed and numeric
  // array keys are included (whereas they are not in jQuery).

  let encodedContent = [];
  function add(key, val) {
    encodedContent.push(fixedEncodeURIComponent(key) + "=" +
                        fixedEncodeURIComponent(val));
  }

  function make(key, val) {
    if (typeof(val) === "object" && val !== null) {
      for ([k, v] in Iterator(val)) {
        make(key + "[" + k + "]", v);
      }
    }
    else {
      add(key, val)
    }
  }
  for ([k, v] in Iterator(content)) {
    make(k, v);
  }
  return encodedContent.join("&");

  //XXXzpao In theory, we can just use a FormData object on 1.9.3, but I had
  //        trouble getting that working. It would also be nice to stay
  //        backwards-compat as long as possible. Keeping this in for now...
  // let formData = Cc["@mozilla.org/files/formdata;1"].
  //                createInstance(Ci.nsIDOMFormData);
  // for ([k, v] in Iterator(content)) {
  //   formData.append(k, v);
  // }
  // return formData;
}


// encodes a string safely for application/x-www-form-urlencoded
// adheres to RFC 3986
// see https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Global_Functions/encodeURIComponent
function fixedEncodeURIComponent (str) {
  return encodeURIComponent(str).replace(/%20/g, "+").replace(/!/g, "%21").
                                 replace(/'/g, "%27").replace(/\(/g, "%28").
                                 replace(/\)/g, "%29").replace(/\*/g, "%2A");
}

const Response = Base.extend({
  initialize: function initialize(request) {
    response(this).request = request;
  },
  get text() response(this).request.responseText,
  get xml() {
    throw new Error("Sorry, the 'xml' property is no longer available. " +
                    "see bug 611042 for more information.");
  },
  get status() response(this).request.status,
  get statusText() response(this).request.statusText,
  get json() {
    try {
      return JSON.parse(this.text);
    } catch(error) {
      return null;
    }
  },
  get headers() {
    let headers = {}, lastKey;
    // Since getAllResponseHeaders() will return null if there are no headers,
    // defend against it by defaulting to ""
    let rawHeaders = response(this).request.getAllResponseHeaders() || "";
    rawHeaders.split("\n").forEach(function (h) {
      // According to the HTTP spec, the header string is terminated by an empty
      // line, so we can just skip it.
      if (!h.length) {
        return;
      }

      let index = h.indexOf(":");
      // The spec allows for leading spaces, so instead of assuming a single
      // leading space, just trim the values.
      let key = h.substring(0, index).trim(),
          val = h.substring(index + 1).trim();

      // For empty keys, that means that the header value spanned multiple lines.
      // In that case we should append the value to the value of lastKey with a
      // new line. We'll assume lastKey will be set because there should never
      // be an empty key on the first pass.
      if (key) {
        headers[key] = val;
        lastKey = key;
      }
      else {
        headers[lastKey] += "\n" + val;
      }
    });
    return headers;
  }
});

// apiUtils.validateOptions doesn't give the ability to easily validate single
// options, so this is a wrapper that provides that ability.
function OptionsValidator(rules) {
  return {
      validateOptions: function (options) {
      return apiUtils.validateOptions(options, rules);
    },
    validateSingleOption: function (field, value) {
      // We need to create a single rule object from our listed rules. To avoid
      // JavaScript String warnings, check for the field & default to an empty object.
      let singleRule = {};
      if (field in rules) {
        singleRule[field] = rules[field];
      }
      let singleOption = {};
      singleOption[field] = value;
      // This should throw if it's invalid, which will bubble up & out.
      return apiUtils.validateOptions(singleOption, singleRule)[field];
    }
  };
}
