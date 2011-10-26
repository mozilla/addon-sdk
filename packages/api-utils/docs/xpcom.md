Using this module you can:

* register a component with
[XPCOM](https://developer.mozilla.org/en/Creating_XPCOM_Components),
making it available to all XPCOM clients
* retrieve a factory for a given XPCOM component
* generate a UUID

The module also exposes the
[XPCOMUtils](https://developer.mozilla.org/en/JavaScript_code_modules/XPCOMUtils.jsm)
module.

<api name="register">
@function

Makes a component available through XPCOM.

This function creates and registers a factory for a component given a
constructor for it and some metadata: a
[class ID](https://developer.mozilla.org/en/Creating_XPCOM_Components/An_Overview_of_XPCOM#CID), a [contract ID](https://developer.mozilla.org/en/Creating_XPCOM_Components/An_Overview_of_XPCOM#Contract_ID),
and a name.

<span class="aside">In this example the HelloWorld component is available to JavaScript only, so we use the technique documented under the "Using wrappedJSObject" section of [How to Build an XPCOM Component in JavaScript](https://developer.mozilla.org/en/How_to_Build_an_XPCOM_Component_in_Javascript).</span>

    var xpcom = require("xpcom");

    function HelloWorld() {
      this.wrappedJSObject = this;
    }

    HelloWorld.prototype = {
      QueryInterface: xpcom.utils.generateQI(),
      hello: function() {
        return "Hello World!";
      }
    };

    xpcom.register({name: "Hello World Component",
                    contractID: "@me.org/myComponent",
                    create: HelloWorld});

XPCOM clients can subsequently access this factory and use it to create
instances of the component.

    var {Ci} = require("chrome");

    var factory = xpcom.getClass("@me.org/myComponent", Ci.nsIFactory);
    var helloWorld = factory.createInstance(null, Ci.nsISupports).wrappedJSObject;
    console.log(helloWorld.hello());

`register()` returns a Factory object for the component which implements
the `createInstance()` and `QueryInterface()` functions of the
[`nsIFactory`](https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsIFactory) and
[`nsISupports`](https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsISupports)
interfaces, as well as defining an `unregister()` function to remove the
component from XPCOM.

When the module is unloaded, all components registered via the `register()`
function are automatically unregistered.

@param options {object}

@prop [uuid] {nsIDPtr}
A [UUID](https://developer.mozilla.org/en/Generating_GUIDs) which will be
used as the
[class ID](https://developer.mozilla.org/en/Creating_XPCOM_Components/An_Overview_of_XPCOM#CID)
for this component. If you don't include this option, the `register()`
function will generate a new UUID.

@prop create {function}
The constructor for the component.

@prop name {string}
A human-readable name for the component.

@prop contractID {string}
A human-readable string which will be used as the
[contract ID](https://developer.mozilla.org/en/Creating_XPCOM_Components/An_Overview_of_XPCOM#Contract_ID)
for the component. An XPCOM client will be able to use this value to access
the component.

@returns {Factory}
See the documentation for the `Factory` class in this page.
</api>

<api name="getClass">
@function
Returns the factory object for the class specified by `contractID`.

For example, given a registered XPCOM component which is identified with
the contract ID "@me.org/myComponent", we can access a factory and then
use it to instantiate the component in the following way:

    var xpcom = require("xpcom");
    var {Ci} = require("chrome");

    var factory = xpcom.getClass("@me.org/myComponent", Ci.nsIFactory);
    var helloWorld = factory.createInstance(null, Ci.nsISupports).wrappedJSObject;
    console.log(helloWorld.hello());

@param contractID {string}
The
[contract ID](https://developer.mozilla.org/en/Creating_XPCOM_Components/An_Overview_of_XPCOM#Contract_ID)
for the component whose factory will be returned.

@param [iid] {iid}
The interface type to be returned. These objects are usually accessed through
the `Components.interfaces`, or `Ci`, object.

The methods of this interface will be callable on the returned factory object.
Usually you want this to be
[`Ci.nsIFactory`](https://developer.mozilla.org/En/nsIFactory), but if you know
a component has a factory that implements a more specific type of factory
interface, you can pass that interface here.  If you don't include this option
only the methods of
[`nsISupports`](https://developer.mozilla.org/En/NsISupports)
will be callable, which is probably not what you want.

@returns {object}
The factory object. The type of this object will depend on the value of the
`iid` argument. If no `iid` argument is specified it will be of type
[`nsISupports`](https://developer.mozilla.org/En/NsISupports).

Note that this object is not a `Factory` object as defined by this module.
If you previously registered the component by calling the `register()`
function and you need to access the `Factory` object for the component, for
example to call the `Factory`'s `unregister()` method, you can do so by
getting the
[`wrappedJSObject`](https://developer.mozilla.org/en/wrappedJSObject)
property of the returned object:

    var factory = xpcom.getClass("@me.org/myComp", Ci.nsIFactory).wrappedJSObject;
    factory.unregister();

</api>

<api name="utils">
@property {object}
The
[XPCOMUtils](https://developer.mozilla.org/en/JavaScript_code_modules/XPCOMUtils.jsm)
module.
</api>

<api name="makeUuid">
@function
Generates and returns a new
[UUID](https://developer.mozilla.org/en/Generating_GUIDs).

Calling `toString()` on this object will yield the UUID in string form.
@returns {nsIDPtr}
</api>

<api name="Factory">
@class

When a component is made available through XPCOM using the `register()`
function, `register()` returns a `Factory` object that can be used to
instantiate the component using its `createInstance()` function:

    var factory = require("xpcom").register({
      name: "My Component",
      contractID: "@me.org/myComponent",
      create: MyComponent
    });

    var {Ci} = require("chrome");
    var component = factory.createInstance(null, Ci.nsISupports).wrappedJSObject;

In this example we haven't defined a custom interface ID for the component.
Instead we pass `Ci.nsISupports` as the interface ID, and use `wrappedJSObject`
to retrieve the component. For more details on this technique see the
[guide to building XPCOM components in JavaScript](https://developer.mozilla.org/en/How_to_Build_an_XPCOM_Component_in_Javascript).

`Factory` also implements its own `unregister()` function,
which unregisters the component from XPCOM.

<api name="createInstance">
@method
Creates an instance of the component associated with this factory.

@param outer {nsISupports}
This argument must be `null`, or the function throws
`Cr.NS_ERROR_NO_AGGREGATION`.

@param iid {iid}
Interface identifier. These objects are usually accessed through
the `Components.interfaces`, or `Ci`, object. The methods of this
interface will be callable on the returned object.

If the object implements an interface that's already defined in XPCOM, you
can pass that in here:

    var about = aboutFactory.createInstance(null, Ci.nsIAboutModule);
    // You can now access the nsIAboutModule interface of the 'about' object

If you will be getting the `wrappedJSObject` property from the returned
object to access its JavaScript implementation, pass `Ci.nsISupports` here:

    var custom = factory.createInstance(null, Ci.nsISupports).wrappedJSObject;
    // You can now access the interface defined for the 'custom' object

</api>

<api name="QueryInterface">
@method
This method is called automatically by XPCOM, so usually you don't need
to call it yourself.  It returns the `Factory` object itself such that the
methods of the given interface are callable on it.

@param interfaces {iid}
There are only two legal values for this parameter: `Ci.nsIFactory` and
`Ci.nsISupports`.  Any other value will cause this method to throw
`Cr.NS_ERROR_NO_INTERFACE`.

@returns {Factory}
</api>

<api name="unregister">
@method
Unregisters the factory's component.
</api>

</api>
