const widgets = require("widget");
const data = require("self").data;

exports.main = function(options, callbacks) {
  widgets.Widget({
    label: "Reddit",
    contentURL: "http://www.reddit.com/static/favicon.ico",
    panel: require("panel").Panel({
      width: 240,
      height: 320,
      contentURL: "http://www.reddit.com/.mobile?keep_extension=True",
      contentScriptFile: [data.url("panel.js")],
      contentScriptWhen: "ready",
      onMessage: function(message) {
        require("tabs").open(message);
      }
    })
  });

  if (options.staticArgs.quitWhenDone)
    callbacks.quit();
};
