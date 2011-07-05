const proxy = require("content/content-proxy");
const hiddenFrames = require("hidden-frame");

exports.testProxy = function (test) {
  let html = '<input id="input" type="text" /><input id="input3" type="checkbox" />' + 
             '<input id="input2" type="checkbox" />' + 
             '<script>var documentGlobal = true</script>';
  let url = 'data:text/html,' + encodeURI(html);
  test.waitUntilDone();
  
  let hiddenFrame = hiddenFrames.add(hiddenFrames.HiddenFrame({
    onReady: function () {
      
      function onDOMReady() {
        hiddenFrame.element.removeEventListener("DOMContentLoaded", onDOMReady,
                                                false);
        let win = hiddenFrame.element.contentWindow.wrappedJSObject;
        
        test.assert(win.documentGlobal, "`win` object is unwrapped");
        
        let wrapped = proxy.create(win);
        let document = wrapped.document;
        let body = document.body;
        
        // Check mozMatchesSelector XrayWrappers bug:
        // mozMatchesSelector returns bad results when we are not calling it from the node itself
        // SEE BUG 658909: mozMatchesSelector returns incorrect results with XrayWrappers
        test.assert(document.createElement( "div" ).mozMatchesSelector("div"), 
                    "mozMatchesSelector works while being called from the node");
        test.assert(document.documentElement.mozMatchesSelector.call(
                      document.createElement( "div" ), 
                      "div" 
                    ), 
                    "mozMatchesSelector works while being called from a " +
                    "function reference to " +
                    "document.documentElement.mozMatchesSelector.call");
        
        // If we add a "____proxy" attribute on XrayWrappers in order to store
        // the related proxy to create an unique proxy for each wrapper;
        // we end up setting this attribute to prototype objects :x
        // And so, instances created with such prototype will be considered 
        // as equal to the prototype ...
        //   // Internal method that return the proxy for a given XrayWrapper
        //   function proxify(obj) {
        //     if (obj._proxy) return obj._proxy;
        //     return obj._proxy = Proxy.create(...);
        //   }
        //   
        //   // Get a proxy of a XrayWrapper prototype object
        //   let proto = proxify(xpcProto);
        //   
        //   // Use this proxy as a prototype 
        //   function Constr() {}
        //   Constr.proto = proto;
        //   
        //   // Try to create an instance using this prototype
        //   let xpcInstance = new Constr();
        //   let wrapper = proxify(xpcInstance)
        //
        //   xpcProto._proxy = proto and as xpcInstance.__proto__ = xpcProto,
        //   xpcInstance._proxy = proto ... and profixy(xpcInstance) = proto :(
        //
        let proto = wrapped.document.createEvent('HTMLEvents').__proto__;
        wrapped.Event.prototype = proto;
        let event = document.createEvent('HTMLEvents');
        test.assertNotEqual(event, proto, "Event should not be equal to its prototype");
        event.initEvent('dataavailable', true, true);
        test.assertEqual(event.type, 'dataavailable', "Events are working fine");
        
        // XrayWrappers has a bug when you set an attribute on it,
        // in some cases, it creates an unnecessary wrapper that introduces
        // a different object that refers to the same original object
        // Check that our wrappers don't reproduce this bug
        // SEE BUG 658560: Fix identity problem with CrossOriginWrappers
        let o = {sandboxObject:true};
        wrapped.nested = o;
        o.foo = true;
        test.assertEqual(o, wrapped.nested, "Nested attribute to sandbox object should not be proxified");
        wrapped.nested = document;
        test.assertEqual(wrapped.nested, document, "Nested attribute to proxy should not be double proxified");
        
        // Check form[nodeName]
        let form = document.createElement("form");
        let input = document.createElement("input");
        input.setAttribute("name", "test");
        form.appendChild(input);
        body.appendChild(form);
        test.assertEqual(form.test, input, "form[nodeName] is valid");
        body.removeChild(form);
        
        // Check localStorage:
        test.assert(wrapped.localStorage, "has access to localStorage");
        wrapped.localStorage.name = 1;
        test.assertEqual(wrapped.localStorage.name, 1, "localStorage appears to work");
        test.assertEqual(win.localStorage.name, 1, "localStorage really works");
        wrapped.localStorage.clear();
        test.assertEqual(wrapped.localStorage.name, undefined, "localStorage really, really works");
        
        // Check sessionStorage:
        /*
          // Does not work on data: uri
        console.log(wrapped.sessionStorage);
        //test.assert(wrapped.sessionStorage, "has access to localStorage");
        wrapped.sessionStorage.setItem('name', 1);
        test.assertEqual(wrapped.sessionStorage.getItem('name'), 1, "localStorage appears to work");
        test.assertEqual(win.sessionStorage.getItem('name'), 1, "localStorage really work");
        wrapped.sessionStorage.clear();
        test.assert(!wrapped.sessionStorage.hasItem('name'), "localStorage really,really work");
        */
        
        // Setting a custom object to a proxy attribute is not wrapped when we get it afterward
        let object = {custom: true, enumerable: false};
        body.customAttribute = object;
        test.assertEqual(body.customAttribute.valueOf(), body.customAttribute.valueOf(proxy.UNWRAP_ACCESS_KEY), "custom JS attributes are not wrapped");
        test.assertEqual(object, body.customAttribute, "custom JS attributes are not wrapped");
        
        /*
        let originalToString = win.Object.prototype.toString;
        win.Object.prototype.toString = function overloadedToString() {
          return originalToString.apply(this.valueOf(proxy.UNWRAP_ACCESS_KEY));
        };
        */
        // <object>, <embed> and other tags return typeof 'function'
        let flash = document.createElement("object");
        test.assertEqual(typeof flash, "function", "<object> is typeof 'function'");
        test.assertEqual(flash.toString(), "[object HTMLObjectElement]", "<object> is HTMLObjectElement");
        test.assert("setAttribute" in flash, "<object> has a setAttribute method");
        flash.setAttribute("classid", "clsid:D27CDB6E-AE6D-11cf-96B8-444553540000");
        // This is how jquery call toString:
        test.assertEqual(win.Object.prototype.toString.call(""), "[object String]", "strings are strings");
        test.assertEqual(win.Object.prototype.toString.call({}), "[object Object]", "objects are objects");
        // We do not have any workaround this particular use of toString
        // applied on <object> elements. So disable this test until we found one!
        //test.assertEqual(win.Object.prototype.toString.call(flash), "[object HTMLObjectElement]", "<object> is HTMLObjectElement");
        function f() {};
        test.assertEqual(Object.prototype.toString.call(f), "[object Function]", "functions are functions 1");
        test.assertEqual(win.Object.prototype.toString.call(f), "[object Function]", "functions are functions 2");
        
        // Verify isolated JS values
        test.assert(!wrapped.documentGlobal, "proxy doesn't expose document variable");
        
        // Check document[tagName]
        let div = document.createElement("div");
        div.setAttribute("name", "test");
        body.appendChild(div);
        test.assert(!document.test, "document[divName] is undefined");
        body.removeChild(div);
        
        let form = document.createElement("form");
        form.setAttribute("name", "test");
        body.appendChild(form);
        test.assertEqual(document.test, form, "document[formName] is valid");
        body.removeChild(form);
        
        let img = document.createElement("img");
        img.setAttribute("name", "test");
        body.appendChild(img);
        test.assertEqual(document.test, img, "document[imgName] is valid");
        body.removeChild(img);
        
        // Check window[frameName]
        let iframe = document.createElement("iframe");
        iframe.setAttribute("name", "test");
        body.appendChild(iframe);
        test.assertEqual(wrapped.test, iframe.contentWindow, "window[frameName] is valid");
        body.removeChild(iframe);
        
        // Highlight XPCNativeWrapper bug with HTMLCollection
        // tds[0] is only defined on first access :o
        let div = document.createElement("div");
        body.appendChild(div);
        div.innerHTML = "<table><tr><td style='padding:0;border:0;display:none'></td><td>t</td></tr></table>";
        let tds = div.getElementsByTagName("td");
        test.assertEqual(tds[0], tds[0], "We can get array element multiple times");
        body.removeChild(div);
        
        // Verify that NodeList/HTMLCollection are working fine
        let inputs = body.getElementsByTagName("input");
        test.assertEqual(body.childNodes.length, 4, "body.childNodes length is correct");
        test.assertEqual(inputs.length, 3, "inputs.length is correct");
        test.assertEqual(body.childNodes[0], inputs[0], "body.childNodes[0] is correct");
        test.assertEqual(body.childNodes[1], inputs[1], "body.childNodes[1] is correct");
        test.assertEqual(body.childNodes[2], inputs[2], "body.childNodes[2] is correct");
        let count = 0;
        for(let i in body.childNodes) {
          count++;
        }
        test.assertEqual(count, 4, "body.childNodes is iterable");
        
        // Check internal use of valueOf()
        test.assertEqual(wrapped.valueOf().toString(), "[object Window]", "proxy.valueOf() returns the wrapped version");
        test.assertEqual(wrapped.valueOf({}).toString(), "[object Window]", "proxy.valueOf({}) returns the wrapped version");
        test.assertEqual(wrapped.valueOf(proxy.UNWRAP_ACCESS_KEY).toString(), "[object XrayWrapper [object Window]]", "proxy.valueOf(UNWRAP_ACCESS_KEY) returns the unwrapped version");
        
        // XMLHttpRequest doesn't support XMLHttpRequest.apply,
        // that may break our proxy code
        test.assert(wrapped.XMLHttpRequest(), "we are able to instantiate XMLHttpRequest object");
        
        // Check XPathResult bug with constants being undefined on 
        // XPCNativeWrapper
        let value = 
          win.XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE;
        let xpcXPathResult = XPCNativeWrapper(win).XPathResult;
        test.assertEqual(xpcXPathResult.wrappedJSObject.
                           UNORDERED_NODE_SNAPSHOT_TYPE, 
                         value, 
                         "XPathResult's constants are valid on unwrapped node");
        // The following test will fail if platform is fixed,
        // so we will be able to know when to remove the work around.
        test.assertEqual(xpcXPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, 
                         undefined, 
                         "XPathResult's constants are undefined on " + 
                         "XPCNativeWrapper (platform bug #)");
        // Check that our work around is working:
        test.assertEqual(wrapped.XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, 
                         value, "XPathResult works correctly on Proxies");

        // Verify that inherited prototype function like initEvent 
        // are handled correctly. (e2.type will return an error if it's not the case)
        let event1 = document.createEvent( 'MouseEvents' );
        event1.initEvent( "click", true, true );
        let event2 = document.createEvent( 'MouseEvents' );
        event2.initEvent( "click", true, true );
        test.assert(event2.type, "click", "We are able to create an event");
        
        // Check basic usage of functions
        win.callFunction = function (f) f();
        let closure2 = function () {return "ok";};
        test.assertEqual(wrapped.wrappedJSObject.callFunction(closure2), "ok", "Function references work");
        
        // Ensure that functions are cached when being wrapped to native code
        win.isEqual = function (a, b) a == b;
        let closure = function () {};
        test.assert(wrapped.wrappedJSObject.isEqual(closure, closure), "Function references are cached before being wrapped to native");
        
        // Verify listeners:
        let input = document.getElementById("input2");
        test.assert(input, "proxy.getElementById works");
        
        function onclick() {};
        input.onclick = onclick;
        test.assertEqual(input.onclick, onclick, "on* attributes are equal to original function set");
        
        let addEventListenerCalled = false;
        let expandoCalled = false;
        input.addEventListener("click", function onclick(event) {
          input.removeEventListener("click", onclick, true);
          
          test.assert(!addEventListenerCalled, "closure given to addEventListener is called once");
          if (addEventListenerCalled)
            return;
          addEventListenerCalled = true;
          
          test.assert(!event.target.ownerDocument.defaultView.documentGlobal, "event object is still wrapped and doesn't expose document globals");
          test.assert("__isWrappedProxy" in event.target, "event object is a proxy");
          
          let input2 = document.getElementById("input2");
          
          input.onclick = function (event) {
            input.onclick = null;
            test.assert(!expandoCalled, "closure set to expando is called once");
            if (expandoCalled) return;
            expandoCalled = true;
            
            test.assert(!event.target.ownerDocument.defaultView.documentGlobal, "event object is still wrapped and doesn't expose document globals");
            test.assert("__isWrappedProxy" in event.target, "event object is a proxy");
            
            require("timer").setTimeout(function () {
              input.click();
              
              // Next test:
              checkRequestAnimation();
            }, 0);
            
          }
          
          require("timer").setTimeout(function () {
            input.click();
          }, 0);
          
        }, true);
        
        input.click();
        
        // Check ContentScriptFunction with function as "this" object
        // For example, window.mozRequestAnimationFrame call its callback 
        // argument with `this` being the callback itself.
        function checkRequestAnimation() {
          wrapped.mozRequestAnimationFrame(function callback() {
            test.assertEqual(callback, this, "callback is equal to `this`");
            
            end();
          });
        }
        
        function end() {
          hiddenFrames.remove(hiddenFrame);
          test.done();
        }
      }
      
      hiddenFrame.element.addEventListener("DOMContentLoaded", onDOMReady, false);
      hiddenFrame.element.setAttribute("src", url);
      
    }
  }));
}
