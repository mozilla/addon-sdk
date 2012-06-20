// Set of custom exception class for cfx.js
// Designed to be handled nicely from main module

function CfxError(name) {
  this.name = name;
}
CfxError.prototype = new Error();
CfxError.prototype.toString = function () {
  return this.name + ": "+ this.message;
};
exports.CfxError = CfxError;

function InvalidArgument(message) {
  this.message = message;
}
InvalidArgument.prototype = new CfxError("InvalidArgument");
exports.InvalidArgument = InvalidArgument;

function InternalCfxError(message) {
  this.message = message;
}
InternalCfxError.prototype = new CfxError("InternalError");
exports.InternalCfxError = InternalCfxError;
