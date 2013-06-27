/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const { Cu } = require('chrome');
const { CustomizableUI } = Cu.import('resource:///modules/CustomizableUI.jsm', {});
const { Loader } = require('sdk/test/loader');
const { data } = require('sdk/self');
const { open, focus, close } = require('sdk/window/helpers');
const { setTimeout } = require('sdk/timers');
const { getMostRecentBrowserWindow } = require('sdk/window/utils');

function getWidget(buttonId, window = getMostRecentBrowserWindow()) {
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

  // Test remote icon
  assert.throws(
    () => Button({ id: 'my-button', label: 'my button', icon: 'http://www.mozilla.org/favicon.ico'}),
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
    id: 'my-button',
    label: 'my button',
    icon: './icon.png'
  });

  // check defaults
//  assert.equal(button.size, 'small',
//    'size is set to default "small" value');

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

exports['test button duplicate id'] = function(assert) {
  let loader = Loader(module);
  let { Button } = loader.require('sdk/ui');

  let button = Button({
    id: 'my-button',
    label: 'my button',
    icon: './icon.png'
  });

  assert.throws(() => {
    let doppelganger = Button({
      id: 'my-button',
      label: 'my button',
      icon: './icon.png'
    });
  },
  /^The ID/,
  'No duplicates allowed');

  loader.unload();
}

exports['test button removed on dispose'] = function(assert, done) {
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
    id: 'my-button',
    label: 'my button',
    icon: './icon.png'
  });

  // Tried to use `getWidgetIdsInArea` but seems undefined, not sure if it
  // was removed or it's not in the UX build yet
  widgetId = getWidget(button.id).id;

  button.dispose();
};

exports['test button global state updated'] = function(assert) {
  let loader = Loader(module);
  let { Button } = loader.require('sdk/ui');

  let button = Button({
    id: 'my-button',
    label: 'my button',
    icon: './icon.png'
  });

  // Tried to use `getWidgetIdsInArea` but seems undefined, not sure if it
  // was removed or it's not in the UX build yet

  let { node, id: widgetId } = getWidget(button.id);

  // check read-only properties

  button.id = 'another-id';
  assert.equal(button.id, 'my-button',
    'id is unchanged');
  assert.equal(node.id, widgetId,
    'node id is unchanged');

  button.type = 'checkbox';
  assert.equal(button.type, 'button',
    'type is unchanged');
  assert.equal(node.getAttribute('type'), button.type,
    'node type is unchanged');

  button.size = 'medium';
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
    id: 'my-button',
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
    id: 'my-button',
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
    let node = nodes[0]
    let state = button.state(mainWindow);

    assert.equal(node.getAttribute('label'), state.label,
      'node label is correct');
    assert.equal(node.getAttribute('tooltiptext'), state.label,
      'node tooltip is correct');

    assert.equal(node.getAttribute('image'), data.url(state.icon.substr(2)),
      'node image is correct');
    assert.equal(node.getAttribute('disabled'), String(state.disabled),
      'disabled is correct');

    let node = nodes[1]
    let state = button.state(activeWindow);

    assert.equal(node.getAttribute('label'), state.label,
      'node label is correct');
    assert.equal(node.getAttribute('tooltiptext'), state.label,
      'node tooltip is correct');

    assert.equal(node.getAttribute('image'), data.url(state.icon.substr(2)),
      'node image is correct');
    assert.equal(node.getAttribute('disabled'), String(state.disabled),
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
    id: 'my-button',
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
      assert.equal(node.getAttribute('disabled'), String(state.disabled),
        'disabled is correct');

      tabs.once('activate', () => {
        // Tthis is made in order to avoid to check the node before it
        // is updated, need a better check
        setTimeout(() => {
          let state = button.state(mainTab);

          assert.equal(node.getAttribute('label'), state.label,
            'node label is correct');
          assert.equal(node.getAttribute('tooltiptext'), state.label,
            'node tooltip is correct');
          assert.equal(node.getAttribute('image'), data.url(state.icon.substr(2)),
            'node image is correct');
          assert.equal(node.getAttribute('disabled'), String(state.disabled),
            'disabled is correct');

          tab.close();
          loader.unload();
          done();
        }, 500);
      });

      mainTab.activate();

    }
  });

};

exports['test button click'] = function(assert, done) {
  let loader = Loader(module);
  let { Button } = loader.require('sdk/ui');
  let { browserWindows } = loader.require('sdk/windows');

  let labels = [];

  let button = Button({
    id: 'my-button',
    label: 'my button',
    icon: './icon.png',
    onClick: ({label}) => labels.push(label)
  });

  let mainWindow = browserWindows.activeWindow;

  open(null, { features: { toolbar: true }}).then(focus).then(window => {
    button.state(mainWindow, { label: 'nothing' });
    button.state(mainWindow.tabs.activeTab, { label: 'foo'})
    button.state(browserWindows.activeWindow, { label: 'bar' });

    button.click();
    mainWindow.activate();
    button.click();

    assert.deepEqual(labels, ['bar', 'foo'],
      'button click works');

    return window;
  }).
  then(close).
  then(loader.unload).
  then(done, assert.fail);
}

exports['test button type checkbox'] = function(assert, done) {
  let loader = Loader(module);
  let { Button } = loader.require('sdk/ui');
  let { browserWindows } = loader.require('sdk/windows');

  let events = [];

  let button = Button({
    id: 'my-button',
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

  open(null, { features: { toolbar: true }}).then(focus).then(window => {
    button.state(mainWindow, { label: 'nothing' });
    button.state(mainWindow.tabs.activeTab, { label: 'foo'})
    button.state(browserWindows.activeWindow, { label: 'bar' });

    button.click();
    button.click();
    mainWindow.activate();
    button.click();
    button.click();

    assert.deepEqual(events, [
        'clicked:bar', 'changed:bar:true', 'clicked:bar', 'changed:bar:false',
        'clicked:foo', 'changed:foo:true', 'clicked:foo', 'changed:foo:false'
      ],
      'button change events works');

    return window;
  }).
  then(close).
  then(loader.unload).
  then(done, assert.fail);

}

exports['test button icon set'] = function(assert) {
  let loader = Loader(module);
  let { Button } = loader.require('sdk/ui');

  // Test remote icon set
  assert.throws(
    () => Button({
      id: 'my-button',
      label: 'my button',
      icon: {
        '16': 'http://www.mozilla.org/favicon.ico'
      }
    }),
    /^The option "icon"/,
    'throws on no valid icon given');

  let button = Button({
    id: 'my-button',
    label: 'my button',
    icon: {
      '16': './icon16.png',
      '32': './icon32.png'
    }
  });

  let { node } = getWidget(button.id);
  let window = node.ownerDocument.defaultView;

  let size = 16 * window.devicePixelRatio;

  assert.equal(node.getAttribute('image'), data.url(button.icon[size].substr(2)),
    'the icon is properly with the best match');

  loader.unload();
}


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

require('test').run(exports);
