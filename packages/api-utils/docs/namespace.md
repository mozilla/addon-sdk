Provides an API for creating namespaces for any given objects, which
effectively may be used for creating fields that are not part of objects
public API.

      let { Namespace } = require('api-utils/namespace');
      let ns = Namespace();

      ns(publicAPI).secret = secret;

One namespace may be used with multiple objects:

      let { Namespace } = require('api-utils/namespace');
      let dom = Namespace();

      function View(element) {
        let view = Object.create(View.prototype);
        dom(view).element = element;
        // ....
      }
      View.prototype.destroy = function destroy() {
        let { element } = dom(this);
        element.parentNode.removeChild(element);
        // ...
      };
      // ...
      exports.View = View;
      // ...

Also, multiple namespaces can be used with one object:

      // ./widget.js

      let { Cu } = require('chrome');
      let { Namespace } = require('api-utils/namespace');
      let { View } = require('./view');

      // Note this is completely independent from View's internal Namespace object.
      let ns = Namespace();

      function Widget(options) {
        let { element, contentScript } = options;
        let widget = Object.create(Widget.prototype);
        View.call(widget, options.element);
        ns(widget).sandbox = Cu.Sandbox(element.ownerDocument.defaultView);
        // ...
      }
      Widget.prototype = Object.create(View.prototype);
      Widget.prototype.postMessage = function postMessage(message) {
        let { sandbox } = ns(this);
        sandbox.postMessage(JSON.stringify(JSON.parse(message)));
        ...
      };
      Widget.prototype.destroy = function destroy() {
        View.prototype.destroy.call(this);
        // ...
        delete ns(this).sandbox;
      };
      exports.Widget = Widget;

In addition access to the namespace can be shared with other code by just
handing them a namespace accessor function.

      let { dom } = require('./view');
      Widget.prototype.setInnerHTML = function setInnerHTML(html) {
        dom(this).element.innerHTML = String(html);
      };
