const { Ci, Cc } = require("chrome");

/*
 * Access key that allows privileged code to unwrap proxy wrappers through 
 * valueOf:
 *   let xpcWrapper = proxyWrapper.valueOf(UNWRAP_ACCESS_KEY);
 */
const UNWRAP_ACCESS_KEY = {};
exports.UNWRAP_ACCESS_KEY = UNWRAP_ACCESS_KEY;

 /**
 * Returns a closure that wraps arguments before calling the given function,
 * which can be given to native functions that accept a function, such that when
 * the closure is called, the given function is called with wrapped arguments.
 *
 * @param fun {Function}
 *        the function for which to create a closure wrapping its arguments
 * @param obj {Object}
 *        target object from which `fun` comes from
 *        (optional, for debugging purpose)
 * @param name {String}
 *        name of the attribute from which `fun` is binded on `obj`
 *        (optional, for debugging purpose)
 *
 * Example:
 *   function contentScriptListener(event) {}
 *   let wrapper = ContentScriptFunctionWrapper(contentScriptListener);
 *   xray.addEventListener("...", wrapper, false);
 * -> Allow to `event` to be wrapped
 */
function ContentScriptFunctionWrapper(fun, obj, name) {
  if ("___proxy" in fun && typeof fun.___proxy == "function")
    return fun.___proxy;
  
  let wrappedFun = function () {
    let args = [];
    for (let i = 0, l = arguments.length; i < l; i++)
      args.push(wrap(arguments[i]));
    
    //console.log("Called from native :"+obj+"."+name);
    //console.log(">args "+arguments.length);
    //console.log(fun);
    
    // Native code can execute this callback with `this` being the wrapped 
    // function. For example, window.mozRequestAnimationFrame.
    if (this == wrappedFun)
      return fun.apply(fun, args);
    
    return fun.apply(wrap(this), args);
  };
  
  Object.defineProperty(fun, "___proxy", {value : wrappedFun,
                                          writable : false,
                                          enumerable : false,
                                          configurable : true});
  
  return wrappedFun;
}

/**
 * Returns a closure that unwraps arguments before calling the `fun` function,
 * which can be used to build a wrapper for a native function that accepts
 * wrapped arguments, since native function only accept unwrapped arguments.
 *
 * @param fun {Function}
 *        the function to wrap
 * @param originalObject {Object}
 *        target object from which `fun` comes from
 *        (optional, for debugging purpose)
 * @param name {String}
 *        name of the attribute from which `fun` is binded on `originalObject`
 *        (optional, for debugging purpose)
 *
 * Example:
 *   wrapper.appendChild = NativeFunctionWrapper(xray.appendChild, xray);
 *   wrapper.appendChild(anotherWrapper);
 * -> Allow to call xray.appendChild with unwrapped version of anotherWrapper
 */
function NativeFunctionWrapper(fun, originalObject, name) {
  return function () {
    let args = [];
    let obj = this.valueOf ? this.valueOf(UNWRAP_ACCESS_KEY) : this;
    
    for (let i = 0, l = arguments.length; i < l; i++)
      args.push( unwrap(arguments[i], obj, name) );
    
    //if (name != "toString")
    //console.log(">>calling native ["+(name?name:'#closure#')+"]: \n"+fun.apply+"\n"+obj+"\n("+args.join(', ')+")\nthis :"+obj+"from:"+originalObject+"\n");
    
    // Need to use Function.prototype.apply.apply because XMLHttpRequest 
    // is a function (typeof return 'function') and fun.apply is null :/
    let unwrapResult = Function.prototype.apply.apply(fun, [obj, args]);
    let result = wrap(unwrapResult, obj, name);
    
    //console.log("<< "+rr+" -> "+r);
    
    return result;
  };
}

/*
 * Unwrap a JS value that comes from the content script.
 * Mainly converts proxy wrapper to XPCNativeWrapper.
 */
function unwrap(value, obj, name) {
  //console.log("unwrap : "+value+" ("+name+")");
  if (!value)
    return value;
  let type = typeof value;  
  
  // In case of proxy, unwrap them recursively 
  // (it should not be recursive, just in case of)
  if (["object", "function"].indexOf(type) !== -1 && 
      "__isWrappedProxy" in value) {
    while("__isWrappedProxy" in value)
      value = value.valueOf(UNWRAP_ACCESS_KEY);
    return value;
  }
  
  // In case of functions we need to return a wrapper that converts native 
  // arguments applied to this function into proxies.
  // Do this only for functions coming from content script.
  if (type == "function")
    return ContentScriptFunctionWrapper(value, obj, name);
  
  if (["string", "number", "boolean"].indexOf(type) !== -1)
    return value;
  //console.log("return non-wrapped to native : "+typeof value+" -- "+value);
  return value;
}

/*
 * Wrap a JS value coming from the document by building a proxy wrapper.
 */
function wrap(value, obj, name, debug) {
  if (!value)
    return value;
  let type = typeof value;
  if (type == "object") {
    // In case of: unwrap object before wrapping it
    // (it should not happen)
    while("__isWrappedProxy" in value) {
      console.trace();
      console.warn("This object is already wrapped: " + value + 
                   " (accessed from attribute " + name + ")");
      value = value.valueOf(UNWRAP_ACCESS_KEY);
    }
    if (XPCNativeWrapper.unwrap(value) !== value)
      return getProxyForObject(value);
    // In case of Event, HTMLCollection or NodeList or ???
    // XPCNativeWrapper.unwrap(value) === value
    // but it's still a XrayWrapper so let's build a proxy
    return getProxyForObject(value);
  }
  if (type == "function") {
    if (XPCNativeWrapper.unwrap(value) !== value
        || (typeof value.toString === "function" && 
            value.toString().match(/\[native code\]/))) {
      return getProxyForFunction(value, NativeFunctionWrapper(value, obj, name));
    }
    return value;
  }
  if (type == "string")
    return value;
  if (type == "number")
    return value;
  if (type == "boolean")
    return value;
  //console.log("return non-wrapped to wrapped : "+value);
  return value;
}

/* 
 * Wrap an object from the document to a proxy wrapper
 */
function getProxyForObject(obj) {
  if (typeof obj != "object") {
    let msg = "tried to proxify something other than an object: " + typeof obj;
    console.warn(msg);
    throw msg;
  }
  if ("__isWrappedProxy" in obj) {
    return obj;
  }
  // Check if there is a proxy cached on this wrapper,
  // but take care of prototype ___proxy attribute inheritance!
  if (obj && obj.___proxy && obj.___proxy.valueOf(UNWRAP_ACCESS_KEY) === obj) {
    return obj.___proxy;
  }
  
  let proxy = Proxy.create(handlerMaker(obj));
  
  Object.defineProperty(obj, "___proxy", {value : proxy,
                                          writable : true,
                                          enumerable : false,
                                          configurable : true});
  return proxy;
}

/* 
 * Wrap a function from the document to a proxy wrapper
 */
function getProxyForFunction(fun, callTrap) {
  if (typeof fun != "function") {
    let msg = "tried to proxify something other than a function: " + typeof fun;
    console.warn(msg);
    throw msg;
  }
  if ("__isWrappedProxy" in fun)
    return obj;
  if ("___proxy" in fun)
    return fun.___proxy;
  
  let proxy = Proxy.createFunction(handlerMaker(fun), callTrap);
  
  Object.defineProperty(fun, "___proxy", {value : proxy,
                                          writable : false,
                                          enumerable : false,
                                          configurable : false});
  
  return proxy;
}

/* 
 * Check if a DOM attribute name is an event name.
 */
function isEventName(id) {
  if (id.indexOf("on") != 0 || id.length == 2) 
    return false;
  // Taken from:
  // http://mxr.mozilla.org/mozilla-central/source/dom/base/nsDOMClassInfo.cpp#7616
  switch (id[2]) {
    case 'a' :
      return (id == "onabort" ||
              id == "onafterscriptexecute" ||
              id == "onafterprint");
    case 'b' :
      return (id == "onbeforeunload" ||
              id == "onbeforescriptexecute" ||
              id == "onblur" ||
              id == "onbeforeprint");
    case 'c' :
      return (id == "onchange"       ||
              id == "onclick"        ||
              id == "oncontextmenu"  ||
              id == "oncopy"         ||
              id == "oncut"          ||
              id == "oncanplay"      ||
              id == "oncanplaythrough");
    case 'd' :
      return (id == "ondblclick"     || 
              id == "ondrag"         ||
              id == "ondragend"      ||
              id == "ondragenter"    ||
              id == "ondragleave"    ||
              id == "ondragover"     ||
              id == "ondragstart"    ||
              id == "ondrop"         ||
              id == "ondurationchange");
    case 'e' :
      return (id == "onerror" ||
              id == "onemptied" ||
              id == "onended");
    case 'f' :
      return id == "onfocus";
    case 'h' :
      return id == "onhashchange";
    case 'i' :
      return (id == "oninput" ||
              id == "oninvalid");
    case 'k' :
      return (id == "onkeydown"      ||
              id == "onkeypress"     ||
              id == "onkeyup");
    case 'l' :
      return (id == "onload"           ||
              id == "onloadeddata"     ||
              id == "onloadedmetadata" ||
              id == "onloadstart");
    case 'm' :
      return (id == "onmousemove"    ||
              id == "onmouseout"     ||
              id == "onmouseover"    ||
              id == "onmouseup"      ||
              id == "onmousedown"    ||
              id == "onmessage");
    case 'p' :
      return (id == "onpaint"        ||
              id == "onpageshow"     ||
              id == "onpagehide"     ||
              id == "onpaste"        ||
              id == "onpopstate"     ||
              id == "onpause"        ||
              id == "onplay"         ||
              id == "onplaying"      ||
              id == "onprogress");
    case 'r' :
      return (id == "onreadystatechange" ||
              id == "onreset"            ||
              id == "onresize"           ||
              id == "onratechange");
    case 's' :
      return (id == "onscroll"       ||
              id == "onselect"       ||
              id == "onsubmit"       || 
              id == "onseeked"       ||
              id == "onseeking"      ||
              id == "onstalled"      ||
              id == "onsuspend");
    case 't':
      return id == "ontimeupdate" 
      /* 
        // TODO: Make it work for mobile version
        ||
        (nsDOMTouchEvent::PrefEnabled() &&
         (id == "ontouchstart" ||
          id == "ontouchend" ||
          id == "ontouchmove" ||
          id == "ontouchenter" ||
          id == "ontouchleave" ||
          id == "ontouchcancel"))*/;
      
    case 'u' :
      return id == "onunload";
    case 'v':
      return id == "onvolumechange";
    case 'w':
      return id == "onwaiting";
    }
  
  return false;
}


/* 
 * Generate handler for proxy wrapper
 */
function handlerMaker(obj) {
  // Overloaded attributes dictionary
  let overload = {};
  // Expando attributes dictionary (i.e. onclick, onfocus, on* ...)
  let expando = {};
  return {
    // Fundamental traps
    getPropertyDescriptor:  function(name) {
      return Object.getOwnPropertyDescriptor(obj, name);
    },
    defineProperty: function(name, desc) {
      return Object.defineProperty(obj, name, desc);
    },
    getOwnPropertyNames: function () {
      return Object.getOwnPropertyNames(obj);
    },
    delete: function(name) {
      delete expando[name];
      delete overload[name];
      return delete obj[name];
    },
    
    // derived traps
    has: function(name) {
      if (name == "___proxy") return false;
      if (isEventName(name)) {
        // XrayWrappers throw exception when we try to access expando attributes
        // even on "name in wrapper". So avoid doing it!
        return name in expando;
      }
      return name in obj || name in overload || name == "__isWrappedProxy";
    },
    hasOwn: function(name) {
      return Object.prototype.hasOwnProperty.call(obj, name);
    },
    get: function(receiver, name) {
      
      if (name == "___proxy")
        return undefined;
      
      // Overload toString in order to avoid returning "[XrayWrapper [object HTMLElement]]"
      // or "[object Function]" for function's Proxy
      if (name == "toString")
        return wrap(obj.wrappedJSObject ? obj.wrappedJSObject.toString
                                        : obj.toString,
                    obj, name);
      
      // Offer a way to retrieve XrayWrapper from a proxified node through `valueOf`
      if (name == "valueOf")
        return function (key) {
          if (key === UNWRAP_ACCESS_KEY)
            return obj;
          return this;
        };
      
      // Return overloaded value if there is one.
      // It allows to overload native methods like addEventListener that
      // are not saved, even on the wrapper itself.
      // (And avoid some methods like toSource from being returned here! [__proto__ test])
      if (name in overload && overload[name] != overload.__proto__[name] && name != "__proto__") {
        return overload[name];
      }
      
      // Catch exceptions thrown by XrayWrappers when we try to access on* 
      // attributes like onclick, onfocus, ...
      if (isEventName(name)) {
        //console.log("expando:"+obj+" - "+obj.nodeType);
        return name in expando ? expando[name].original : undefined;
      }
      
      let o = obj[name];
      
      // Fix bug with XPCNativeWrapper on HTMLCollection
      // We can only access array item once, then it's undefined :o
      let i = parseInt(name)
      if (!o && obj.toString().match(/HTMLCollection|NodeList/) && i >= 0 && i < obj.length) {
        o = XPCNativeWrapper(obj.wrappedJSObject[name]);
      }
      
      // Trap access to document["form name"] 
      // that may refer to an existing form node
      // http://mxr.mozilla.org/mozilla-central/source/dom/base/nsDOMClassInfo.cpp#9285
      if (!o && "nodeType" in obj && obj.nodeType == 9) {
        let node = obj.wrappedJSObject[name];
        // List of supported tag:
        // http://mxr.mozilla.org/mozilla-central/source/content/html/content/src/nsGenericHTMLElement.cpp#1267
        if (node && ["IMG", "FORM", "APPLET", "EMBED", "OBJECT"].indexOf(node.tagName) != -1)
          return wrap(XPCNativeWrapper(node));
      }
      
      // Trap access to window["frame name"]
      // that refer to an (i)frame node
      // http://mxr.mozilla.org/mozilla-central/source/dom/base/nsDOMClassInfo.cpp#6824
      if (!o && typeof obj == "object" && "document" in obj) {
        try {
          obj.QueryInterface(Ci.nsIDOMWindow);
          let win = obj.wrappedJSObject[name];
          let nodes = obj.document.getElementsByName(name);
          for (let i = 0, l = nodes.length; i < l; i++) {
            let node = nodes[i];
            if ("contentWindow" in node && node.contentWindow.wrappedJSObject == win)
              return wrap(node.contentWindow);
          }
        }
        catch(e) {}
      }
      
      // Trap access to form["node name"]
      // http://mxr.mozilla.org/mozilla-central/source/dom/base/nsDOMClassInfo.cpp#9477
      if (!o && typeof obj == "object" && obj.tagName == "FORM") {
        let match = obj.wrappedJSObject[name];
        let nodes = obj.ownerDocument.getElementsByName(name);
        for (let i = 0, l = nodes.length; i < l; i++) {
          let node = nodes[i];
          if (node.wrappedJSObject == match)
            return wrap(node);
        }
      }
      
      // Fix mozMatchesSelector uses that is broken on XrayWrappers
      // when we use document.documentElement.mozMatchesSelector.call(node, expr)
      // It's only working if we call mozMatchesSelector on the node itself.
      // SEE BUG 658909: mozMatchesSelector returns incorrect results with XrayWrappers
      if (typeof o == "function" && name == "mozMatchesSelector") {
        // We can't use `wrap` function as `f` is not a native function,
        // so wrap it manually:
        let f = function mozMatchesSelector(selectors) {
          return this.mozMatchesSelector(selectors);
        };
        return getProxyForFunction(f, NativeFunctionWrapper(f));
      }
      
      // Fix XPathResult's constants being undefined on XrayWrappers
      // these constants are defined here:
      // http://mxr.mozilla.org/mozilla-central/source/dom/interfaces/xpath/nsIDOMXPathResult.idl
      // and are only numbers.
      // See bug 665279 for platform fix progress
      if (!o && typeof obj == "object" && name in Ci.nsIDOMXPathResult) {
        let value = Ci.nsIDOMXPathResult[name];
        if (typeof value == "number" && value === obj.wrappedJSObject[name])
          return value;
      }

      // Generic case
      return wrap(o, obj, name);
      
    },
    
    set: function(receiver, name, val) {
      
      if (isEventName(name)) {
        //console.log("SET on* attribute : " + name + " / " + val + "/" + obj);
        let shortName = name.replace(/^on/,"");
        
        // Unregister previously set listener
        if (expando[name]) {
          obj.removeEventListener(shortName, expando[name], true);
          delete expando[name];
        }
        
        // Only accept functions
        if (typeof val != "function")
          return false;
        
        // Register a new listener
        let original = val;
        val = ContentScriptFunctionWrapper(val);
        expando[name] = val;
        val.original = original;
        obj.addEventListener(name.replace(/^on/, ""), val, true);
        return true;
      }
      
      obj[name] = val;
      
      // Handle native method not overloaded on XrayWrappers:
      //   obj.addEventListener = val; -> obj.addEventlistener = native method
      // And, XPCNativeWrapper bug where nested values appear to be wrapped:
      // obj.customNestedAttribute = val -> obj.customNestedAttribute !== val
      //                                    obj.customNestedAttribute = "waive wrapper something"
      // SEE BUG 658560: Fix identity problem with CrossOriginWrappers
      // TODO: check that DOM can't be updated by the document itself and so overloaded value becomes wrong
      //       but I think such behavior is limited to primitive type
      if ((typeof val == "function" || typeof val == "object") && name) {
        overload[name] = val;
      }
      
      return true;
    },
    
    enumerate: function() {
      var result = [];
      for each (name in Object.keys(obj)) {
        result.push(name);
      };
      return result;
    },
    
    keys: function() {
      return Object.keys(obj);
    }
  };
};


/* 
 * Wrap an object from the document to a proxy wrapper.
 */
exports.create = function create(object) {
  let xpcWrapper = XPCNativeWrapper(object);
  // If we can't build an XPCNativeWrapper, it doesn't make sense to build
  // a proxy. All proxy code is based on having such wrapper that store
  // different JS attributes set.
  // (we can't build XPCNativeWrapper when object is from the same
  // principal/domain)
  if (object === xpcWrapper) {
    return object;
  }
  return getProxyForObject(xpcWrapper);
}
