// Following pseudo module is set by `api-utils/addon/runner` and its load
// method needs to be called before loading `core` module. But it may have
// failed, so that this pseudo won't be available
let hash = {}, bestMatchingLocale = null;
try {
  let data = require("@l10n/data");
  hash = data.hash;
  bestMatchingLocale = data.bestMatchingLocale;
}
catch(e) {}

// Returns the translation for a given key, if available.
exports.get = function get(k) {
  return k in hash ? hash[k] : null;
}

// Returns the full length locale code: ja-JP-mac, en-US or fr
exports.locale = function locale() {
  return bestMatchingLocale;
}
// Returns the short locale code: ja, en, fr
exports.language = function language() {
  return bestMatchingLocale ? bestMatchingLocale.split("-")[0].toLowerCase()
                            : null;
}
