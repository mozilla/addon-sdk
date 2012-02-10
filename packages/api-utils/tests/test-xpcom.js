/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const xpcom = require("api-utils/xpcom");
const { Cc, Ci, Cm, Cr } = require("chrome");
const { isCIDRegistered } = Cm.QueryInterface(Ci.nsIComponentRegistrar);
const { Loader } = require("./helpers");

exports['test Unknown implements nsISupports'] = function(assert) {
  let actual = xpcom.Unknown.new();
  assert.equal(actual.QueryInterface(Ci.nsISupports),
               actual,
               'component implements nsISupports');
};

exports['test implement xpcom interfaces'] = function(assert) {
  let component = xpcom.Unknown.extend({
    interfaces: [ 'nsIWeakReference' ],
    QueryReferent: function() {}
  })

  assert.equal(component.QueryInterface(Ci.nsISupports),
               component,
               'component implements nsISupports');
  assert.equal(component.QueryInterface(Ci.nsIWeakReference),
               component,
               'component implements specified interface');

  assert.throws(function() {
    component.QueryInterface(Ci.nsIObserver);
  }, "component does not implements interface");

  let actual = component.extend({
    interfaces: [ 'nsIObserver', 'nsIRequestObserver' ],
    observe: function() {},
    onStartRequest: function() {},
    onStopRequest: function() {}
  });

  assert.equal(actual.QueryInterface(Ci.nsISupports),
               actual,
               'derived component implements nsISupports');
  assert.equal(actual.QueryInterface(Ci.nsIWeakReference),
               actual,
               'derived component implements supers interface');
  assert.equal(actual.QueryInterface(Ci.nsIObserver),
               actual.QueryInterface(Ci.nsIRequestObserver),
               'derived component implements specified interfaces');
};

exports['test implement factory without contract'] = function(assert) {
  let actual = xpcom.Factory.new({
    component: xpcom.Unknown.extend({
      get wrappedJSObject() this,
    })
  });

  assert.ok(isCIDRegistered(actual.id), 'factory is regiseterd');
  xpcom.unregister(actual);
  assert.ok(!isCIDRegistered(actual.id), 'factory is unregistered');
};

exports['test implement xpcom factory'] = function(assert) {
  let Component = xpcom.Unknown.extend({
    interfaces: [ 'nsIObserver' ],
    get wrappedJSObject() this,
    observe: function() {}
  });

  let factory = xpcom.Factory.new({
    register: false,
    contract: '@jetpack/test/factory;1',
    component: Component
  });

  assert.ok(!isCIDRegistered(factory.id), 'factory is not registered');
  xpcom.register(factory);
  assert.ok(isCIDRegistered(factory.id), 'factory is registered');

  let actual = Cc[factory.contract].createInstance(Ci.nsIObserver);

  assert.ok(Component.isPrototypeOf(actual.wrappedJSObject),
            "createInstance returnes wrapped factory instances");

  assert.notEqual(Cc[factory.contract].createInstance(Ci.nsIObserver),
                  Cc[factory.contract].createInstance(Ci.nsIObserver),
                  "createInstance returns new instance each time");
};

exports['test implement xpcom service'] = function(assert) {
  let actual = xpcom.Service.new({
    contract: '@jetpack/test/service;1',
    register: false,
    component: xpcom.Unknown.extend({
      get wrappedJSObject() this,
      interfaces: [ 'nsIObserver'],
      observe: function() {},
      name: 'my-service'
    })
  });

  assert.ok(!isCIDRegistered(actual.id), 'component is not registered');
  xpcom.register(actual);
  assert.ok(isCIDRegistered(actual.id), 'service is regiseterd');
  assert.ok(Cc[actual.contract].getService(Ci.nsIObserver).observe,
            'service can be accessed via get service');
  assert.equal(Cc[actual.contract].getService(Ci.nsIObserver).wrappedJSObject,
               actual.component,
               'wrappedJSObject is an actual component');
  xpcom.unregister(actual);
  assert.ok(!isCIDRegistered(actual.id), 'service is unregistered');
};


function testRegister(assert, text) {

  const service = xpcom.Service.new({
    description: 'test about:boop page',
    contract: '@mozilla.org/network/protocol/about;1?what=boop',
    register: false,
    component: xpcom.Unknown.extend({
      get wrappedJSObject() this,
      interfaces: [ 'nsIAboutModule' ],
      newChannel : function(aURI) {
        var ios = Cc["@mozilla.org/network/io-service;1"].
                  getService(Ci.nsIIOService);

        var channel = ios.newChannel(
          "data:text/plain," + text,
          null,
          null
        );

        channel.originalURI = aURI;
        return channel;
      },
      getURIFlags: function(aURI) {
        return Ci.nsIAboutModule.ALLOW_SCRIPT;
      }
    })
  });

  xpcom.register(service);

  assert.equal(isCIDRegistered(service.id), true);

  var aboutFactory = xpcom.factoryByContract(service.contract);
  var about = aboutFactory.createInstance(Ci.nsIAboutModule);

  var ios = Cc["@mozilla.org/network/io-service;1"].
            getService(Ci.nsIIOService);
  assert.equal(
    about.getURIFlags(ios.newURI("http://foo.com", null, null)),
    Ci.nsIAboutModule.ALLOW_SCRIPT
  );

  var aboutURI = ios.newURI("about:boop", null, null);
  var channel = ios.newChannelFromURI(aboutURI);
  var iStream = channel.open();
  var siStream = Cc['@mozilla.org/scriptableinputstream;1']
                 .createInstance(Ci.nsIScriptableInputStream);
  siStream.init(iStream);
  var data = new String();
  data += siStream.read(-1);
  siStream.close();
  iStream.close();
  assert.equal(data, text);

  xpcom.unregister(service);
  assert.equal(isCIDRegistered(service.id), false);
}

exports["test register"] = function(assert) {
  testRegister(assert, "hai2u");
};

exports["test re-register"] = function(assert) {
  testRegister(assert, "hai2u again");
};

exports["test unload"] = function(assert) {
  let loader = Loader(module);
  let sbxpcom = loader.require("xpcom");

  let auto = sbxpcom.Factory.new({
    contract: "@mozilla.org/test/auto-unload;1",
    description: "test auto",
    component: sbxpcom.Unknown.extend({ name: 'auto' })
  });

  let manual = sbxpcom.Factory.new({
    contract: "@mozilla.org/test/manual-unload;1",
    description: "test manual",
    register: false,
    unregister: false,
    component: sbxpcom.Unknown.extend({ name: 'manual' })
  });

  assert.equal(isCIDRegistered(auto.id), true, 'component registered');
  assert.equal(isCIDRegistered(manual.id), false, 'component not registered');

  sbxpcom.register(manual)
  assert.equal(isCIDRegistered(manual.id), true,
                   'component was automatically registered on first instance');
  loader.unload();

  assert.equal(isCIDRegistered(auto.id), false,
                   'component was atumatically unregistered on unload');
  assert.equal(isCIDRegistered(manual.id), true,
                   'component was not automatically unregistered on unload');
  sbxpcom.unregister(manual);
  assert.equal(isCIDRegistered(manual.id), false,
                   'component was manually unregistered on unload');
};

require("test").run(exports)
