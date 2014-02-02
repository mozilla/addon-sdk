let data = require('sdk/self').data;
let tabs = require('sdk/tabs');
let notify = require('sdk/notifications').notify;

let { ActionButton } = require('sdk/ui');
let { ToggleButton } = require('sdk/ui');

let icon = 'chrome://mozapps/skin/extensions/extensionGeneric.png';

// your basic action button
let action = ActionButton({
  id: 'test-action-button',
  label: 'Action Button',
  icon: icon,
  onClick: function (state) {
    notify({
      title: "Action!",
      text: "This notification was triggered from an action button!",
    });
  }
});

let toggle = ToggleButton({
  id: 'test-toggle-button',
  label: 'Toggle Button',
  icon: icon,
  onClick: function (state) {
    notify({
      title: "Toggled!",
      text: "The current state of the button is "+state.checked,
    });
  }
});
