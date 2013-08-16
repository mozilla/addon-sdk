/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

module.metadata = {
  'engines': {
    'Firefox': '> 24'
  }
};

const { Cu } = require('chrome');
const { Loader } = require('sdk/test/loader');
const { data } = require('sdk/self');
const { open, focus, close } = require('sdk/window/helpers');
const { setTimeout } = require('sdk/timers');
const { getMostRecentBrowserWindow } = require('sdk/window/utils');

function getWidget(buttonId, window = getMostRecentBrowserWindow()) {
  const { CustomizableUI } = Cu.import('resource:///modules/CustomizableUI.jsm', {});
  const { AREA_NAVBAR } = CustomizableUI;

  let widgets = CustomizableUI.getWidgetsInArea(AREA_NAVBAR).
    filter(({id}) => id.startsWith('button--') && id.endsWith(buttonId));

  if (widgets.length === 0)
    throw new Error('Widget with id `' + id +'` not found.');

  if (widgets.length > 1)
    throw new Error('Unexpected number of widgets: ' + widgets.length)

  return widgets[0].forWindow(window);
};

exports['test basic constructor validation'] = function(assert) {
  let loader = Loader(module);
  let { Button } = loader.require('sdk/ui');

  assert.throws(
    () => Button({}),
    /^The option/,
    'throws on no option given');

  // Test no label
  assert.throws(
    () => Button({ id: 'my-button', icon: './icon.png'}),
    /^The option "label"/,
    'throws on no label given');

  // Test no id
  assert.throws(
    () => Button({ label: 'my button', icon: './icon.png' }),
    /^The option "id"/,
    'throws on no id given');

  // Test no icon
  assert.throws(
    () => Button({ id: 'my-button', label: 'my button' }),
    /^The option "icon"/,
    'throws on no icon given');


  // Test empty label
  assert.throws(
    () => Button({ id: 'my-button', label: '', icon: './icon.png' }),
    /^The option "label"/,
    'throws on no valid label given');

  // Test invalid id
  assert.throws(
    () => Button({ id: 'my button', label: 'my button', icon: './icon.png' }),
    /^The option "id"/,
    'throws on no valid id given');

  // Test empty id
  assert.throws(
    () => Button({ id: '', label: 'my button', icon: './icon.png' }),
    /^The option "id"/,
    'throws on no valid id given');

  // Test remote icon
  assert.throws(
    () => Button({ id: 'my-button', label: 'my button', icon: 'http://www.mozilla.org/favicon.ico'}),
    /^The option "icon"/,
    'throws on no valid icon given');

  // Test wrong icon: no absolute URI to local resource, neither relative './'
  assert.throws(
    () => Button({ id: 'my-button', label: 'my button', icon: 'icon.png'}),
    /^The option "icon"/,
    'throws on no valid icon given');

  // Test wrong icon: no absolute URI to local resource, neither relative './'
  assert.throws(
    () => Button({ id: 'my-button', label: 'my button', icon: 'foo and bar'}),
    /^The option "icon"/,
    'throws on no valid icon given');

  // Test wrong icon: '../' is not allowed
  assert.throws(
    () => Button({ id: 'my-button', label: 'my button', icon: '../icon.png'}),
    /^The option "icon"/,
    'throws on no valid icon given');

  // Test wrong size: number
  assert.throws(
    () => Button({
      id:'my-button',
      label: 'my button',
      icon: './icon.png',
      size: 32
    }),
    /^The option "size"/,
    'throws on no valid size given');

  // Test wrong size: string
  assert.throws(
    () => Button({
      id:'my-button',
      label: 'my button',
      icon: './icon.png',
      size: 'huge'
    }),
    /^The option "size"/,
    'throws on no valid size given');

  // Test wrong type
  assert.throws(
    () => Button({
      id:'my-button',
      label: 'my button',
      icon: './icon.png',
      type: 'custom'
    }),
    /^The option "type"/,
    'throws on no valid type given');

  loader.unload();
};

exports['test button added'] = function(assert) {
  let loader = Loader(module);
  let { Button } = loader.require('sdk/ui');

  let button = Button({
    id: 'my-button-1',
    label: 'my button',
    icon: './icon.png'
  });

  // check defaults
  assert.equal(button.size, 'small',
    'size is set to default "small" value');

  assert.equal(button.disabled, false,
    'disabled is set to default `false` value');

  assert.equal(button.checked, false,
    'checked is set to default `false` value');

  assert.equal(button.type, 'button',
    'type is set to default "button" value');

  let { node } = getWidget(button.id);

  assert.ok(!!node, 'The button is in the navbar');

  assert.equal(button.label, node.getAttribute('label'),
    'label is set');

  assert.equal(button.label, node.getAttribute('tooltiptext'),
    'tooltip is set');

  assert.equal(data.url(button.icon.substr(2)), node.getAttribute('image'),
    'icon is set');

  assert.equal(button.type, node.getAttribute('type'),
    'type is set to default');

  assert.equal(16, node.getAttribute('width'),
    'width is set to small');

  loader.unload();
}

exports['test button added with resource URI'] = function(assert) {
  let loader = Loader(module);
  let { Button } = loader.require('sdk/ui');

  let button = Button({
    id: 'my-button-1',
    label: 'my button',
    icon: data.url('icon.png')
  });

  assert.equal(button.icon, data.url('icon.png'),
    'icon is set');

  let { node } = getWidget(button.id);

  assert.equal(button.icon, node.getAttribute('image'),
    'icon on node is set');

  loader.unload();
}

exports['test button duplicate id'] = function(assert) {
  let loader = Loader(module);
  let { Button } = loader.require('sdk/ui');

  let button = Button({
    id: 'my-button-2',
    label: 'my button',
    icon: './icon.png'
  });

  assert.throws(() => {
    let doppelganger = Button({
      id: 'my-button-2',
      label: 'my button',
      icon: './icon.png'
    });
  },
  /^The ID/,
  'No duplicates allowed');

  loader.unload();
}

exports['test button multiple destroy'] = function(assert) {
  let loader = Loader(module);
  let { Button } = loader.require('sdk/ui');

  let button = Button({
    id: 'my-button-2',
    label: 'my button',
    icon: './icon.png'
  });

  button.destroy();
  button.destroy();
  button.destroy();

  assert.pass('multiple destroy doesn\'t matter');

  loader.unload();
}

exports['test button removed on dispose'] = function(assert, done) {
  const { CustomizableUI } = Cu.import('resource:///modules/CustomizableUI.jsm', {});
  let loader = Loader(module);
  let { Button } = loader.require('sdk/ui');

  let widgetId;

  CustomizableUI.addListener({
    onWidgetDestroyed: function(id) {
      if (id === widgetId) {
        CustomizableUI.removeListener(this);

        assert.pass('button properly removed');
        loader.unload();
        done();
      }
    }
  });

  let button = Button({
    id: 'my-button-3',
    label: 'my button',
    icon: './icon.png'
  });

  // Tried to use `getWidgetIdsInArea` but seems undefined, not sure if it
  // was removed or it's not in the UX build yet
  widgetId = getWidget(button.id).id;

  button.destroy();
};

exports['test button global state updated'] = function(assert) {
  let loader = Loader(module);
  let { Button } = loader.require('sdk/ui');

  let button = Button({
    id: 'my-button-4',
    label: 'my button',
    icon: './icon.png'
  });

  // Tried to use `getWidgetIdsInArea` but seems undefined, not sure if it
  // was removed or it's not in the UX build yet

  let { node, id: widgetId } = getWidget(button.id);

  // check read-only properties

  assert.throws(() => button.id = 'another-id',
    /^setting a property that has only a getter/,
    'id cannot be set at runtime');

  assert.equal(button.id, 'my-button-4',
    'id is unchanged');
  assert.equal(node.id, widgetId,
    'node id is unchanged');

  assert.throws(() => button.type = 'checkbox',
    /^setting a property that has only a getter/,
    'type cannot be set at runtime');

  assert.equal(button.type, 'button',
    'type is unchanged');
  assert.equal(node.getAttribute('type'), button.type,
    'node type is unchanged');

  assert.throws(() => button.size = 'medium',
    /^setting a property that has only a getter/,
    'size cannot be set at runtime');

  assert.equal(button.size, 'small',
    'size is unchanged');
  assert.equal(node.getAttribute('width'), 16,
    'node width is unchanged');

  // check writable properties

  button.label = 'New label';
  assert.equal(button.label, 'New label',
    'label is updated');
  assert.equal(node.getAttribute('label'), 'New label',
    'node label is updated');
  assert.equal(node.getAttribute('tooltiptext'), 'New label',
    'node tooltip is updated');

  button.icon = './new-icon.png';
  assert.equal(button.icon, './new-icon.png',
    'icon is updated');
  assert.equal(node.getAttribute('image'), data.url('new-icon.png'),
    'node image is updated');

  button.disabled = true;
  assert.equal(button.disabled, true,
    'disabled is updated');
  assert.equal(node.getAttribute('disabled'), 'true',
    'node disabled is updated');

  // TODO: test validation on update

  loader.unload();
}

exports['test button global state updated on multiple windows'] = function(assert, done) {
  let loader = Loader(module);
  let { Button } = loader.require('sdk/ui');

  let button = Button({
    id: 'my-button-5',
    label: 'my button',
    icon: './icon.png'
  });

  let nodes = [getWidget(button.id).node];

  open(null, { features: { toolbar: true }}).then(window => {
    nodes.push(getWidget(button.id, window).node);

    button.label = 'New label';
    button.icon = './new-icon.png';
    button.disabled = true;

    for (let node of nodes) {
      assert.equal(node.getAttribute('label'), 'New label',
        'node label is updated');
      assert.equal(node.getAttribute('tooltiptext'), 'New label',
        'node tooltip is updated');

      assert.equal(button.icon, './new-icon.png',
        'icon is updated');
      assert.equal(node.getAttribute('image'), data.url('new-icon.png'),
        'node image is updated');

      assert.equal(button.disabled, true,
        'disabled is updated');
      assert.equal(node.getAttribute('disabled'), 'true',
        'node disabled is updated');
    };

    return window;
  }).
  then(close).
  then(loader.unload).
  then(done, assert.fail);
};

exports['test button window state'] = function(assert, done) {
  let loader = Loader(module);
  let { Button } = loader.require('sdk/ui');
  let { browserWindows } = loader.require('sdk/windows');

  let button = Button({
    id: 'my-button-6',
    label: 'my button',
    icon: './icon.png'
  });

  let mainWindow = browserWindows.activeWindow;
  let nodes = [getWidget(button.id).node];

  open(null, { features: { toolbar: true }}).then(focus).then(window => {
    nodes.push(getWidget(button.id, window).node);

    let { activeWindow } = browserWindows;

    button.state(activeWindow, {
      label: 'New label',
      icon: './new-icon.png',
      disabled: true
    });

    // check the states

    assert.equal(button.label, 'my button',
      'global label unchanged');
    assert.equal(button.icon, './icon.png',
      'global icon unchanged');
    assert.equal(button.disabled, false,
      'global disabled unchanged');

    let state = button.state(mainWindow);

    assert.equal(state.label, 'my button',
      'previous window label unchanged');
    assert.equal(state.icon, './icon.png',
      'previous window icon unchanged');
    assert.equal(state.disabled, false,
      'previous window disabled unchanged');

    let state = button.state(activeWindow);

    assert.equal(state.label, 'New label',
      'active window label updated');
    assert.equal(state.icon, './new-icon.png',
      'active window icon updated');
    assert.equal(state.disabled, true,
      'active disabled updated');

    // change the global state, only the windows without a state are affected

    button.label = 'A good label';

    assert.equal(button.label, 'A good label',
      'global label updated');
    assert.equal(button.state(mainWindow).label, 'A good label',
      'previous window label updated');
    assert.equal(button.state(activeWindow).label, 'New label',
      'active window label unchanged');

    // delete the window state will inherits the global state again

    button.state(activeWindow, null);

    assert.equal(button.state(activeWindow).label, 'A good label',
      'active window label inherited');

    // check the nodes properties
    let node = nodes[0];
    let state = button.state(mainWindow);

    assert.equal(node.getAttribute('label'), state.label,
      'node label is correct');
    assert.equal(node.getAttribute('tooltiptext'), state.label,
      'node tooltip is correct');

    assert.equal(node.getAttribute('image'), data.url(state.icon.substr(2)),
      'node image is correct');
    assert.equal(node.hasAttribute('disabled'), state.disabled,
      'disabled is correct');

    let node = nodes[1];
    let state = button.state(activeWindow);

    assert.equal(node.getAttribute('label'), state.label,
      'node label is correct');
    assert.equal(node.getAttribute('tooltiptext'), state.label,
      'node tooltip is correct');

    assert.equal(node.getAttribute('image'), data.url(state.icon.substr(2)),
      'node image is correct');
    assert.equal(node.hasAttribute('disabled'), state.disabled,
      'disabled is correct');

    return window;
  }).
  then(close).
  then(loader.unload).
  then(done, assert.fail);
};


exports['test button tab state'] = function(assert, done) {
  let loader = Loader(module);
  let { Button } = loader.require('sdk/ui');
  let { browserWindows } = loader.require('sdk/windows');
  let tabs = loader.require('sdk/tabs');

  let button = Button({
    id: 'my-button-7',
    label: 'my button',
    icon: './icon.png'
  });

  let mainTab = tabs.activeTab;
  let node = getWidget(button.id).node;

  tabs.open({
    url: 'about:blank',
    onActivate: function onActivate(tab) {
      tab.removeListener('activate', onActivate);

      let { activeWindow } = browserWindows;
      // set window state
      button.state(activeWindow, {
        label: 'Window label',
        icon: './window-icon.png'
      });

      // set previous active tab state
      button.state(mainTab, {
        label: 'Tab label',
        icon: './tab-icon.png',
      });

      // set current active tab state
      button.state(tab, {
        icon: './another-tab-icon.png',
        disabled: true
      });

      // check the states

      Cu.schedulePreciseGC(() => {
        assert.equal(button.label, 'my button',
          'global label unchanged');
        assert.equal(button.icon, './icon.png',
          'global icon unchanged');
        assert.equal(button.disabled, false,
          'global disabled unchanged');

        let state = button.state(mainTab);

        assert.equal(state.label, 'Tab label',
          'previous tab label updated');
        assert.equal(state.icon, './tab-icon.png',
          'previous tab icon updated');
        assert.equal(state.disabled, false,
          'previous tab disabled unchanged');

        let state = button.state(tab);

        assert.equal(state.label, 'Window label',
          'active tab inherited from window state');
        assert.equal(state.icon, './another-tab-icon.png',
          'active tab icon updated');
        assert.equal(state.disabled, true,
          'active disabled updated');

        // change the global state
        button.icon = './good-icon.png';

        // delete the tab state
        button.state(tab, null);

        assert.equal(button.icon, './good-icon.png',
          'global icon updated');
        assert.equal(button.state(mainTab).icon, './tab-icon.png',
          'previous tab icon unchanged');
        assert.equal(button.state(tab).icon, './window-icon.png',
          'tab icon inherited from window');

        // delete the window state
        button.state(activeWindow, null);

        assert.equal(button.state(tab).icon, './good-icon.png',
          'tab icon inherited from global');

        // check the node properties

        let state = button.state(tabs.activeTab);

        assert.equal(node.getAttribute('label'), state.label,
          'node label is correct');
        assert.equal(node.getAttribute('tooltiptext'), state.label,
          'node tooltip is correct');
        assert.equal(node.getAttribute('image'), data.url(state.icon.substr(2)),
          'node image is correct');
        assert.equal(node.hasAttribute('disabled'), state.disabled,
          'disabled is correct');

        tabs.once('activate', () => {
          // This is made in order to avoid to check the node before it
          // is updated, need a better check
          setTimeout(() => {
            let state = button.state(mainTab);

            assert.equal(node.getAttribute('label'), state.label,
              'node label is correct');
            assert.equal(node.getAttribute('tooltiptext'), state.label,
              'node tooltip is correct');
            assert.equal(node.getAttribute('image'), data.url(state.icon.substr(2)),
              'node image is correct');
            assert.equal(node.hasAttribute('disabled'), state.disabled,
              'disabled is correct');

            tab.close(() => {
              loader.unload();
              done();
            });
          }, 500);
        });

        mainTab.activate();
      });
    }
  });

};

exports['test button click'] = function(assert, done) {
  let loader = Loader(module);
  let { Button } = loader.require('sdk/ui');
  let { browserWindows } = loader.require('sdk/windows');

  let labels = [];

  let button = Button({
    id: 'my-button-8',
    label: 'my button',
    icon: './icon.png',
    onClick: ({label}) => labels.push(label)
  });

  let mainWindow = browserWindows.activeWindow;
  let chromeWindow = getMostRecentBrowserWindow();

  open(null, { features: { toolbar: true }}).then(focus).then(window => {
    button.state(mainWindow, { label: 'nothing' });
    button.state(mainWindow.tabs.activeTab, { label: 'foo'})
    button.state(browserWindows.activeWindow, { label: 'bar' });

    button.click();

    focus(chromeWindow).then(() => {
      button.click();

      assert.deepEqual(labels, ['bar', 'foo'],
        'button click works');

      close(window).
        then(loader.unload).
        then(done, assert.fail);
    });
  }).then(null, assert.fail);
}

exports['test button type checkbox'] = function(assert, done) {
  let loader = Loader(module);
  let { Button } = loader.require('sdk/ui');
  let { browserWindows } = loader.require('sdk/windows');

  let events = [];

  let button = Button({
    id: 'my-button-9',
    label: 'my button',
    icon: './icon.png',
    type: 'checkbox',
    onClick: ({label}) => events.push('clicked:' + label),
    onChange: state => events.push('changed:' + state.label + ':' + state.checked)
  });

  let { node } = getWidget(button.id);

  assert.equal(button.type, 'checkbox',
    'button type is set');
  assert.equal(node.getAttribute('type'), 'checkbox',
    'node type is set');

  let mainWindow = browserWindows.activeWindow;
  let chromeWindow = getMostRecentBrowserWindow();

  open(null, { features: { toolbar: true }}).then(focus).then(window => {
    button.state(mainWindow, { label: 'nothing' });
    button.state(mainWindow.tabs.activeTab, { label: 'foo'})
    button.state(browserWindows.activeWindow, { label: 'bar' });

    button.click();
    button.click();

    focus(chromeWindow).then(() => {
      button.click();
      button.click();

      assert.deepEqual(events, [
          'clicked:bar', 'changed:bar:true', 'clicked:bar', 'changed:bar:false',
          'clicked:foo', 'changed:foo:true', 'clicked:foo', 'changed:foo:false'
        ],
        'button change events works');

      close(window).
        then(loader.unload).
        then(done, assert.fail);
    })
  }).then(null, assert.fail);
}

exports['test button icon set'] = function(assert) {
  const { CustomizableUI } = Cu.import('resource:///modules/CustomizableUI.jsm', {});
  let loader = Loader(module);
  let { Button } = loader.require('sdk/ui');

  // Test remote icon set
  assert.throws(
    () => Button({
      id: 'my-button-10',
      label: 'my button',
      icon: {
        '16': 'http://www.mozilla.org/favicon.ico'
      }
    }),
    /^The option "icon"/,
    'throws on no valid icon given');

  let button = Button({
    id: 'my-button-11',
    label: 'my button',
    icon: {
      '5': './icon5.png',
      '16': './icon16.png',
      '32': './icon32.png',
      '64': './icon64.png'
    }
  });

  let { node, id: widgetId } = getWidget(button.id);
  let { devicePixelRatio } = node.ownerDocument.defaultView;

  let size = 16 * devicePixelRatio;

  assert.equal(node.getAttribute('image'), data.url(button.icon[size].substr(2)),
    'the icon is set properly in navbar');

  let size = 32 * devicePixelRatio;

  CustomizableUI.addWidgetToArea(widgetId, CustomizableUI.AREA_PANEL);

  assert.equal(node.getAttribute('image'), data.url(button.icon[size].substr(2)),
    'the icon is set properly in panel');

  // Using `loader.unload` without move back the button to the original area
  // raises an error in the CustomizableUI. This is doesn't happen if the
  // button is moved manually from navbar to panel. I believe it has to do
  // with `addWidgetToArea` method, because even with a `timeout` the issue
  // persist.
  CustomizableUI.addWidgetToArea(widgetId, CustomizableUI.AREA_NAVBAR);

  loader.unload();
}

exports['test button icon se with only one option'] = function(assert) {
  const { CustomizableUI } = Cu.import('resource:///modules/CustomizableUI.jsm', {});
  let loader = Loader(module);
  let { Button } = loader.require('sdk/ui');

  // Test remote icon set
  assert.throws(
    () => Button({
      id: 'my-button-10',
      label: 'my button',
      icon: {
        '16': 'http://www.mozilla.org/favicon.ico'
      }
    }),
    /^The option "icon"/,
    'throws on no valid icon given');

  let button = Button({
    id: 'my-button-11',
    label: 'my button',
    icon: {
      '5': './icon5.png'
    }
  });

  let { node, id: widgetId } = getWidget(button.id);

  assert.equal(node.getAttribute('image'), data.url(button.icon['5'].substr(2)),
    'the icon is set properly in navbar');

  CustomizableUI.addWidgetToArea(widgetId, CustomizableUI.AREA_PANEL);

  assert.equal(node.getAttribute('image'), data.url(button.icon['5'].substr(2)),
    'the icon is set properly in panel');

  // Using `loader.unload` without move back the button to the original area
  // raises an error in the CustomizableUI. This is doesn't happen if the
  // button is moved manually from navbar to panel. I believe it has to do
  // with `addWidgetToArea` method, because even with a `timeout` the issue
  // persist.
  CustomizableUI.addWidgetToArea(widgetId, CustomizableUI.AREA_NAVBAR);

  loader.unload();
}

exports['test button state validation'] = function(assert) {
  let loader = Loader(module);
  let { Button } = loader.require('sdk/ui');
  let { browserWindows } = loader.require('sdk/windows');

  let button = Button({
    id: 'my-button-12',
    label: 'my button',
    icon: './icon.png'
  })

  button.state(button, {
    size: 'large'
  });

  assert.equal(button.size, 'small',
    'button.size is unchanged');

  let state = button.state(button);

  assert.equal(button.size, 'small',
    'button state is unchanged');

  assert.throws(
    () => button.state(button, { icon: 'http://www.mozilla.org/favicon.ico' }),
    /^The option "icon"/,
    'throws on remote icon given');

  loader.unload();
};

exports['test button are not in private windows'] = function(assert, done) {
  let loader = Loader(module);
  let { Button } = loader.require('sdk/ui');
  let{ isPrivate } = loader.require('sdk/private-browsing');
  let { browserWindows } = loader.require('sdk/windows');

  let button = Button({
    id: 'my-button-13',
    label: 'my button',
    icon: './icon.png'
  });

  open(null, { features: { toolbar: true, private: true }}).then(window => {
    assert.ok(isPrivate(window),
      'the new window is private');

    let { node } = getWidget(button.id, window);

    assert.ok(!node || node.style.display === 'none',
      'the button is not added / is not visible on private window');

    return window;
  }).
  then(close).
  then(loader.unload).
  then(done, assert.fail)
}

exports['test button state are snapshot'] = function(assert) {
  let loader = Loader(module);
  let { Button } = loader.require('sdk/ui');
  let { browserWindows } = loader.require('sdk/windows');
  let tabs = loader.require('sdk/tabs');

  let button = Button({
    id: 'my-button-14',
    label: 'my button',
    icon: './icon.png'
  });

  let state = button.state(button);
  let windowState = button.state(browserWindows.activeWindow);
  let tabState = button.state(tabs.activeTab);

  assert.deepEqual(windowState, state,
    'window state has the same properties of button state');

  assert.deepEqual(tabState, state,
    'tab state has the same properties of button state');

  assert.notEqual(windowState, state,
    'window state is not the same object of button state');

  assert.notEqual(tabState, state,
    'tab state is not the same object of button state');

  assert.deepEqual(button.state(button), state,
    'button state has the same content of previous button state');

  assert.deepEqual(button.state(browserWindows.activeWindow), windowState,
    'window state has the same content of previous window state');

  assert.deepEqual(button.state(tabs.activeTab), tabState,
    'tab state has the same content of previous tab state');

  assert.notEqual(button.state(button), state,
    'button state is not the same object of previous button state');

  assert.notEqual(button.state(browserWindows.activeWindow), windowState,
    'window state is not the same object of previous window state');

  assert.notEqual(button.state(tabs.activeTab), tabState,
    'tab state is not the same object of previous tab state');

  loader.unload();
}

exports['test button after destroy'] = function(assert) {
  let loader = Loader(module);
  let { Button } = loader.require('sdk/ui');
  let { browserWindows } = loader.require('sdk/windows');
  let { activeTab } = loader.require('sdk/tabs');

  let button = Button({
    id: 'my-button-15',
    label: 'my button',
    icon: './icon.png',
    onClick: () => assert.fail('onClick should not be called')
  });

  button.destroy();

  assert.throws(
    () => button.click(),
    /^The state cannot be set or get/,
    'button.click() not executed');

  assert.throws(
    () => button.label,
    /^The state cannot be set or get/,
    'button.label cannot be get after destroy');

  assert.throws(
    () => button.label = 'my label',
    /^The state cannot be set or get/,
    'button.label cannot be set after destroy');

  assert.throws(
    () => {
      button.state(browserWindows.activeWindow, {
        label: 'window label'
      });
    },
    /^The state cannot be set or get/,
    'window state label cannot be set after destroy');

  assert.throws(
    () => button.state(browserWindows.activeWindow).label,
    /^The state cannot be set or get/,
    'window state label cannot be get after destroy');

  assert.throws(
    () => {
      button.state(activeTab, {
        label: 'tab label'
      });
    },
    /^The state cannot be set or get/,
    'tab state label cannot be set after destroy');

  assert.throws(
    () => button.state(activeTab).label,
    /^The state cannot be set or get/,
    'window state label cannot se get after destroy');

  loader.unload();
};

// If the module doesn't support the app we're being run in, require() will
// throw.  In that case, remove all tests above from exports, and add one dummy
// test that passes.
try {
  require('sdk/ui/button');
}
catch (err) {
  if (!/^Unsupported Application/.test(err.message))
    throw err;

  module.exports = {
    'test Unsupported Application': assert => assert.pass(err.message)
  }
}

require('sdk/test').run(exports);
