const traceback = require("traceback");
const xpcom = require("xpcom");
const { Cc, Ci, Cm, Cr } = require("chrome");
const { Loader } = require("./helpers");
const manager = Cm.QueryInterface(Ci.nsIComponentRegistrar);

exports.testRegister = function(test, text) {
  if (!text)
    text = "hai2u";

  const Component = xpcom.Factory.extend({
    className: 'test about:boop page',
    contractID: '@mozilla.org/network/protocol/about;1?what=boop',
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
  });
  xpcom.register(Component);

  test.assertEqual(manager.isCIDRegistered(Component.classID), true);

  // We don't want to use Cc[contractID] here because it's immutable,
  // so it can't accept updated versions of a contractID during the
  // same application session.
  var aboutFactory = xpcom.getClass(Component.contractID, Ci.nsIFactory);

  test.assertNotEqual(aboutFactory.wrappedJSObject,
                      undefined,
                      "Factory wrappedJSObject should exist.");

  var about = aboutFactory.createInstance(null, Ci.nsIAboutModule);
  var ios = Cc["@mozilla.org/network/io-service;1"].
            getService(Ci.nsIIOService);
  test.assertEqual(
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
  test.assertEqual(data, text);

  xpcom.unregister(Component);
  test.assertEqual(manager.isCIDRegistered(Component.classID), false);
};

exports.testReRegister = function(test) {
  exports.testRegister(test, "hai2u again");
};

exports.testLoadUnload = function(test) {
  let loader = Loader(module);
  let sbxpcom = loader.require("xpcom");

  let Auto = sbxpcom.Factory.extend({
    contractID: "@mozilla.org/test/demo-auto;1",
    className: "test auto"
  });
  let Manual = sbxpcom.Factory.extend({
    contractID: "@mozilla.org/test/demo-manual;1",
    className: "test manual",
    classRegister: true,
    classUnregister: false
  });

  sbxpcom.register(Auto);

  test.assertEqual(manager.isCIDRegistered(Auto.classID), true,
                   'component registered');
  test.assertEqual(manager.isCIDRegistered(Manual.classID), false,
                   'component not registered');
  let manual = Manual.new();
  test.assertEqual(manager.isCIDRegistered(Manual.classID), true,
                   'component was automatically registered on first instance');
  loader.unload();

  test.assertEqual(manager.isCIDRegistered(Auto.classID), false,
                   'component was atumatically unregistered on unload');
  test.assertEqual(manager.isCIDRegistered(Manual.classID), true,
                   'component was not automatically unregistered on unload');
  sbxpcom.unregister(Manual);
  test.assertEqual(manager.isCIDRegistered(Manual.classID), false,
                   'component was manually unregistered on unload');
};
