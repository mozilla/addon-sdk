<!-- contributed by Alexandre Poirot [apoirot@mozilla.com]  -->

Content scripts need access to the DOM of the pages they are attached to.
However, those pages should be considered to be hostile environments: we
have no control over any other scripts loaded by the web page that may be
executing in the same context. If the content scripts and scripts loaded
by the web page were to access the same DOM objects, there are two possible
security problems:

First, a malicious page might redefine functions and properties of DOM
objects so they don't do what the add-on expects. For example, if a
content script calls `document.getElementById()` to retrieve a DOM
element, then a malicious page could redefine its behavior to return
something unexpected:

<pre><code>
// If the web document contains the following script:
document.getElementById = function (str) {
  // Overload indexOf method of all string instances
  str.__proto__.indexOf = function () {return -1;};
  // Overload toString method of all object instances
  str.__proto__.__proto__.toString = function () {return "evil";};
};
// After the following line, the content script will be compromised:
var node = document.getElementById("element");
// Then your content script is totally out of control.
</code></pre>

Second, changes the content script made to the DOM objects would be visible
to the page, leaking information to it.

The general approach to fixing these problems is to wrap DOM objects in
[`XrayWrappers`](https://developer.mozilla.org/en/XPCNativeWrapper)
(also know as `XPCNativeWrapper`). This guarantees that:

* when the content script accesses DOM properties and functions it gets the
original native version of them, ignoring any modifications made by the web
page
* changes to the DOM made by the content script are not visible to scripts
running in the page.

However, `XrayWrapper` has some limitations and bugs, which break many
popular web frameworks. In particular, you can't:

* define attributes like `onclick`: you have to use `addEventListener` syntax
* overload native methods on DOM objects, like this:
<pre><code>
proxy.addEventListener = function () {};
</code></pre>
* access named elements using properties like `window[framename]` or
`document[formname]`
* use some other features that have bugs in the `XrayWrapper`
implementation, like `mozMatchesSelector`

The `proxy` module uses `XrayWrapper` in combination with the
experimental
[Proxy API](https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Proxy)
to address both the security vulnerabilities of content scripts and the
limitations of `XrayWrapper`.

<pre>
  /--------------------\                           /------------------------\
  |    Web document    |                           | Content script sandbox |
  | http://mozilla.org |                           |     data/worker.js     |
  |                    | require('content-proxy'). |                        |
  | window >-----------|-     create(window)      -|-> window               |
  \--------------------/                           \------------------------/
</pre>


## The Big Picture ##

The implementation defines two different kinds of proxy:
  
  1. Content script proxies that wrap DOM objects that are exposed to
     content scripts as described above.
  2. XrayWrapper proxies that wrap objects from content scripts before handing
     them over to XrayWrapper functions. These proxies are internal
     and are not exposed to content scripts or document content.

<pre>
  /--------------------\                           /------------------------\
  |    Web document    |                           | Content script sandbox |
  | http://mozilla.org |                           |     data/worker.js     |
  |                    |                   /-------|-> myObject = {}        |
  |                    |  /----------------v--\    |                        |
  |                    |  | XrayWrapper Proxy |    | - document             |
  |                    |  \---------v---------/    \----^-------------------/
  |                    |            v                   |
  |                    |  /-------------\  /----------\ |
  | - document >-------|->| XrayWrapper |<-| CS proxy |-/
  \--------------------/  \-------------/  \----------/
</pre>

Everything begins with a single call to the `create` function exported by the
content-proxy module:

    // Retrieve the unwrapped reference to the current web page window object
    var win = gBrowser.contentDocument.defaultView.wrappedJSObject;
    // Or in addon sdk style
    var win = require("tab-browser").activeTab.linkedBrowser.contentWindow.wrappedJSObject;
    // Now create a content script proxy for the window object
    var windowProxy = require("api-utils/content/content-proxy").create(win);
    
    // We finally use this window object as sandbox prototype,
    // so that all web page globals are accessible in CS too:
    var contentScriptSandbox = new Cu.Sandbox(win, {
      sandboxPrototype: windowProxy
    });

Then all other proxies are created from this one. Attempts to access DOM
attributes of this proxy are trapped, and the proxy constructs and returns
content script proxies for those attributes:

    // For example, if you simply do this:
    var document = window.document;
    // accessing the `document` attribute will be trapped by the `window` content script
    // proxy, and that proxy will that create another content script proxy for `document`

So the main responsibility of the content script proxy implementation is to
ensure that we always return content script proxies to the content script.

## Internal Implementation ##

Each content script proxy keeps a reference to the `XrayWrapper` that enables
it to be sure of calling native DOM methods.

There are two internal functions to convert between content script proxy
values and `XrayWrapper` values.

1. __`wrap`__ takes an XrayWrapper value and wraps it in a content script
proxy if needed.
  This method is called when:
    * a content script accesses an attribute of a content script proxy.
    * XrayWrapper code calls a callback function defined in the content
script, so that arguments passed into the function by the XrayWrapper are
converted into content script proxies. For example, if a content script
calls `addEventListener`, then the listener function will expect any arguments
to be content script proxies.
<br/><br/>
2. __`unwrap`__ takes an object coming from the content script context and:
    * if the object is a content script proxy, unwraps it back to an
XrayWrapper reference
    * if the object is not a content script proxy, wraps it in an XrayWrapper
proxy.
<br/><br/>
This means we can call a XrayWrapper method either with:

        * a raw XrayWrapper object.
    
                // The following line doesn't work if child is a content script proxy,
                // it has to be a raw XrayWrapper reference
                xrayWrapper.appendChild(child)
      
        * an XrayWrapper proxy when you pass a custom object from the content
script context.

                var myListener = {
                  handleEvent: function(event) {
                    // `event` should be a content script proxy
                  }
                };
                // `myListener` has to be another kind of Proxy: XrayWrapper proxy,
                // that aims to catch the call to `handleEvent` in order to wrap its
                // arguments in a content script proxy.
                xrayWrapper.addEventListener("click", myListener, false);


## Stack Traces ##

The following code:

    function listener(event) {
      
    }
    csProxy.addEventListener("message", listener, false);
    
generates the following internal calls:

    -> CS Proxy:: get("addEventListener")
      -> wrap(xrayWrapper.addEventListener)
        -> NativeFunctionWrapper(xrayWrapper.addEventListener)
          // NativeFunctionWrapper generates:
          function ("message", listener, false) {
            return xraywrapper.addEventListener("message", unwrap(listener), false);
          }
          -> unwrap(listener)
            -> ContentScriptFunctionWrapper(listener)
            // ContentScriptFunctionWrapper generates:
            function (event) {
              return listener(wrap(event));
            }

<br>

    // First, create an object from content script context
    var myListener = {
      handleEvent: function (event) {
        
      }
    };
    // Then, pass this object as an argument to a CS proxy method
    window.addEventListener("message", myListener, false);
    
    // Generates the following internal calls:
    -> CS Proxy:: get("addEventListener")
      -> wrap(xrayWrapper.addEventListener)
        -> NativeFunctionWrapper(xrayWrapper.addEventListener)
           // Generate the following function:
           function ("message", myListener, false) {
              return xraywrapper.addEventListener("message", unwrap(myListener), false);
           }
           -> unwrap(myListener)
             -> ContentScriptObjectWrapper(myListener)
                // Generate an XrayWrapper proxy and give it to xrayWrapper method.
                // Then when native code fires an event, the proxy will catch it:
                -> XrayWrapper Proxy:: get("handleEvent")
                  -> unwrap(myListener.handleEvent)
                    -> ContentScriptFunctionWrapper(myListener.handleEvent)
                       // Generate following function:
                       function (event) {
                         return myListener.handleEvent(wrap(event));
                       }


<api name="create">
@function
  Create a content script proxy. <br/>
  Doesn't create a proxy if we are not able to create a XrayWrapper for
  this object: for example, if the object comes from system principal.

@param object {Object}
    The object to proxify.

@returns {Object}
    A content script proxy that wraps `object`.
</api>
