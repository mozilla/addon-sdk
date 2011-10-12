"use strict";

var pageMod = require("page-mod");
var testPageMod = require("pagemod-test-helpers").testPageMod;

/* XXX This can be used to delay closing the test Firefox instance for interactive
 * testing or visual inspection. This test is registered first so that it runs
 * the last. */
 /*
exports.delay = function(test) {
  if (false) {
    test.waitUntilDone(60000);
    require("timer").setTimeout(function() {test.done();}, 4000);
  } else
    test.pass();
}
*/
/* Tests for the PageMod APIs */

exports.testPageMod1 = function(test) {
  let mods = testPageMod(test, "data:text/html,<html><head><title>foo</title></head><body>foo</body></html>", [{
      include: /data:text\/html,.*/,
      contentScriptWhen: 'end',
      contentScript: 'new ' + function WorkerScope() {
        window.document.body.setAttribute("JEP-107", "worked");
        document.body.innerHTML += "fooooo";
      },
      onAttach: function() {
        test.assertEqual(this, mods[0], "The 'this' object is the page mod.");
      }
    }],
    function(evaluate, done) {
      evaluate('content.document.body.getAttribute("JEP-107")', function (attr) {
        test.assertEqual(
          attr,
          "worked",
          "PageMod.onReady test"
        );
        done();
      });
    }
  );
};

exports.testPageMod2 = function(test) {
  testPageMod(test, "about:", [{
      include: "about:*",
      contentScript: [
        'new ' + function contentScript() {
          window.AUQLUE = function() { return 42; }
          try {
            window.AUQLUE()
          }
          catch(e) {
            throw new Error("PageMod scripts executed in order");
          }
          document.documentElement.setAttribute("first", "true");
        },
        'new ' + function contentScript() {
          document.documentElement.setAttribute("second", "true");
        }
      ]
    }], function(evaluate, done) {
      evaluate('[content.document.documentElement.getAttribute("first"),'+
               'content.document.documentElement.getAttribute("second"),'+
               '"AUQLUE" in content]', function (list) {
        test.assertEqual(list[0],
                         "true",
                         "PageMod test #2: first script has run");
        test.assertEqual(list[1],
                         "true",
                         "PageMod test #2: second script has run");
        test.assertEqual(list[2], false,
                         "PageMod test #2: scripts get a wrapped window");
        done();
      });
    });
};

exports.testPageModIncludes = function(test) {
  var asserts = [];
  function createPageModTest(include, expectedMatch) {
    // Create an 'onload' test function...
    asserts.push({
      include: include,
      expectedMatch: expectedMatch
    });
    // ...and corresponding PageMod options
    return {
      include: include,
      contentScript: 'new ' + function() {
        self.on("message", function(msg) {
          window.localStorage[msg] = true;
        });
      },
      // The testPageMod callback with test assertions is called on 'end',
      // and we want this page mod to be attached before it gets called,
      // so we attach it on 'start'.
      contentScriptWhen: 'end',
      onAttach: function(worker) {
        worker.postMessage(this.include[0]);
      }
    };
  }

  testPageMod(test, "about:buildconfig", [
      createPageModTest("*", false),
      createPageModTest("*.google.com", false),
      createPageModTest("about:*", true),
      createPageModTest("about:", false),
      createPageModTest("about:buildconfig", true)
    ],
    function (evaluate, done) {
      let i = 0;
      function loop() {
        let assert = asserts[i++];
        if (!assert) {
          done();
          return;
        }
        evaluate("'" + assert.include + "' in content.wrappedJSObject.localStorage", 
          function (matches) {
            test.assert(assert.expectedMatch ? matches : !matches,
              "'" + assert.include + "' match test, expected: " + assert.expectedMatch);
            loop();
          });
      }
      loop();
    },
    undefined,
    2
    );
};

exports.testPageModErrorHandling = function(test) {
  test.assertRaises(function() {
      new pageMod.PageMod();
    },
    'pattern is undefined',
    "PageMod() throws when 'include' option is not specified.");
};


exports.testCommunication1 = function(test) {
  let workerDone = false,
      callbackDone = null,
      called = false;

  testPageMod(test, "about:", [{
      include: "about:",
      contentScriptWhen: 'end',
      contentScript: 'new ' + function WorkerScope() {
        self.on('message', function(msg) {
          document.body.setAttribute('JEP-107', 'worked');
          self.postMessage(document.body.getAttribute('JEP-107'));
        })
      },
      onAttach: function(worker) {
        worker.on('error', function(e) {
          test.fail('Errors where reported');
        });
        worker.on('message', function(value) {
          test.assert(
            !called,
            "We should receive only one message"
          );
          called = true;
          test.assertEqual(
            "worked",
            value,
            "test comunication"
          );
          workerDone = true;
          if (callbackDone)
            callbackDone();
        });
        worker.postMessage('do it!')
      }
    }],
    function (evaluate, done) {
      (callbackDone = function() {
        if (workerDone) {
          evaluate("content.document.body.getAttribute('JEP-107')", 
                   function (attr) {
                     test.assertEqual(
                       'worked',
                       attr,
                       'attribute should be modified'
                     );
                     done();
                   });
        }
      })();
    }
  );
};

exports.testCommunication2 = function(test) {
  let callbackDone = null,
      evaluate;

  testPageMod(test, "about:", [{
      include: "about:*",
      contentScriptWhen: 'start',
      contentScript: 'new ' + function WorkerScope() {
        document.documentElement.setAttribute('AUQLUE', 42);
        window.addEventListener('load', function listener() {
          self.postMessage('onload');
        }, false);
        self.on("message", function() {
          self.postMessage(document.documentElement.getAttribute("test"))
        });
      },
      onAttach: function(worker) {
        worker.on('error', function(e) {
          test.fail('Errors where reported');
        });
        worker.on('message', function(msg) {
          if ('onload' == msg) {
            let get = "content.document.documentElement.getAttribute('AUQLUE')";
            let set = "content.document.documentElement.setAttribute('test', " +
                      "'changes in window')";
            evaluate(get,
                     function (attr) {
                       test.assertEqual(
                         '42',
                         attr,
                         'PageMod scripts executed in order'
                       );
                       evaluate(set,
                                function () {
                                  worker.postMessage('get window.test')
                                });
                     });
          } else {
            test.assertEqual(
              'changes in window',
              msg,
              'PageMod test #2: second script has run'
            )
            callbackDone();
          }
        });
      }
    }],
    function (aEvaluate, done) {
      evaluate = aEvaluate;
      callbackDone = done;
    }
  );

};

exports.testEventEmitter = function(test) {
  let workerDone = false,
      callbackDone = null;

  testPageMod(test, "about:", [{
      include: "about:*",
      contentScript: 'new ' + function WorkerScope() {
        self.port.on('addon-to-content', function(data) {
          self.port.emit('content-to-addon', data);
        });
      },
      onAttach: function(worker) {
        worker.on('error', function(e) {
          test.fail('Errors were reported : '+e);
        });
        worker.port.on('content-to-addon', function(value) {
          test.assertEqual(
            "worked",
            value,
            "EventEmitter API works!"
          );
          if (callbackDone)
            callbackDone();
          else
            workerDone = true;
        });
        worker.port.emit('addon-to-content', 'worked');
      }
    }],
    function(evaluate, done) {
      if (workerDone)
        done();
      else
        callbackDone = done;
    }
  );
};

exports.testHistory = function(test) {
  // We need a valid url in order to have a working History API.
  // (i.e do not work on data: or about: pages)
  // Test bug 679054.
  let url = require("self").data.url("test-page-mod.html");
  let callbackDone = null, alreadyDone = false;
  testPageMod(test, url, [{
      include: url,
      contentScriptWhen: 'end',
      contentScript: 'new ' + function WorkerScope() {
        history.pushState({}, "", "#");
        history.replaceState({foo: "bar"}, "", "#");
        self.postMessage(history.state);
      },
      onAttach: function(worker) {
        worker.on('message', function (data) {
          test.assertEqual(JSON.stringify(data), JSON.stringify({foo: "bar"}),
                           "History API works!");
          if (callbackDone)
            callbackDone();
          else
            alreadyDone = true;
        });
      }
    }],
    function(evaluate, done) {
      if (alreadyDone)
        done();
      else
        callbackDone = done;
    }
  );
};
/*
exports.testRelatedTab = function(test) {
  test.waitUntilDone();

  let tabs = require("tabs");
  let tab;
  let pageMod = new require("page-mod").PageMod({
    include: "about:*",
    onAttach: function(worker) {
      test.assertEqual(tab, worker.tab, "Worker.tab is valid");
      pageMod.destroy();
      tab.close();
      test.done();
    }
  });

  tabs.open({
    url: "about:",
    onOpen: function onOpen(t) {
      tab = t;
    }
  });

};

exports['test tab worker on message'] = function(test) {
  test.waitUntilDone();

  let { browserWindows } = require("windows");
  let tabs = require("tabs");
  let { PageMod } = require("page-mod");

  let url1 = "data:text/html,<title>tab1</title><h1>worker1.tab</h1>";
  let url2 = "data:text/html,<title>tab2</title><h1>worker2.tab</h1>";
  let worker1 = null;

  let mod = PageMod({
    include: "data:text/html,*",
    contentScriptWhen: "ready",
    contentScript: "self.postMessage('#1');",
    onAttach: function onAttach(worker) {
      worker.on("message", function onMessage() {
        this.tab.attach({
          contentScriptWhen: "ready",
          contentScript: "self.postMessage({ url: window.location.href, title: document.title });",
          onMessage: function onMessage(data) {
            test.assertEqual(this.tab.url, data.url, "location is correct");
            test.assertEqual(this.tab.title, data.title, "title is correct");
            if (this.tab.url === url1) {
              worker1 = this;
              tabs.open({ url: url2, inBackground: true });
            }
            else if (this.tab.url === url2) {
              mod.destroy();
              worker1.tab.close();
              worker1.destroy();
              worker.tab.close();
              worker.destroy();
              test.done();
            }
          }
        });
      });
    }
  });

  tabs.open(url1);
};

exports.testAutomaticDestroy = function(test) {
  test.waitUntilDone();
  let loader = test.makeSandboxedLoader();
  
  let pageMod = loader.require("page-mod").PageMod({
    include: "about:*",
    contentScriptWhen: "start",
    onAttach: function(w) {
      test.fail("Page-mod should have been detroyed during module unload");
    }
  });
  
  // Unload the page-mod module so that our page mod is destroyed
  loader.unload();
 
  // Then create a second tab to ensure that it is correctly destroyed
  let tabs = require("tabs");
  tabs.open({
    url: "about:",
    onReady: function onReady(tab) {
      test.pass("check automatic destroy");
      tab.close();
      test.done();
    }
  });
  
}
*/