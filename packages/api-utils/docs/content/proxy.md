<!-- contributed by Alexandre Poirot [apoirot@mozilla.com]  -->

#### Glossary ####

* CS: Content script
* XrayWrapper, XPCNativeWrapper: They are identical. 
  Wrappers that ensure having access only to native methods. 
* [Proxy](https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Proxy):
  New non-standard API for meta-programming.

## Why such proxy? ##

<pre>
  /--------------------\                           /------------------------\
  |    Web document    |                           | Content script sandbox |
  | http://mozilla.org |                           |     data/worker.js     |
  |                    | require('content-proxy'). |                        |
  | window >-----------|-     create(window)      -|-> window               |
  \--------------------/                           \------------------------/
</pre>

These proxies aims to wrap all document JS objects in order to:

  1. Ensure calling only native methods:<br/>
    The document can't overload `addEventListener` to trick the CS,
    nor overload some attributes like `document`.
  2. Prevent leaking any JS object to the document:<br/>
    Proxy object have to hold different set of attribute in order to avoid
    leaking any JS value to the document.
  3. Having exactly same feature set than regular web object:<br/>
    XrayWrapper fullfill the two first items and these are the only
    differences we want from raw/unwrapped document objects.
    But XrayWrappers have some limitations and some bugs that forced us
    to implement these proxies.
    For example, we want:
      * to be able to overload native method from the CS,
      * expando atttribute like `onclick` to be working,
      * window[framename], document[formname] to be defined.
    We just want that CS objects works exactly the same than objects
    in a regular web context.


## Concrete security threat examples ##
    // If the web document contains the folowing script:
    document.getElementById = function (str) {
      // Overload indexOf method of all string instances
      str.__proto__.indexOf = function () {return -1;};
      // Overload toString method of all object instances
      str.__proto__.__proto__.toString = function () {return "evil";};
    };
    
    // Now, in a content script, you just want to retrieve an element though:
    var node = document.getElementById("element");
    // Then your CS is totally out of control.
    // This is why `document` is a CS proxy that ensure `getElementById` being
    // the native DOM method you are expecting.
    
    // Second proxy feature is to hold different attribute sets, so that,
    // the following `myCustomAttribute` is not visible from the web page.
    // Nor `myCustomAttribute` would be visible from the CS if this line
    // was executed from the document.
    node.myCustomAttribute = "something";


## The big picture: ##

  In order to implement them we need two kind of proxies:
  
  1. CS proxies that wrap a document object and will be given to
     CS context. These proxies are the one described above.
  2. XrayWrapper proxies that wrap an object coming from CS context and will
     be passed as argument to XrayWrapper functions. These proxies are only
     internal, so nor document, nor CS have access to them.

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

Everything begins with an unique call to `create` function from content-proxy module:
  
    // Retrieve the unwrapped reference to the current web page window object
    var win = gBrowser.contentDocument.defaultView.wrappedJSObject;
    // Or in addon sdk style
    var win = require("tab-browser").activeTab.linkedBrowser.contentWindow.wrappedJSObject;
    // Now create a CS proxy for the window object
    var windowProxy = require("api-utils/content/content-proxy").create(win);
    
    // We finally use this window object as sandbox prototype,
    // so that all web page globals are accessible in CS too:
    var contentScriptSandbox = new Cu.Sandbox(win, {
      sandboxPrototype: windowProxy
    });

Then all necessary proxies are created from this first one.

    // For example, if you simply do this:
    var document = window.document
    // accessing the `document` attribute will be trapped by the CS Proxy
    // that is going to create another CS Proxy for `document`

So that the main issue of CS Proxy implementation is to ensure that we always
return CS Proxies to the content script.


## Internal implementation ##

Each CS Proxy keep a reference to the XrayWrapper that allow to ensure calling
DOM native methods and having a different attributes set.

Then, there is two key functions to convert values from/to each environnement:

1. __wrap__ takes an XrayWrapper value and wrap it into a CS proxy if needed. This method is called when:
    * we access to an attribute of a CS proxy.
    * XrayWrapper code call a function we registered before. 
    So that arguments passed by XrayWrapper are converted into CS proxies 
    (For example, an `addEventListener` callback)

2. __unwrap__ takes a value coming from the CS context and:
    * unwrap CS proxy back to an XrayWrapper reference, if this value is a CS proxy,
    * or wrap it into a XrayWrapper proxy.
<br/><br/>
So that we can call an XrayWrapper method either with:

        * a direct XrayWrapper object. 
    
                // The following line doesn't work if child is a CS proxy,
                // it has to be a raw XrayWrapper reference
                xrayWrapper.appendChild(child)
      
        * or an XrayWrapper proxy when you pass a custom object from the CS context.

                var myListener = {
                  handleEvent: function(event) {
                    // `event` should be a CS proxy
                  }
                };
                // `myListener` has to be another kind of Proxy: XrayWrapper proxy,
                // that aims to catch the call to `handleEvent` in order to wrap its
                // arguments into CS proxy.
                xrayWrapper.addEventListener("click", myListener, false);


## Stacktraces ##

    // Following code:
    function listener(event) {
      
    }
    csProxy.addEventListener("message", listener, false);
    
    // Generate following internal calls:
    -> CS Proxy:: get("addEventListener")
      -> wrap(xrayWrapper.addEventListener)
        -> NativeFunctionWrapper(xrayWrapper.addEventListener)
           Generate following function:
           function ("message", listener, false) {
              return xraywrapper.addEventListener("message", unwrap(listener), false);
           }
           -> unwrap(listener)
             -> ContentScriptFunctionWrapper(listener)
             Generate following function:
               function (event) {
                 return listener(wrap(event));
               }

<br>

    // First, create an object from CS context
    var myListener = {
      handleEvent: function (event) {
        
      }
    };
    // Then, pass this object as an argument to a CS proxy method
    window.addEventListener("message", myListener, false);
    
    // Generate following internal calls:
    -> CS Proxy:: get("addEventListener")
      -> wrap(xrayWrapper.addEventListener)
        -> NativeFunctionWrapper(xrayWrapper.addEventListener)
           Generate following function:
           function ("message", myListener, false) {
              return xraywrapper.addEventListener("message", unwrap(myListener), false);
           }
           -> unwrap(myListener)
             -> ContentScriptObjectWrapper(myListener)
                Generate an XrayWrapper proxy and give it to xrayWrapper method.
                Then when native code fires an event, the proxy will catch it:
                -> XrayWrapper Proxy:: get("handleEvent")
                  -> unwrap(myListener.handleEvent)
                    -> ContentScriptFunctionWrapper(myListener.handleEvent)
                       Generate following function:
                       function (event) {
                         return myListener.handleEvent(wrap(event));
                       }


<api name="create">
@function
  Create a content script proxy. <br/>
  Doesn't create create a proxy if we are not able to create a XrayWrapper for
  this object. (for ex: if the object comes from system principal.)

@param object {Object}
    The object to proxify.

@returns {Object}
    A content script proxy that wrap `object`.
</api>
