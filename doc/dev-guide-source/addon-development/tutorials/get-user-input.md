<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

# Getting User Input #

To follow this tutorial you'll need to have
[installed the SDK](dev-guide/addon-development/tutorials/installation.html)
and learned the
[basics of `cfx`](dev-guide/addon-development/tutorials/getting-started-with-cfx.html).

<img class="image-right" src="static-files/media/screenshots/text-entry-panel.png"
alt="Text entry panel">

In this tutorial we'll create an add-on that adds a widget to the toolbar
which displays a popup dialog when clicked. The popup just contains a
`<textarea>` element: when the user presses the `return` key, the contents
of the `<textarea>` is sent to the main add-on code.



The add-on consists of three files:

* **`main.js`**: the main add-on code, that creates the widget and panel
* **`get-text.js`**: the content script that interacts with the panel content
* **`text-entry.html`**: the panel content itself, specified as HTML

"main.js" is saved in your add-on's `lib` directory, and the other two files
go in your add-on's `data` directory:

<pre>
my-addon/
         data/
              get-text.js
              text-entry.html
         lib/
             main.js
</pre>

The "main.js" looks like this:

    var data = require("self").data;

    // Create a panel whose content is defined in "text-entry.html".
    // Attach a content script called "get-text.js".
    var text_entry = require("panel").Panel({
      width: 212,
      height: 200,
      contentURL: data.url("text-entry.html"),
      contentScriptFile: data.url("get-text.js")
    });

    // Send the content script a message called "show" when
    // the panel is shown.
    text_entry.on("show", function() {
      text_entry.port.emit("show");
    });

    // Listen for messages called "text-entered" coming from
    // the content script. The message payload is the text the user
    // entered.
    // In this implementation we'll just log the text to the console.
    text_entry.port.on("text-entered", function (text) {
      console.log(text);
      text_entry.hide();
    });

    // Create a widget, and attach the panel to it, so the panel is
    // shown when the user clicks the widget.
    require("widget").Widget({
      label: "Text entry",
      id: "text-entry",
      contentURL: "http://www.mozilla.org/favicon.ico",
      panel: text_entry
    });

The content script "get-text.js" looks like this:

    self.port.on("show", function (arg) {
      var textArea = document.getElementById('edit-box');
      textArea.focus();
      // When the user hits return, send a message to main.js.
      // The message payload is the contents of the edit box.
      textArea.onkeyup = function(event) {
        if (event.keyCode == 13) {
          // Remove the newline.
          text = textArea.value.replace(/(\r\n|\n|\r)/gm,"");
          self.port.emit("text-entered", text);
          textArea.value = '';
        }
      };
    });

Finally, the "text-entry.html" file defines the `<textarea>` element:

<script type="syntaxhighlighter" class="brush: html"><![CDATA[
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN"
"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">

<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">

<head>
  <style type="text/css" media="all">
    textarea {
      margin: 10px;
    }
  </style>
</head>

<body>
  <textarea rows="10" cols="20" id="edit-box"></textarea>
</body>

</html>
]]>
</script>

