let { deprecateUsage } = require("../util/deprecate");

deprecateUsage("Module 'sdk/tabs/utils' is deprecated use 'sdk/tab/utils' instead");

module.exports = require("../tab/utils");
