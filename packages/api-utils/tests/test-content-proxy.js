const hiddenFrames = require("hidden-frame");
const Worker = require("content").Worker;

let global = {
  xrayWindow: null,
  rawWindow: null
};

exports.testCreateTestDocument = function (test) {
  test.waitUntilDone();
  let html = '<input id="input" type="text" /><input id="input3" type="checkbox" />' + 
             '<input id="input2" type="checkbox" />' + 
             '<script>var documentGlobal = true</script>' +
             '<iframe id="iframe" name="test" src="data:text/html," />';
  let url = 'data:text/html,' + encodeURI(html);
  
  let hiddenFrame = global.hiddenFrame = hiddenFrames.add(hiddenFrames.HiddenFrame({
    onReady: function () {
      
      function onDOMReady() {
        hiddenFrame.element.removeEventListener("DOMContentLoaded", onDOMReady,
                                                false);
        
        global.xrayWindow = hiddenFrame.element.contentWindow;
        global.rawWindow = global.xrayWindow.wrappedJSObject;
        
        test.assert(!global.xrayWindow.documentGlobal, "xrayWindow is valid");

        test.pass("Test document successfully created");
        test.done();
      }

      hiddenFrame.element.addEventListener("DOMContentLoaded", onDOMReady, false);
      hiddenFrame.element.setAttribute("src", url);

    }
  }));

}

function createWorker(test, contentScript) {
  // Tell content-proxy.js that we `UNWRAP_ACCESS_KEY` in content script globals
  global.xrayWindow.document.setUserData("___include_UNWRAP_ACCESS_KEY", "true", null);

  let key = require("api-utils/content/worker").UNWRAP_ACCESS_KEY;
  let worker = Worker({
    window: global.xrayWindow,
    contentScript: [
      'UNWRAP_ACCESS_KEY = "' + key + '";' +
      'new ' + function () {
        assert = function assert(v, msg) {
          self.port.emit("assert", {assertion:v, msg:msg});
        }
        done = function done() {
          self.port.emit("done");
        }
        if (!("UNWRAP_ACCESS_KEY" in window))
          assert(false, "doesn't have access to `UNWRAP_ACCESS_KEY`");
      },
      contentScript
    ]
  });

  worker.port.on("done", test.done.bind(test));
  worker.port.on("assert", function (data) {
    test.assert(data.assertion, data.msg);
  });

  return worker;
}

exports.testPostMessage = function (test) {
  test.waitUntilDone();

  // Ensure that postMessage is working correctly.
  // 1/ Check across documents with an iframe
  let ifWindow = global.xrayWindow.document.getElementById("iframe").contentWindow;
  // Listen without proxies, to check that it will work in regular case
  // simulate listening from a web document.
  ifWindow.addEventListener("message", function listener(event) {
    //if (event.source.wrappedJSObject == global.rawWindow) return;
    ifWindow.removeEventListener("message", listener, false);
    // As we are in system principal, event is an XrayWrapper
    test.assertEqual(event.source, ifWindow,
                     "event.source is the iframe window");
    test.assertEqual(event.origin, "null", "origin is null");
    test.assertEqual(event.data, "ok", "message data is correct");
    test.done();
  }, false);

  createWorker(test,
    'new ' + function ContentScriptScope() {
      assert(postMessage === postMessage,
          "verify that we doesn't generate multiple functions for the same method");
      document.getElementById("iframe").contentWindow.postMessage("ok", "*");
    }
  );

}

exports.testObjectListener = function (test) {
  test.waitUntilDone();

  createWorker(test,
    'new ' + function ContentScriptScope() {
      // Test objects being given as event listener
      let input = document.getElementById("input2");
      let myClickListener = {
        called: false,
        handleEvent: function(event) {
          assert(this === myClickListener, "`this` is the original object");
          assert(!this.called, "called only once");
          this.called = true;
          assert(event.valueOf() !== event.valueOf(UNWRAP_ACCESS_KEY), "event is wrapped");
          assert(event.target, input, "event.target is the wrapped window");
          done();
        }
      };

      window.addEventListener("click", myClickListener, true);
      input.click();
      window.removeEventListener("click", myClickListener, true);
    }
  );
}

exports.testObjectListener2 = function (test) {
  test.waitUntilDone();

  createWorker(test,
    'new ' + function ContentScriptScope() {
      // Verify object as DOM event listener
      let myMessageListener = {
        called: false,
        handleEvent: function(event) {
          window.removeEventListener("message", myMessageListener, true);

          assert(this == myMessageListener, "`this` is the original object");
          assert(!this.called, "called only once");
          this.called = true;
          assert(event.valueOf() !== event.valueOf(UNWRAP_ACCESS_KEY), "event is wrapped");          
          assert(event.target == document.defaultView, "event.target is the wrapped window");
          assert(event.source == document.defaultView, "event.source is the wrapped window");
          assert(event.origin == "null", "origin is null");
          assert(event.data == "ok", "message data is correct");
          done();
        }
      };

      window.addEventListener("message", myMessageListener, true);
      document.defaultView.postMessage("ok", '*');
    }
  );
}

exports.testStringOverload = function (test) {
  test.waitUntilDone();

  // Proxy - toString error
  let originalString = "string";
  let p = Proxy.create({
    get: function(receiver, name) {
      if (name == "binded")
        return originalString.toString.bind(originalString);
      return originalString[name];
    }
  });
  test.assertRaises(function () {
    p.toString();
  },
  /String.prototype.toString called on incompatible Proxy/,
  "toString can't be called with this being the proxy");
  test.assertEqual(p.binded(), "string", "but it works if we bind this to the original string");

  createWorker(test,
    'new ' + function ContentScriptScope() {
      // RightJS is hacking around String.prototype, and do similar thing:
      // Pass `this` from a String prototype method.
      // It is funny because typeof this == "object"!
      // So that when we pass `this` to a native method,
      // our proxy code can fail on another even more crazy thing.
      // See following test to see what fails around proxies.
      String.prototype.update = function () {
        assert(typeof this == "object", "in update, `this` is an object");
        assert(this.toString() == "input", "in update, `this.toString works");
        return document.querySelectorAll(this);
      };
      assert("input".update().length == 3, "String.prototype overload works");
      done();
    }
  );
}

exports.testMozMatchedSelector = function (test) {
  test.waitUntilDone();

  createWorker(test,
    'new ' + function ContentScriptScope() {
      // Check mozMatchesSelector XrayWrappers bug:
      // mozMatchesSelector returns bad results when we are not calling it from the node itself
      // SEE BUG 658909: mozMatchesSelector returns incorrect results with XrayWrappers
      assert(document.createElement( "div" ).mozMatchesSelector("div"),
             "mozMatchesSelector works while being called from the node");
      assert(document.documentElement.mozMatchesSelector.call(
               document.createElement( "div" ),
               "div"
             ),
             "mozMatchesSelector works while being called from a " +
             "function reference to " +
             "document.documentElement.mozMatchesSelector.call");
      done();
    }
  );
}

exports.testEventsOverload = function (test) {
  test.waitUntilDone();

  createWorker(test,
    'new ' + function ContentScriptScope() {
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
      let proto = window.document.createEvent('HTMLEvents').__proto__;
      window.Event.prototype = proto;
      let event = document.createEvent('HTMLEvents');
      assert(event !== proto, "Event should not be equal to its prototype");
      event.initEvent('dataavailable', true, true);
      assert(event.type === 'dataavailable', "Events are working fine");
      done();
    }
  );
}

exports.testNestedAttributes = function (test) {
  test.waitUntilDone();

  createWorker(test,
    'new ' + function ContentScriptScope() {
      // XrayWrappers has a bug when you set an attribute on it,
      // in some cases, it creates an unnecessary wrapper that introduces
      // a different object that refers to the same original object
      // Check that our wrappers don't reproduce this bug
      // SEE BUG 658560: Fix identity problem with CrossOriginWrappers
      let o = {sandboxObject:true};
      window.nested = o;
      o.foo = true;
      assert(o === window.nested, "Nested attribute to sandbox object should not be proxified");
      window.nested = document;
      assert(window.nested === document, "Nested attribute to proxy should not be double proxified");
      done();
    }
  );
}

exports.testFormNodeName = function (test) {
  test.waitUntilDone();

  createWorker(test,
    'new ' + function ContentScriptScope() {
      let body = document.body;
      // Check form[nodeName]
      let form = document.createElement("form");
      let input = document.createElement("input");
      input.setAttribute("name", "test");
      form.appendChild(input);
      body.appendChild(form);
      assert(form.test == input, "form[nodeName] is valid");
      body.removeChild(form);
      done();
    }
  );
}

exports.testLocalStorage = function (test) {
  test.waitUntilDone();

  let w = createWorker(test,
    'new ' + function ContentScriptScope() {
      // Check localStorage:
      assert(window.localStorage, "has access to localStorage");
      window.localStorage.name = 1;
      assert(window.localStorage.name == 1, "localStorage appears to work");

      self.port.on("step2", function () {
        window.localStorage.clear();
        assert(window.localStorage.name == undefined, "localStorage really, really works");
        done();
      });
      self.port.emit("step1");
    }
  );

  w.port.on("step1", function () {
    test.assertEqual(global.rawWindow.localStorage.name, 1, "localStorage really works");
    w.port.emit("step2");
  });
}

exports.testAutoUnwrapCustomAttributes = function (test) {
  test.waitUntilDone();

  createWorker(test,
    'new ' + function ContentScriptScope() {
      let body = document.body;
      // Setting a custom object to a proxy attribute is not wrapped when we get it afterward
      let object = {custom: true, enumerable: false};
      body.customAttribute = object;
      assert(body.customAttribute.valueOf() === body.customAttribute.valueOf(UNWRAP_ACCESS_KEY), "custom JS attributes are not wrapped");
      assert(object === body.customAttribute, "custom JS attributes are not wrapped");
      done();
    }
  );
}

exports.testObjectTag = function (test) {
  test.waitUntilDone();

  createWorker(test,
    'new ' + function ContentScriptScope() {
      // <object>, <embed> and other tags return typeof 'function'
      let flash = document.createElement("object");
      assert(typeof flash == "function", "<object> is typeof 'function'");
      assert(flash.toString().match(/\[object HTMLObjectElement.*\]/), "<object> is HTMLObjectElement");
      assert("setAttribute" in flash, "<object> has a setAttribute method");
      done();
    }
  );
}

exports.testHighlightToStringBehavior = function (test) {
  // This is how jquery call toString:
  test.assertMatches(global.rawWindow.Object.prototype.toString.call(""), /\[object String.*\]/, "strings are strings");
  test.assertMatches(global.rawWindow.Object.prototype.toString.call({}), /\[object Object.*\]/, "objects are objects");
  // We do not have any workaround this particular use of toString
  // applied on <object> elements. So disable this test until we found one!
  //test.assertEqual(global.rawWindow.Object.prototype.toString.call(flash), "[object HTMLObjectElement]", "<object> is HTMLObjectElement");
  function f() {};
  test.assertMatches(Object.prototype.toString.call(f), /\[object Function.*\]/, "functions are functions 1");
  // Make sure to pass a function from the same compartments
  // or toString will return [object Object] on FF8+
  let f2 = global.rawWindow.eval("(function () {})");
  test.assertMatches(global.rawWindow.Object.prototype.toString.call(f2), /\[object Function.*\]/, "functions are functions 2");
}

exports.testDocumentTagName = function (test) {
  test.waitUntilDone();

  createWorker(test,
    'new ' + function ContentScriptScope() {
      let body = document.body;
      // Check document[tagName]
      let div = document.createElement("div");
      div.setAttribute("name", "test");
      body.appendChild(div);
      assert(!document.test, "document[divName] is undefined");
      body.removeChild(div);

      let form = document.createElement("form");
      form.setAttribute("name", "test");
      body.appendChild(form);
      assert(document.test == form, "document[formName] is valid");
      body.removeChild(form);

      let img = document.createElement("img");
      img.setAttribute("name", "test");
      body.appendChild(img);
      assert(document.test == img, "document[imgName] is valid");
      body.removeChild(img);
      done();
    }
  );
}

exports.testWindowFrames = function (test) {
  test.waitUntilDone();

  createWorker(test,
    'let glob = this; new ' + function ContentScriptScope() {
      // Check window[frameName] and window.frames[i]
      let iframe = document.getElementById("iframe");
      //assert(window.frames.length == 1, "The iframe is reported in window.frames check1");
      //assert(window.frames[0] == iframe.contentWindow, "The iframe is reported in window.frames check2");
      //console.log(window.test+ "-"+iframe.contentWindow);
      //console.log(window);
      assert(window.test == iframe.contentWindow, "window[frameName] is valid");
      done();
    }
  );
}

exports.testCollections = function (test) {
  test.waitUntilDone();

  createWorker(test,
    'new ' + function ContentScriptScope() {
      // Highlight XPCNativeWrapper bug with HTMLCollection
      // tds[0] is only defined on first access :o
      let body = document.body;
      let div = document.createElement("div");
      body.appendChild(div);
      div.innerHTML = "<table><tr><td style='padding:0;border:0;display:none'></td><td>t</td></tr></table>";
      let tds = div.getElementsByTagName("td");
      assert(tds[0] == tds[0], "We can get array element multiple times");
      body.removeChild(div);
      done();
    }
  );
}

exports.testCollections2 = function (test) {
  test.waitUntilDone();

  createWorker(test,
    'new ' + function ContentScriptScope() {
      // Verify that NodeList/HTMLCollection are working fine
      let body = document.body;
      let inputs = body.getElementsByTagName("input");
      assert(body.childNodes.length == 5, "body.childNodes length is correct");
      assert(inputs.length == 3, "inputs.length is correct");
      assert(body.childNodes[0] == inputs[0], "body.childNodes[0] is correct");
      assert(body.childNodes[1] == inputs[1], "body.childNodes[1] is correct");
      assert(body.childNodes[2] == inputs[2], "body.childNodes[2] is correct");
      let count = 0;
      for(let i in body.childNodes) {
        count++;
      }
      assert(count == 5, "body.childNodes is iterable");
      done();
    }
  );
}
exports.testValueOf = function (test) {
  test.waitUntilDone();

  createWorker(test,
    'new ' + function ContentScriptScope() {
      // Check internal use of valueOf()
      assert(window.valueOf().toString().match(/\[object Window.*\]/), "proxy.valueOf() returns the wrapped version");
      assert(window.valueOf({}).toString().match(/\[object Window.*\]/), "proxy.valueOf({}) returns the wrapped version");
      assert(window.valueOf(UNWRAP_ACCESS_KEY).toString().match(/\[object XrayWrapper \[object Window.*\].*\]/), "proxy.valueOf(UNWRAP_ACCESS_KEY) returns the unwrapped version");
      done();
    }
  );
}

exports.testXMLHttpRequest = function (test) {
  test.waitUntilDone();

  createWorker(test,
    'new ' + function ContentScriptScope() {
      // XMLHttpRequest doesn't support XMLHttpRequest.apply,
      // that may break our proxy code
      assert(window.XMLHttpRequest(), "we are able to instantiate XMLHttpRequest object");
      done();
    }
  );
}

exports.testXPathResult = function (test) {
  test.waitUntilDone();

  // Check XPathResult bug with constants being undefined on
  // XPCNativeWrapper
  let value =
    global.rawWindow.XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE;
  let xpcXPathResult = global.xrayWindow.XPathResult;
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

  let w = createWorker(test,
    'new ' + function ContentScriptScope() {
      self.port.on("value", function (value) {
        // Check that our work around is working:
        assert(window.XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE,
                         value, "XPathResult works correctly on Proxies");
        done();
      });
    }
  );
  w.port.emit("value", value);
}

exports.testPrototypeInheritance = function (test) {
  test.waitUntilDone();

  createWorker(test,
    'new ' + function ContentScriptScope() {
      // Verify that inherited prototype function like initEvent
      // are handled correctly. (e2.type will return an error if it's not the case)
      let event1 = document.createEvent( 'MouseEvents' );
      event1.initEvent( "click", true, true );
      let event2 = document.createEvent( 'MouseEvents' );
      event2.initEvent( "click", true, true );
      assert(event2.type == "click", "We are able to create an event");
      done();
    }
  );
}
exports.testFunctions = function (test) {
  test.waitUntilDone();

  global.rawWindow.callFunction = function (f) f();
  global.rawWindow.isEqual = function (a, b) a == b;
  createWorker(test,
    'new ' + function ContentScriptScope() {
      // Check basic usage of functions
      let closure2 = function () {return "ok";};
      assert(window.wrappedJSObject.callFunction(closure2) == "ok", "Function references work");

      // Ensure that functions are cached when being wrapped to native code
      let closure = function () {};
      assert(window.wrappedJSObject.isEqual(closure, closure), "Function references are cached before being wrapped to native");
      done();
    }
  );
}

exports.testListeners = function (test) {
  test.waitUntilDone();

  createWorker(test,
    'new ' + function ContentScriptScope() {
      // Verify listeners:
      let input = document.getElementById("input2");
      assert(input, "proxy.getElementById works");

      function onclick() {};
      input.onclick = onclick;
      assert(input.onclick === onclick, "on* attributes are equal to original function set");

      let addEventListenerCalled = false;
      let expandoCalled = false;
      input.addEventListener("click", function onclick(event) {
        input.removeEventListener("click", onclick, true);

        assert(!addEventListenerCalled, "closure given to addEventListener is called once");
        if (addEventListenerCalled)
          return;
        addEventListenerCalled = true;

        assert(!event.target.ownerDocument.defaultView.documentGlobal, "event object is still wrapped and doesn't expose document globals");
        assert("__isWrappedProxy" in event.target, "event object is a proxy");

        let input2 = document.getElementById("input2");

        input.onclick = function (event) {
          input.onclick = null;
          assert(!expandoCalled, "closure set to expando is called once");
          if (expandoCalled) return;
          expandoCalled = true;

          assert(!event.target.ownerDocument.defaultView.documentGlobal, "event object is still wrapped and doesn't expose document globals");
          assert("__isWrappedProxy" in event.target, "event object is a proxy");

          setTimeout(function () {
            input.click();
            done();
          }, 0);

        }

        setTimeout(function () {
          input.click();
        }, 0);

      }, true);

      input.click();
    }
  );
}

exports.testMozRequestAnimationFrame = function (test) {
  test.waitUntilDone();

  createWorker(test,
    'new ' + function ContentScriptScope() {
      window.mozRequestAnimationFrame(function callback() {
        assert(callback == this, "callback is equal to `this`");
        done();
      });
    }
  );
}


exports.testGlobalScope = function (test) {
  test.waitUntilDone();

  createWorker(test,
    'let toplevelScope = true;' +
    'assert(window.toplevelScope, "variables in toplevel scope are set to `window` object");' +
    'assert(this.toplevelScope, "variables in toplevel scope are set to `this` object");' +
    'done();'
  );
}

exports.removeTestDocument = function (test) {
  hiddenFrames.remove(global.hiddenFrame);
  test.pass("ok");
  test.done();
}
