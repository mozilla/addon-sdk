let tests = {}, Pages, Page;

const ERR_DESTROYED =
  "The page has been destroyed and can no longer be used.";

tests.testSimplePageCreation = function(test) {
  test.waitUntilDone();

  let page = new Page({
    contentScript: "self.postMessage(window.location.href)",
    contentScriptWhen: "end",
    onMessage: function (message) {
      test.assertEqual(message, "about:blank",
                       "Page Worker should start with a blank page by default");
      test.assertEqual(this, page, "The 'this' object is the page itself.");
      test.done();
    }
  });
}

/* 
 * Tests that we can't be tricked by document overloads as we have access 
 * to wrapped nodes 
 */
tests.testWrappedDOM = function(test) {
  test.waitUntilDone();

  let page = Page({
    allow: { script: true },
    contentURL: "data:text/html,<script>document.getElementById=3;window.scrollTo=3;</script>",
    contentScript: "window.addEventListener('load', function () " +
                   "self.postMessage([typeof(document.getElementById), " +
                   "typeof(window.scrollTo)]), true)",
    onMessage: function (message) {
      test.assertEqual(message[0],
                       "function",
                       "getElementById from content script is the native one");

      test.assertEqual(message[1],
                       "function",
                       "scrollTo from content script is the native one");

      test.done();
    }
  });
}

/*
// We do not offer unwrapped access to DOM since bug 601295 landed
// See 660780 to track progress of unwrap feature
tests.testUnwrappedDOM = function(test) {
  test.waitUntilDone();

  let page = Page({
    allow: { script: true },
    contentURL: "data:text/html,<script>document.getElementById=3;window.scrollTo=3;</script>",
    contentScript: "window.addEventListener('load', function () " +
                   "self.postMessage([typeof(unsafeWindow.document.getElementById), " +
                   "typeof(unsafeWindow.scrollTo)]), true)",
    onMessage: function (message) {
      test.assertEqual(message[0],
                       "number",
                       "document inside page is free to be changed");

      test.assertEqual(message[1],
                       "number",
                       "window inside page is free to be changed");

      test.done();
    }
  });
}
*/

tests.testPageProperties = function(test) {
  let page = new Page();

  for each (let prop in ['contentURL', 'allow', 'contentScriptFile',
                         'contentScript', 'contentScriptWhen', 'on',
                         'postMessage', 'removeListener']) {
    test.assert(prop in page, prop + " property is defined on page.");
  }

  test.assert(function () page.postMessage("foo") || true,
              "postMessage doesn't throw exception on page.");
}

tests.testConstructorAndDestructor = function(test) {
  test.waitUntilDone();

  let loader = test.makeSandboxedLoader();
  let Pages = loader.require("page-worker");
  let global = loader.findSandboxForModule("page-worker").globalScope;

  let pagesReady = 0;

  let page1 = Pages.Page({
    contentScript:      "self.postMessage('')",
    contentScriptWhen:  "end",
    onMessage:          pageReady
  });
  let page2 = Pages.Page({
    contentScript:      "self.postMessage('')",
    contentScriptWhen:  "end",
    onMessage:          pageReady
  });

  test.assertNotEqual(page1, page2,
                      "Page 1 and page 2 should be different objects.");

  function pageReady() {
    if (++pagesReady == 2) {
      page1.destroy();
      page2.destroy();

      test.assert(isDestroyed(page1), "page1 correctly unloaded.");
      test.assert(isDestroyed(page2), "page2 correctly unloaded.");

      loader.unload();
      test.done();
    }
  }
}

tests.testAutoDestructor = function(test) {
  test.waitUntilDone();

  let loader = test.makeSandboxedLoader();
  let Pages = loader.require("page-worker");

  let page = Pages.Page({
    contentScript: "self.postMessage('')",
    contentScriptWhen: "end",
    onMessage: function() {
      loader.unload();
      test.assert(isDestroyed(page), "Page correctly unloaded.");
      test.done();
    }
  });
}

tests.testValidateOptions = function(test) {
  test.assertRaises(
    function () Page({ contentURL: 'home' }),
    "The `contentURL` option must be a valid URL.",
    "Validation correctly denied a non-URL contentURL"
  );

  test.assertRaises(
    function () Page({ onMessage: "This is not a function."}),
    "The event listener must be a function.",
    "Validation correctly denied a non-function onMessage."
  );

  test.pass("Options validation is working.");
}

tests.testContentAndAllowGettersAndSetters = function(test) {
  test.waitUntilDone();
  let content = "data:text/html,<script>window.localStorage.allowScript=3;</script>";
  let page = Page({
    contentURL: content,
    contentScript: "self.postMessage(window.localStorage.allowScript)",
    contentScriptWhen: "end",
    onMessage: step0
  });

  function step0(message) {
    test.assertEqual(message, "3",
                     "Correct value expected for allowScript - 3");
    test.assertEqual(page.contentURL, content,
                     "Correct content expected");
    page.removeListener('message', step0);
    page.on('message', step1);
    page.allow = { script: false };
    page.contentURL = content = 
      "data:text/html,<script>window.localStorage.allowScript='f'</script>";
  }

  function step1(message) {
    test.assertEqual(message, "3",
                     "Correct value expected for allowScript - 3");
    test.assertEqual(page.contentURL, content, "Correct content expected");
    page.removeListener('message', step1);
    page.on('message', step2);
    page.allow = { script: true };
    page.contentURL = content =
      "data:text/html,<script>window.localStorage.allowScript='g'</script>";
  }

  function step2(message) {
    test.assertEqual(message, "g",
                     "Correct value expected for allowScript - g");
    test.assertEqual(page.contentURL, content, "Correct content expected");
    page.removeListener('message', step2);
    page.on('message', step3);
    page.allow.script = false;
    page.contentURL = content = 
      "data:text/html,<script>window.localStorage.allowScript=3</script>";
  }

  function step3(message) {
    test.assertEqual(message, "g",
                     "Correct value expected for allowScript - g");
    test.assertEqual(page.contentURL, content, "Correct content expected");
    page.removeListener('message', step3);
    page.on('message', step4);
    page.allow.script = true;
    page.contentURL = content = 
      "data:text/html,<script>window.localStorage.allowScript=4</script>";
  }

  function step4(message) {
    test.assertEqual(message, "4",
                     "Correct value expected for allowScript - 4");
    test.assertEqual(page.contentURL, content, "Correct content expected");
    test.done();
  }

}

tests.testOnMessageCallback = function(test) {
  test.waitUntilDone();

  Page({
    contentScript: "self.postMessage('')",
    contentScriptWhen: "end",
    onMessage: function() {
      test.pass("onMessage callback called");
      test.done();
    }
  });
}

tests.testMultipleOnMessageCallbacks = function(test) {
  test.waitUntilDone();

  let count = 0;
  let page = Page({
    contentScript: "self.postMessage('')",
    contentScriptWhen: "end",
    onMessage: function() count += 1
  });
  page.on('message', function() count += 2);
  page.on('message', function() count *= 3);
  page.on('message', function()
    test.assertEqual(count, 9, "All callbacks were called, in order."));
  page.on('message', function() test.done());

}

tests.testLoadContentPage = function(test) {

  test.waitUntilDone();

  let page = Page({
    onMessage: function(message) {
      // The message is an array whose first item is the test method to call
      // and the rest of whose items are arguments to pass it.
      test[message.shift()].apply(test, message);
    },
    contentURL: require("self").data.url("test-page-worker.html"),
    contentScriptFile: require("self").data.url("test-page-worker.js"),
    contentScriptWhen: "ready"
  });

}

tests.testAllowScriptDefault = function(test) {

  test.waitUntilDone();

  let page = Page({
    onMessage: function(message) {
      test.assert(message, "Script is allowed to run by default.");
      test.done();
    },
    contentURL: "data:text/html,<script>document.documentElement.setAttribute('foo', 3);</script>",
    contentScript: "self.postMessage(document.documentElement.getAttribute('foo'))",
    contentScriptWhen: "ready"
  });
}

tests.testAllowScript = function(test) {

  test.waitUntilDone();

  let page = Page({
    onMessage: function(message) {
      test.assert(message, "Script runs when allowed to do so.");
      test.done();
    },
    allow: { script: true },
    contentURL: "data:text/html,<script>document.documentElement.setAttribute('foo', 3);</script>",
    contentScript: "self.postMessage(document.documentElement.hasAttribute('foo') && " +
                   "                 document.documentElement.getAttribute('foo') == 3)",
    contentScriptWhen: "ready"
  });
}

tests.testPingPong = function(test) {
  test.waitUntilDone();
  let page = Page({
    contentURL: 'data:text/html,ping-pong',
    contentScript: 'self.on("message", function(message) self.postMessage("pong"));'
      + 'self.postMessage("ready");',
    onMessage: function(message) {
      if ('ready' == message) {
        return page.postMessage('ping');
      }
      else {
        test.assert(message, 'pong', 'Callback from contentScript');
        test.done();
      }
    }
  });
};

tests.testMultipleDestroys = function(test) {
  let page = Page();
  page.destroy();
  page.destroy();
  test.pass("Multiple destroys should not cause an error");
};


function isDestroyed(page) {
  try {
    page.postMessage("foo");
  }
  catch (err if err.message == ERR_DESTROYED) {
    return true;
  }
  return false;
}


let pageWorkerSupported = true;

try {
  Pages = require("page-worker");
  Page = Pages.Page;
}
catch (ex if ex.message == [
    "The page-worker module currently supports only Firefox and Thunderbird. ",
    "In the future, we would like it to support other applications, however. ",
    "Please see https://bugzilla.mozilla.org/show_bug.cgi?id=546740 for more ",
    "information."
  ].join("")) {
  pageWorkerSupported = false;
}

if (pageWorkerSupported) {
  for (let test in tests) {
    exports[test] = tests[test];
  }
} else {
  exports.testPageWorkerNotSupported = function(test) {
    test.pass("The page-worker module is not supported on this app.");
  }
}
