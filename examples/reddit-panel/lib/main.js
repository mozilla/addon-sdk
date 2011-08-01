var data = require("self").data;

var reddit_panel = require("panel").Panel({
  width: 240,
  height: 320,
  contentURL: "http://www.reddit.com/.mobile?keep_extension=True",
  contentScriptFile: [data.url("jquery-1.4.4.min.js"),
                      data.url("panel.js")]
});

reddit_panel.port.on("click", function(url) {
  require("tabs").open(url);
});

require("widget").Widget({
  id: "open-reddit-btn",
  label: "Reddit",
  contentURL: "http://www.reddit.com/static/favicon.ico",
  panel: reddit_panel
});

exports.main = function(options, callbacks) {
  // If you run cfx with --static-args='{"quitWhenDone":true}' this program
  // will automatically quit Firefox when it's done.
  if (options.staticArgs.quitWhenDone)
    callbacks.quit();
};
