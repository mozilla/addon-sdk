"use strict";

// Anyone crating an eventual will likely need to realize it, requiring
// dependency on other package is complicated, not to mention that one
// can easily wind up with several copies that does not necessary play
// well with each other. Exposing this solves the issues.
module.exports = require("pending/deliver")
