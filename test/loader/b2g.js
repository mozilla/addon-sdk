"use strict";

const {Cc, Ci, Cu} = require("chrome");

const systemPrincipal = Cc["@mozilla.org/systemprincipal;1"].
												 	createInstance(Ci.nsIPrincipal);

const { NetUtil } = require("resource://gre/modules/NetUtil.jsm");

const readURI = uri => {
  let stream = NetUtil.newChannel(uri, 'UTF-8', null).open();
  let count = stream.available();
  let data = NetUtil.readInputStreamToString(stream, count, {
    charset: 'UTF-8'
  });
  stream.close();

  return data;
}

const Utils = function() {
  const sandbox = Cu.Sandbox(systemPrincipal, {wantXrays: false});
  sandbox.toString = function() {
    return "[object BackstagePass]";
  }
  this.sandbox = sandbox;
}
Utils.prototype = {
  ["import"](url, scope) {
    const {sandbox} = this;
		sandbox.__URI__ = url;
		const target = Cu.createObjectIn(sandbox);
		target.toString = sandbox.toString;
		Cu.evalInSandbox(`(function(){` + readURI(url) + `\n})`,
										 sandbox, "1.8", url).call(target);

		// Borrowed from mozJSComponentLoader.cpp to match errors closer.
    // https://github.com/mozilla/gecko-dev/blob/f6ca65e8672433b2ce1a0e7c31f72717930b5e27/js/xpconnect/loader/mozJSComponentLoader.cpp#L1205-L1208
		if (!Array.isArray(target.EXPORTED_SYMBOLS)) {
			throw Error("EXPORTED_SYMBOLS is not an array.");
		}

    for (let key of target.EXPORTED_SYMBOLS) {
			scope[key] = target[key];
		}

		return target;
	}
};
exports.Utils = Utils;
