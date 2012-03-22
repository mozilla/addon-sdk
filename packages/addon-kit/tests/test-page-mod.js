/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var pageMod = require("page-mod");
var testPageMod = require("pagemod-test-helpers").testPageMod;
const { Loader } = require('./helpers');
const tabs = require("tabs");

/* XXX This can be used to delay closing the test Firefox instance for interactive
 * testing or visual inspection. This test is registered first so that it runs
 * the last. */
exports.delay = function(test) {
  if (false) {
    test.waitUntilDone(60000);
    require("timer").setTimeout(function() {test.done();}, 4000);
  } else
    test.pass();
}

/* Tests for the PageMod APIs */

exports.testPageMod1 = function(test) {
  let mods = testPageMod(test, "about:", [{
      include: /about:/,
      contentScriptWhen: 'end',
      contentScript: 'new ' + function WorkerScope() {
        window.document.body.setAttribute("JEP-107", "worked");
      },
      onAttach: function() {
        test.assertEqual(this, mods[0], "The 'this' object is the page mod.");
      }
    }],
    function(win, done) {
      test.assertEqual(
        win.document.body.getAttribute("JEP-107"),
        "worked",
        "PageMod.onReady test"
      );
      done();
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
    }], function(win, done) {
      test.assertEqual(win.document.documentElement.getAttribute("first"),
                       "true",
                       "PageMod test #2: first script has run");
      test.assertEqual(win.document.documentElement.getAttribute("second"),
                       "true",
                       "PageMod test #2: second script has run");
      test.assertEqual("AUQLUE" in win, false,
                       "PageMod test #2: scripts get a wrapped window");
      done();
    });
};

exports.testPageModIncludes = function(test) {
  var asserts = [];
  function createPageModTest(include, expectedMatch) {
    // Create an 'onload' test function...
    asserts.push(function(test, win) {
      var matches = include in win.localStorage;
      test.assert(expectedMatch ? matches : !matches,
                  "'" + include + "' match test, expected: " + expectedMatch);
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
      contentScriptWhen: 'start',
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
    function (win, done) {
      test.waitUntil(function () win.localStorage["about:buildconfig"],
                     "about:buildconfig page-mod to be executed")
          .then(function () {
            asserts.forEach(function(fn) {
              fn(test, win);
            });
            done();
          });
    }
    );
};

exports.testPageModErrorHandling = function(test) {
  test.assertRaises(function() {
      new pageMod.PageMod();
    },
    'pattern is undefined',
    "PageMod() throws when 'include' option is not specified.");
};

/* Tests for internal functions. */
exports.testCommunication1 = function(test) {
  let workerDone = false,
      callbackDone = null;

  testPageMod(test, "about:", [{
      include: "about:*",
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
    function(win, done) {
      (callbackDone = function() {
        if (workerDone) {
          test.assertEqual(
            'worked',
            win.document.body.getAttribute('JEP-107'),
            'attribute should be modified'
          );
          done();
        }
      })();
    }
  );
};

exports.testCommunication2 = function(test) {
  let callbackDone = null,
      window;

  testPageMod(test, "about:credits", [{
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
            test.assertEqual(
              '42',
              window.document.documentElement.getAttribute('AUQLUE'),
              'PageMod scripts executed in order'
            );
            window.document.documentElement.setAttribute('test', 'changes in window');
            worker.postMessage('get window.test')
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
    function(win, done) {
      window = win;
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
    function(win, done) {
      if (workerDone)
        done();
      else
        callbackDone = done;
    }
  );
};

// Execute two concurrent page mods on same document to ensure that their
// JS contexts are different
exports.testMixedContext = function(test) {
  let doneCallback = null;
  let messages = 0;
  let modObject = {
    include: "data:text/html,",
    contentScript: 'new ' + function WorkerScope() {
      // Both scripts will execute this,
      // context is shared if one script see the other one modification.
      let isContextShared = "sharedAttribute" in document;
      self.postMessage(isContextShared);
      document.sharedAttribute = true;
    },
    onAttach: function(w) {
      w.on("message", function (isContextShared) {
        if (isContextShared) {
          test.fail("Page mod contexts are mixed.");
          doneCallback();
        }
        else if (++messages == 2) {
          test.pass("Page mod contexts are different.");
          doneCallback();
        }
      });
    }
  };
  testPageMod(test, "data:text/html,", [modObject, modObject],
    function(win, done) {
      doneCallback = done;
    }
  );
};

exports.testHistory = function(test) {
  // We need a valid url in order to have a working History API.
  // (i.e do not work on data: or about: pages)
  // Test bug 679054.
  let url = require("self").data.url("test-page-mod.html");
  let callbackDone = null;
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
          callbackDone();
        });
      }
    }],
    function(win, done) {
      callbackDone = done;
    }
  );
};

exports.testRelatedTab = function(test) {
  test.waitUntilDone();

  let tab;
  let { PageMod } = require("page-mod");
  let pageMod = new PageMod({
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
  let loader = Loader(module);

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

exports.testPageModCss = function(test) {
  let [pageMod] = testPageMod(test,
    'data:text/html,<div style="background: silver">css test</div>', [{
      include: "data:*",
      contentStyle: "div { height: 100px; }",
      contentStyleFile:
        require("self").data.url("pagemod-css-include-file.css")
    }],
    function(win, done) {
      let div = win.document.querySelector("div");
      test.assertEqual(
        div.clientHeight,
        100,
        "PageMod contentStyle worked"
      );
      test.assertEqual(
       div.offsetHeight,
        120,
        "PageMod contentStyleFile worked"
      );
      done();
    }
  );
};

exports.testPageModCssList = function(test) {
  let [pageMod] = testPageMod(test,
    'data:text/html,<div style="width:320px; max-width: 480px!important">css test</div>', [{
      include: "data:*",
      contentStyleFile: [
        // Highlight evaluation order in this list
        "data:text/css,div { border: 1px solid black; }",
        "data:text/css,div { border: 10px solid black; }",
        // Highlight evaluation order between contentStylesheet & contentStylesheetFile
        "data:text/css,div { height: 1000px; }",
        // Highlight precedence between the author and user style sheet
        "data:text/css,div { width: 200px; max-width: 640px!important}",
      ],
      contentStyle: [
        "div { height: 10px; }",
        "div { height: 100px; }"
      ]
    }],
    function(win, done) {
      let div = win.document.querySelector("div"),
          style = win.getComputedStyle(div);

      test.assertEqual(
       div.clientHeight,
        100,
        "PageMod contentStyle list works and is evaluated after contentStyleFile"
      );

      test.assertEqual(
        div.offsetHeight,
        120,
        "PageMod contentStyleFile list works"
      );

      test.assertEqual(
        style.width,
        "320px",
        "PageMod author/user style sheet precedence works"
      );

      test.assertEqual(
        style.maxWidth,
        "640px",
        "PageMod author/user style sheet precedence with !important works"
      );

      done();
    }
  );
};

exports.testPageModCssDestroy = function(test) {
  let [pageMod] = testPageMod(test,
    'data:text/html,<div style="width:200px">css test</div>', [{
      include: "data:*",
      contentStyle: "div { width: 100px!important; }"
    }],

    function(win, done) {
      let div = win.document.querySelector("div"),
          style = win.getComputedStyle(div);

      test.assertEqual(
        style.width,
        "100px",
        "PageMod contentStyle worked"
      );

      pageMod.destroy();
      test.assertEqual(
        style.width,
        "200px",
        "PageMod contentStyle is removed after destroy"
      );

      done();

    }
  );
};
