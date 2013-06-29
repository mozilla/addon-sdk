/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { Cu } = require('chrome');
const { Loader } = require('sdk/test/loader');
const { show, hide } = require('sdk/ui/sidebar/actions');
const { isShowing } = require('sdk/ui/sidebar/utils');
const { getMostRecentBrowserWindow, isWindowPrivate } = require('sdk/window/utils');
const { open, close, focus, promise: windowPromise } = require('sdk/window/helpers');
const { setTimeout } = require('sdk/timers');
const { isPrivate } = require('sdk/private-browsing');
const { data } = require('sdk/self');
const { fromIterator } = require('sdk/util/array');
const { URL } = require('sdk/url');

const { CustomizableUI } = Cu.import('resource:///modules/CustomizableUI.jsm', {});

const BUILTIN_SIDEBAR_MENUITEMS = [
  'menu_socialSidebar',
  'menu_historySidebar',
  'menu_bookmarksSidebar'
];

const BLANK_IMG = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

function isSidebarShowing(window) {
  window = window || getMostRecentBrowserWindow();
  let sidebar = window.document.getElementById('sidebar-box');
  return !sidebar.hidden;
}

function getSidebarMenuitems(window) {
  window = window || getMostRecentBrowserWindow();
  return fromIterator(window.document.querySelectorAll('#viewSidebarMenu menuitem'));
}

function getExtraSidebarMenuitems() {
  let menuitems = getSidebarMenuitems();
  return menuitems.filter(function(mi) {
    return BUILTIN_SIDEBAR_MENUITEMS.indexOf(mi.getAttribute('id')) < 0;
  });
}

function makeID(id) {
  return 'jetpack-sidebar-' + id;
}

function simulateCommand(ele) {
  let window = ele.ownerDocument.defaultView;
  let { document } = window;
  var evt = document.createEvent('XULCommandEvent');
  evt.initCommandEvent('command', true, true, window,
    0, false, false, false, false, null);
  ele.dispatchEvent(evt);
}
function simulateClick(ele) {
  let window = ele.ownerDocument.defaultView;
  let { document } = window;
  let evt = document.createEvent('MouseEvents');
  evt.initMouseEvent('click', true, true, window,
    0, 0, 0, 0, 0, false, false, false, false, 0, null);
  ele.dispatchEvent(evt);
}

function getWidget(buttonId, window = getMostRecentBrowserWindow()) {
  const { AREA_NAVBAR } = CustomizableUI;

  let widgets = CustomizableUI.getWidgetsInArea(AREA_NAVBAR).
    filter(({id}) => id.startsWith('button--') && id.endsWith(buttonId));

  if (widgets.length === 0)
    throw new Error('Widget with id `' + buttonId +'` not found.');

  if (widgets.length > 1)
    throw new Error('Unexpected number of widgets: ' + widgets.length)

  return widgets[0].forWindow(window);
};

exports.testSidebarBasicLifeCycle = function(assert, done) {
  const { Sidebar } = require('sdk/ui/sidebar');
  let testName = 'testSidebarBasicLifeCycle';
  let window = getMostRecentBrowserWindow();
  assert.ok(!window.document.getElementById(makeID(testName)), 'sidebar id DNE');
  let sidebarXUL = window.document.getElementById('sidebar');
  assert.ok(sidebarXUL, 'sidebar xul element does exist');
  assert.ok(!getExtraSidebarMenuitems().length, 'there are no extra sidebar menuitems');

  assert.equal(isSidebarShowing(window), false, 'sidebar is not showing 1');
  let sidebarDetails = {
    id: testName,
    title: 'test',
    icon: BLANK_IMG,
    url: 'data:text/html;charset=utf-8,'+testName
  };
  let sidebar = Sidebar(sidebarDetails);

  // test the sidebar attributes
  for each(let key in Object.keys(sidebarDetails)) {
    if (key == 'icon')
      continue;
    assert.equal(sidebarDetails[key], sidebar[key], 'the attributes match the input');
  }

  assert.pass('The Sidebar constructor worked');

  let extraMenuitems = getExtraSidebarMenuitems();
  assert.equal(extraMenuitems.length, 1, 'there is one extra sidebar menuitems');

  let ele = window.document.getElementById(makeID(testName));
  assert.equal(ele, extraMenuitems[0], 'the only extra menuitem is the one for our sidebar.')
  assert.ok(ele, 'sidebar element was added');
  assert.ok(ele.getAttribute('checked'), 'false', 'the sidebar is not displayed');
  assert.equal(ele.getAttribute('label'), sidebar.title, 'the sidebar title is the menuitem label')

  assert.equal(isSidebarShowing(window), false, 'sidebar is not showing 2');
  sidebar.on('show', function() {
    assert.pass('the show event was fired');
    assert.equal(isSidebarShowing(window), true, 'sidebar is not showing 3');
    assert.equal(isShowing(sidebar), true, 'the sidebar is showing');
    assert.equal(ele.getAttribute('checked'), 'true', 'the sidebar is displayed');

    sidebar.once('hide', function() {
      assert.pass('the hide event was fired');
      assert.equal(ele.getAttribute('checked'), 'false', 'the sidebar menuitem is not checked');
      assert.equal(isShowing(sidebar), false, 'the sidebar is not showing');
      assert.equal(isSidebarShowing(window), false, 'the sidebar elemnt is hidden');

      sidebar.once('detach', function() {
        sidebar.destroy();

        let sidebarMI = getSidebarMenuitems();
        for each (let mi in sidebarMI) {
          assert.ok(BUILTIN_SIDEBAR_MENUITEMS.indexOf(mi.getAttribute('id')) >= 0, 'the menuitem is for a built-in sidebar')
          assert.equal(mi.getAttribute('checked'), "false", 'no sidebar menuitem is checked');
        }

        assert.ok(!window.document.getElementById(makeID(testName)), 'sidebar id DNE');
        assert.pass('calling destroy worked without error');

        done();
      });
    });

    sidebar.hide();
    assert.pass('hiding sidebar..');
  });

  sidebar.show();
  assert.pass('showing sidebar..');
}

exports.testSideBarIsInNewWindows = function(assert, done) {
  const { Sidebar } = require('sdk/ui/sidebar');
  let testName = 'testSideBarOnNewWindow';
  let sidebar = Sidebar({
    id: testName,
    title: testName,
    icon: BLANK_IMG,
    url: 'data:text/html;charset=utf-8,'+testName
  });

  let startWindow = getMostRecentBrowserWindow();
  let ele = startWindow.document.getElementById(makeID(testName));
  assert.ok(ele, 'sidebar element was added');

  open().then(function(window) {
      let ele = window.document.getElementById(makeID(testName));
      assert.ok(ele, 'sidebar element was added');

      sidebar.destroy();
      assert.ok(!window.document.getElementById(makeID(testName)), 'sidebar id DNE');
      assert.ok(!startWindow.document.getElementById(makeID(testName)), 'sidebar id DNE');

      close(window).then(done, assert.fail);
  })
}


exports.testSideBarIsNotInNewPrivateWindows = function(assert, done) {
  const { Sidebar } = require('sdk/ui/sidebar');
  let testName = 'testSideBarOnNewWindow';
  let sidebar = Sidebar({
    id: testName,
    title: testName,
    icon: BLANK_IMG,
    url: 'data:text/html;charset=utf-8,'+testName
  });

  let startWindow = getMostRecentBrowserWindow();
  let ele = startWindow.document.getElementById(makeID(testName));
  assert.ok(ele, 'sidebar element was added');

  open(null, { features: { private: true } }).then(function(window) {
      let ele = window.document.getElementById(makeID(testName));
      assert.ok(isPrivate(window), 'the new window is private');
      assert.equal(ele, null, 'sidebar element was not added');

      sidebar.destroy();
      assert.ok(!window.document.getElementById(makeID(testName)), 'sidebar id DNE');
      assert.ok(!startWindow.document.getElementById(makeID(testName)), 'sidebar id DNE');

      close(window).then(done, assert.fail);
  })
}

exports.testSideBarIsShowingInNewWindows = function(assert, done) {
  const { Sidebar } = require('sdk/ui/sidebar');
  let testName = 'testSideBarIsShowingInNewWindows';
  let sidebar = Sidebar({
    id: testName,
    title: testName,
    icon: BLANK_IMG,
    url: URL('data:text/html;charset=utf-8,'+testName)
  });

  let startWindow = getMostRecentBrowserWindow();
  let ele = startWindow.document.getElementById(makeID(testName));
  assert.ok(ele, 'sidebar element was added');

  let oldEle = ele;
  sidebar.once('attach', function() {
    assert.pass('attach event fired');

    sidebar.once('show', function() {
      assert.pass('show event fired');

      sidebar.once('show', function() {
        let window = getMostRecentBrowserWindow();
        assert.notEqual(startWindow, window, 'window is new');

        let sb = window.document.getElementById('sidebar');
        if (sb && sb.docShell && sb.contentDocument && sb.contentDocument.getElementById('web-panels-browser')) {
          end();
        }
        else {
          sb.addEventListener('DOMWindowCreated', end, false);
        }

        function end() {
          sb.removeEventListener('DOMWindowCreated', end, false);
          let webPanelBrowser = sb.contentDocument.getElementById('web-panels-browser');

          let ele = window.document.getElementById(makeID(testName));

          assert.ok(ele, 'sidebar element was added 2');
          assert.equal(ele.getAttribute('checked'), 'true', 'the sidebar is checked');
          assert.notEqual(ele, oldEle, 'there are two different sidebars');

          assert.equal(isShowing(sidebar), true, 'the sidebar is showing in new window');


            sidebar.destroy();

            assert.equal(isShowing(sidebar), false, 'the sidebar is not showing');
            assert.ok(!isSidebarShowing(window), 'sidebar in most recent window is not showing');
            assert.ok(!isSidebarShowing(startWindow), 'sidebar in most start window is not showing');
            assert.ok(!window.document.getElementById(makeID(testName)), 'sidebar id DNE');
            assert.ok(!startWindow.document.getElementById(makeID(testName)), 'sidebar id DNE');

            setTimeout(function() {
              close(window).then(done, assert.fail);
            });
        }
      });

      startWindow.OpenBrowserWindow();
    });
  });

  show(sidebar);
  assert.pass('showing the sidebar');
}

exports.testAddonGlobalSimple = function(assert, done) {
  const { Sidebar } = require('sdk/ui/sidebar');
  let testName = 'testAddonGlobal';
  let sidebar = Sidebar({
    id: testName,
    title: testName,
    icon: BLANK_IMG,
    url: data.url('test-sidebar-addon-global.html')
  });

  sidebar.on('show', function({worker}) {
    assert.pass('sidebar was attached');
    assert.ok(!!worker, 'attach event has worker');

    worker.port.on('X', function(msg) {
      assert.equal(msg, '23', 'the final message is correct');

      sidebar.destroy();

      done();
    });
    worker.port.emit('X', '2');
  });
  show(sidebar);
}

exports.testAddonGlobalComplex = function(assert, done) {
  const { Sidebar } = require('sdk/ui/sidebar');
  let testName = 'testAddonGlobal';
  let sidebar = Sidebar({
    id: testName,
    title: testName,
    icon: BLANK_IMG,
    url: data.url('test-sidebar-addon-global.html')
  });

  sidebar.on('attach', function(worker) {
    assert.pass('sidebar was attached');
    assert.ok(!!worker, 'attach event has worker');

    worker.port.once('Y', function(msg) {
      assert.equal(msg, '1', 'got event from worker');

      worker.port.on('X', function(msg) {
        assert.equal(msg, '123', 'the final message is correct');

        sidebar.destroy();

        done();
      });
      worker.port.emit('X', msg + '2');
    })
  });

  show(sidebar);
}

exports.testShowingOneSidebarAfterAnother = function(assert, done) {
  const { Sidebar } = require('sdk/ui/sidebar');
  let testName = 'testShowingOneSidebarAfterAnother';

  let sidebar1 = Sidebar({
    id: testName + '1',
    title: testName + '1',
    icon: BLANK_IMG,
    url:  'data:text/html;charset=utf-8,'+ testName + 1
  });
  let sidebar2 = Sidebar({
    id: testName + '2',
    title: testName + '2',
    icon: BLANK_IMG,
    url:  'data:text/html;charset=utf-8,'+ testName + 2
  });

  let window = getMostRecentBrowserWindow();
  let IDs = [ sidebar1.id, sidebar2.id ];

  let extraMenuitems = getExtraSidebarMenuitems(window);
  assert.equal(extraMenuitems.length, 2, 'there are two extra sidebar menuitems');

  function testShowing(sb1, sb2, sbEle) {
    assert.equal(isShowing(sidebar1), sb1);
    assert.equal(isShowing(sidebar2), sb2);
    assert.equal(isSidebarShowing(window), sbEle);
  }
  testShowing(false, false, false);

  sidebar1.once('show', function() {
    testShowing(true, false, true);
    for each (let mi in getExtraSidebarMenuitems(window)) {
      let menuitemID = mi.getAttribute('id').replace(/^jetpack-sidebar-/, '');
      assert.ok(IDs.indexOf(menuitemID) >= 0, 'the extra menuitem is for one of our test sidebars');
      assert.equal(mi.getAttribute('checked'), menuitemID == sidebar1.id ? 'true' : 'false', 'the test sidebar menuitem has the correct checked value');
    }

    sidebar2.once('show', function() {
      testShowing(false, true, true);
      for each (let mi in getExtraSidebarMenuitems(window)) {
        let menuitemID = mi.getAttribute('id').replace(/^jetpack-sidebar-/, '');
        assert.ok(IDs.indexOf(menuitemID) >= 0, 'the extra menuitem is for one of our test sidebars');
        assert.equal(mi.getAttribute('checked'), menuitemID == sidebar2.id ? 'true' : 'false', 'the test sidebar menuitem has the correct checked value');
      }

      sidebar1.destroy();
      sidebar2.destroy();

      testShowing(false, false, false);

      done();
    });

    show(sidebar2);
    assert.pass('showing sidebar 2');
  })
  show(sidebar1);
  assert.pass('showing sidebar 1');
}

exports.testSidebarUnload = function(assert, done) {
  const { Sidebar } = require('sdk/ui/sidebar');
  let loader = Loader(module);

  let testName = 'testSidebarUnload';
  let window = getMostRecentBrowserWindow();

  assert.equal(isPrivate(window), false, 'the current window is not private');

  // EXPLICIT: testing require('sdk/ui')
  let sidebar = loader.require('sdk/ui').Sidebar({
    id: testName,
    title: testName,
    icon: BLANK_IMG,
    url:  'data:text/html;charset=utf-8,'+ testName,
    onShow: function() {
      assert.pass('onShow works for Sidebar');
      loader.unload();

      let sidebarMI = getSidebarMenuitems();
      for each (let mi in sidebarMI) {
        assert.ok(BUILTIN_SIDEBAR_MENUITEMS.indexOf(mi.getAttribute('id')) >= 0, 'the menuitem is for a built-in sidebar')
        assert.equal(mi.getAttribute('checked'), 'false', 'no sidebar menuitem is checked');
      }
      assert.ok(!window.document.getElementById(makeID(testName)), 'sidebar id DNE');
      assert.equal(isSidebarShowing(window), false, 'the sidebar is not showing');

      done();
    }
  })

  sidebar.show();
  assert.pass('showing the sidebar');
}

exports.testRemoteContent = function(assert) {
  const { Sidebar } = require('sdk/ui/sidebar');
  let testName = 'testRemoteContent';
  try {
    let sidebar = Sidebar({
      id: testName,
      title: testName,
      icon: BLANK_IMG,
      url: 'http://dne.xyz.mozilla.org'
    });
    assert.fail('a bad sidebar was created..');
    sidebar.destroy();
  }
  catch(e) {
    assert.ok(/The option "url" must be a valid URI./.test(e), 'remote content is not acceptable');
  }
}

exports.testInvalidURL = function(assert) {
  const { Sidebar } = require('sdk/ui/sidebar');
  let testName = 'testInvalidURL';
  try {
    let sidebar = Sidebar({
      id: testName,
      title: testName,
      icon: BLANK_IMG,
      url: 'http:mozilla.org'
    });
    assert.fail('a bad sidebar was created..');
    sidebar.destroy();
  }
  catch(e) {
    assert.ok(/The option "url" must be a valid URI./.test(e), 'invalid URIs are not acceptable');
  }
}

exports.testInvalidURLType = function(assert) {
  const { Sidebar } = require('sdk/ui/sidebar');
  let testName = 'testInvalidURLType';
  try {
    let sidebar = Sidebar({
      id: testName,
      title: testName,
      icon: BLANK_IMG
    });
    assert.fail('a bad sidebar was created..');
    sidebar.destroy();
  }
  catch(e) {
    assert.ok(/The option "url" must be a valid URI./.test(e), 'invalid URIs are not acceptable');
  }
}

exports.testInvalidTitle = function(assert) {
  const { Sidebar } = require('sdk/ui/sidebar');
  let testName = 'testInvalidTitle';
  try {
    let sidebar = Sidebar({
      id: testName,
      title: '',
      icon: BLANK_IMG,
      url: 'data:text/html;charset=utf-8,'+testName
    });
    assert.fail('a bad sidebar was created..');
    sidebar.destroy();
  }
  catch(e) {
    assert.equal('The option "title" must be one of the following types: string', e.message, 'invalid titles are not acceptable');
  }
}

exports.testInvalidIcon = function(assert) {
  const { Sidebar } = require('sdk/ui/sidebar');
  let testName = 'testInvalidTitle';
  try {
    let sidebar = Sidebar({
      id: testName,
      title: testName,
      url: 'data:text/html;charset=utf-8,'+testName
    });
    assert.fail('a bad sidebar was created..');
    sidebar.destroy();
  }
  catch(e) {
    assert.ok(/The option "icon" must be a local URL or an object with/.test(e), 'invalid icons are not acceptable');
  }
}

exports.testInvalidID = function(assert) {
  const { Sidebar } = require('sdk/ui/sidebar');
  let testName = 'testInvalidID';
  try {
    let sidebar = Sidebar({
      id: '!',
      title: testName,
      icon: BLANK_IMG,
      url: 'data:text/html;charset=utf-8,'+testName
    });
    assert.fail('a bad sidebar was created..');
    sidebar.destroy();
  }
  catch(e) {
    assert.ok(/The option "id" must be a valid alphanumeric id/.test(e), 'invalid ids are not acceptable');
  }
}

/*
exports.testSidebarIsNotOpenInNewPrivateWindow = function(assert, done) {
  let testName = 'testSidebarIsNotOpenInNewPrivateWindow';
  let window = getMostRecentBrowserWindow();

    let sidebar = Sidebar({
      id: testName,
      title: testName,
      icon: BLANK_IMG,
      url: 'data:text/html;charset=utf-8,'+testName
    });
   
    sidebar.on('show', function() {
      assert.equal(isPrivate(window), false, 'the new window is not private');
      assert.equal(isSidebarShowing(window), true, 'the sidebar is showing');
      assert.equal(isShowing(sidebar), true, 'the sidebar is showing');

      let window2 = window.OpenBrowserWindow({private: true});
      windowPromise(window2, 'load').then(focus).then(function() {
        // TODO: find better alt to setTimeout...
        setTimeout(function() {
          assert.equal(isPrivate(window2), true, 'the new window is private');
          assert.equal(isSidebarShowing(window), true, 'the sidebar is showing in old window still');
          assert.equal(isSidebarShowing(window2), false, 'the sidebar is not showing in the new private window');
          assert.equal(isShowing(sidebar), false, 'the sidebar is not showing');
          sidebar.destroy();
          close(window2).then(done);
        }, 500)
      })
    });

    sidebar.show();
}
*/

// TEST: edge case where web panel is destroyed while loading
exports.testDestroyEdgeCaseBug = function(assert, done) {
  const { Sidebar } = require('sdk/ui/sidebar');
  let testName = 'testDestroyEdgeCaseBug';
  let window = getMostRecentBrowserWindow();
  let sidebar = Sidebar({
    id: testName,
    title: testName,
    icon: BLANK_IMG,
    url: 'data:text/html;charset=utf-8,'+testName
  });

  // NOTE: purposely not listening to show event b/c the event happens
  //       between now and then.
  sidebar.show();

  assert.equal(isPrivate(window), false, 'the new window is not private');
  assert.equal(isSidebarShowing(window), true, 'the sidebar is showing');

  //assert.equal(isShowing(sidebar), true, 'the sidebar is showing');

  open(null, { features: { private: true } }).then(focus).then(function(window2) {
    assert.equal(isPrivate(window2), true, 'the new window is private');
    assert.equal(isSidebarShowing(window2), false, 'the sidebar is not showing');
    assert.equal(isShowing(sidebar), false, 'the sidebar is not showing');

    sidebar.destroy();
    assert.pass('destroying the sidebar');

    close(window2).then(function() {
      let loader = Loader(module);

      assert.equal(isPrivate(window), false, 'the current window is not private');

      let sidebar = loader.require('sdk/ui/sidebar').Sidebar({
        id: testName,
        title: testName,
        icon: BLANK_IMG,
        url:  'data:text/html;charset=utf-8,'+ testName,
        onShow: function() {
          assert.pass('onShow works for Sidebar');
          loader.unload();

          let sidebarMI = getSidebarMenuitems();
          for each (let mi in sidebarMI) {
            assert.ok(BUILTIN_SIDEBAR_MENUITEMS.indexOf(mi.getAttribute('id')) >= 0, 'the menuitem is for a built-in sidebar')
            assert.equal(mi.getAttribute('checked'), 'false', 'no sidebar menuitem is checked');
          }
          assert.ok(!window.document.getElementById(makeID(testName)), 'sidebar id DNE');
          assert.equal(isSidebarShowing(window), false, 'the sidebar is not showing');

          done();
        }
      })

      sidebar.show();
      assert.pass('showing the sidebar');

    });
  });
}

exports.testClickingACheckedMenuitem = function(assert, done) {
  const { Sidebar } = require('sdk/ui/sidebar');
  let testName = 'testClickingACheckedMenuitem';
  let window = getMostRecentBrowserWindow();
  let sidebar = Sidebar({
    id: testName,
    title: testName,
    icon: BLANK_IMG,
    url: 'data:text/html;charset=utf-8,'+testName,
  });

  sidebar.show().then(function() {
    assert.pass('the show callback works');

    sidebar.once('hide', function() {
      assert.pass('clicking the menuitem after the sidebar has shown hides it.');
      sidebar.destroy();
      done();
    });

    let menuitem = window.document.getElementById(makeID(sidebar.id));
    simulateCommand(menuitem);
  });
};

exports.testClickingACheckedButton = function(assert, done) {
  const { Sidebar } = require('sdk/ui/sidebar');
  let testName = 'testClickingACheckedButton';
  let window = getMostRecentBrowserWindow();

  let sidebar = Sidebar({
    id: testName,
    title: testName,
    icon: BLANK_IMG,
    url: 'data:text/html;charset=utf-8,'+testName,
    onShow: function onShow() {
      sidebar.off('show', onShow);

      assert.pass('the sidebar was shown');
      //assert.equal(button.checked, true, 'the button is now checked');

      sidebar.once('hide', function() {
        assert.pass('clicking the button after the sidebar has shown hides it.');

        sidebar.once('show', function() {
          assert.pass('clicking the button again shows it.');

          sidebar.hide().then(function() {
            assert.pass('hide callback works');
            assert.equal(isShowing(sidebar), false, 'the sidebar is not showing, final.');

            assert.pass('the sidebar was destroying');
            sidebar.destroy();
            assert.pass('the sidebar was destroyed');

            assert.equal(button.parentNode, null, 'the button\'s parents were shot')

            done();
          }, assert.fail);
        });

        assert.equal(isShowing(sidebar), false, 'the sidebar is not showing');

        // TODO: figure out why this is necessary..
        setTimeout(function() simulateCommand(button), 500);
      });

      assert.equal(isShowing(sidebar), true, 'the sidebar is showing');

      simulateCommand(button);
    }
  });

  let { node: button } = getWidget(sidebar.id, window);
  //assert.equal(button.checked, false, 'the button exists and is not checked');

  assert.equal(isShowing(sidebar), false, 'the sidebar is not showing');
  simulateCommand(button);
}

exports.testTitleSetter = function(assert, done) {
  const { Sidebar } = require('sdk/ui/sidebar');
  let testName = 'testTitleSetter';
  let { document } = getMostRecentBrowserWindow();

  let sidebar1 = Sidebar({
    id: testName,
    title: testName,
    icon: BLANK_IMG,
    url: 'data:text/html;charset=utf-8,'+testName,
  });

  assert.equal(sidebar1.title, testName, 'title getter works');

  sidebar1.show().then(function() {
    let button = document.querySelector('toolbarbutton[label=' + testName + ']');
    assert.ok(button, 'button was found');

    assert.equal(document.getElementById(makeID(sidebar1.id)).getAttribute('label'),
                 testName,
                 'the menuitem label is correct');

    assert.equal(document.getElementById('sidebar-title').value, testName, 'the menuitem label is correct');

    sidebar1.title = 'foo';

    assert.equal(sidebar1.title, 'foo', 'title getter works');

    assert.equal(document.getElementById(makeID(sidebar1.id)).getAttribute('label'),
                 'foo',
                 'the menuitem label was updated');

    assert.equal(document.getElementById('sidebar-title').value, 'foo', 'the sidebar title was updated');

    assert.equal(button.getAttribute('label'), 'foo', 'the button label was updated');

    sidebar1.destroy();
    done();
  }, assert.fail);
}

exports.testURLSetter = function(assert, done) {
  const { Sidebar } = require('sdk/ui/sidebar');
  let testName = 'testTitleSetter';
  let window = getMostRecentBrowserWindow();
  let { document } = window;
  let url = 'data:text/html;charset=utf-8,'+testName;

  let sidebar1 = Sidebar({
    id: testName,
    title: testName,
    icon: BLANK_IMG,
    url: url
  });

  assert.equal(sidebar1.url, url, 'url getter works');
  assert.equal(isShowing(sidebar1), false, 'the sidebar is not showing');
  assert.equal(document.getElementById(makeID(sidebar1.id)).getAttribute('checked'),
               'false',
               'the menuitem is not checked');
  assert.equal(isSidebarShowing(window), false, 'the new window sidebar is not showing');

  windowPromise(window.OpenBrowserWindow(), 'load').then(function(window) {
    let { document } = window;
    assert.pass('new window was opened');

    sidebar1.show().then(function() {
      assert.equal(isShowing(sidebar1), true, 'the sidebar is showing');
      assert.equal(document.getElementById(makeID(sidebar1.id)).getAttribute('checked'),
                   'true',
                   'the menuitem is checked');
      assert.ok(isSidebarShowing(window), 'the new window sidebar is showing');

      sidebar1.once('show', function() {
        assert.pass('setting the sidebar.url causes a show event');

        assert.equal(isShowing(sidebar1), true, 'the sidebar is showing');
        assert.ok(isSidebarShowing(window), 'the new window sidebar is still showing');

        assert.equal(document.getElementById(makeID(sidebar1.id)).getAttribute('checked'),
                     'true',
                     'the menuitem is still checked');

        sidebar1.destroy();

        close(window).then(done);
      });

      sidebar1.url = (url + '1');

      assert.equal(sidebar1.url, (url + '1'), 'url getter works');
      assert.equal(isShowing(sidebar1), true, 'the sidebar is showing');
      assert.ok(isSidebarShowing(window), 'the new window sidebar is showing');
    }, assert.fail);
  }, assert.fail);
}

exports.testShowInPrivateWindow = function(assert, done) {
  const { Sidebar } = require('sdk/ui/sidebar');
  let testName = 'testShowInPrivateWindow';
  let window = getMostRecentBrowserWindow();
  let { document } = window;
  let url = 'data:text/html;charset=utf-8,'+testName;

  let sidebar1 = Sidebar({
    id: testName,
    title: testName,
    icon: BLANK_IMG,
    url: url
  });

  assert.equal(sidebar1.url, url, 'url getter works');
  assert.equal(isShowing(sidebar1), false, 'the sidebar is not showing');
  assert.equal(document.getElementById(makeID(sidebar1.id)).getAttribute('checked'),
               'false',
               'the menuitem is not checked');
  assert.equal(isSidebarShowing(window), false, 'the new window sidebar is not showing');

  windowPromise(window.OpenBrowserWindow({ private: true }), 'load').then(function(window) {
    let { document } = window;
    assert.equal(isWindowPrivate(window), true, 'new window is private');
    assert.equal(isPrivate(window), true, 'new window is private');

    sidebar1.show().then(
      function bad() {
        assert.fail('a successful show should not happen here..');
      },
      function good() {
        assert.equal(isShowing(sidebar1), false, 'the sidebar is still not showing');
        assert.equal(document.getElementById(makeID(sidebar1.id)),
                     null,
                     'the menuitem dne on the private window');
        assert.equal(isSidebarShowing(window), false, 'the new window sidebar is not showing');

        sidebar1.destroy();
        close(window).then(done);
      },
      assert.fail);
  }, assert.fail);
}

exports.testDuplicateID = function(assert, done) {
  assert.pass('TODO');
  done();
}

exports.testURLSetterToSameValueReloadsSidebar = function(assert) {
  assert.pass('TODO');
}

exports.testShowingInOneWindowDoesNotAffectOtherWindows = function(assert) {
  assert.pass('TODO');
}

exports.testHidingAHiddenSidebarRejects = function(assert) {
  const { Sidebar } = require('sdk/ui/sidebar');
  let testName = 'testHidingAHiddenSidebarRejects';
  let sidebar = Sidebar({
    id: testName,
    title: testName,
    icon: BLANK_IMG,
    url: url
  });

  sidebar.hide().then(assert.fail, assert.pass).then(function() {
    sidebar.destroy();
    done();
  }, assert.fail);
}

// If the module doesn't support the app we're being run in, require() will
// throw.  In that case, remove all tests above from exports, and add one dummy
// test that passes.
try {
  require('sdk/ui/sidebar');
}
catch (err) {
  if (!/^Unsupported Application/.test(err.message))
    throw err;

  module.exports = {
    'test Unsupported Application': assert => assert.pass(err.message)
  }
}

require('sdk/test').run(exports);
