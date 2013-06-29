
const models = exports.models = new WeakMap();
const views = exports.views = new WeakMap();
exports.buttons = new WeakMap();

exports.viewsFor = function viewsFor(sidebar) views.get(sidebar);
exports.modelFor = function modelFor(sidebar) models.get(sidebar);
