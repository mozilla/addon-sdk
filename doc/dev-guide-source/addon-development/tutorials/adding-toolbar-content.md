<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

# Create a New Toolbar #

<span class="aside">
To follow this tutorial you'll need to have
[installed the SDK](dev-guide/addon-development/installation.html)
and learned the
[basics of `cfx`](dev-guide/addon-development/tutorials/getting-started-with-cfx.html).
</span>

You can use the [`widget`](packages/addon-kit/docs/widget.html)
module to add a button to the
[Add-on bar](http://support.mozilla.org/en-US/kb/what-add-bar).
But because the widget can host HTML as well as just an image, and
because you can attach scripts to the HTML, you can include anything
in a widget that you can specify using dynamic HTML.

This means you can use a widget to create your own toolbar inside the
Add-on bar. The main restrictions are:

* although you can set the width of the toolbar, you can't set its height:
it must fit inside the Add-on bar

* you can only place the toolbar in the Add-on bar, although the user can
relocate it using toolbar customization (but when
[bug 695913](https://bugzilla.mozilla.org/show_bug.cgi?id=695913) is fixed,
widgets will be placed in the navigation bar by default).

* any scripts attached to the widget can't use the SDK APIs. So if you want
to do that, you need to send messages between the script and your main
add-on code.

<!-- The icons this widget displays, shown in the screenshot, is taken from the
Glossy Buttons icon set created by IconEden which is made freely available for
commercial and non-commercial use.
See: http://www.iconeden.com/icon/category/free -->

<img class="image-right" src="static-files/media/screenshots/widget-player-buttons.png"
alt="Media player UI implemented as a widget">

Suppose we want to implement a media player as an add-on.
We could implement the main user interface as a widget hosting an array
of buttons to control play/pause/stop functions. We can specify this
using HTML.

We can then attach a script to the HTML to listen for clicks on those
buttons. But because content scripts can't use the SDK's APIs, we'll
want the content script to send messages to the main add-on code, which
can then implement the media player functions using the SDK.

The widget's content is specified using HTML like this:

<script type="syntaxhighlighter" class="brush: html"><![CDATA[
<html>
  <body>
    <img src="play.png" id="play-button"></img>
    <img src="pause.png" id="pause-button"></img>
    <img src="stop.png" id="stop-button"></img>
  </body>
</html>
]]>
</script>

We just include three icons, and assign an ID to each one. This HTML file,
and the icon files it references, are saved in the add-on's `data`
directory.

Next, we write a script that listens for click events on each icon
and sends the corresponding message to the main add-on code. To
send a message to the main add-on code, we use the `port.emit()`
function attached to the global `self` object:

    var play_button = document.getElementById("play-button");
    play_button.onclick = function() {
      self.port.emit("play");
    }

    var pause_button = document.getElementById("pause-button");
    pause_button.onclick = function() {
      self.port.emit("pause");
    }

    var stop_button = document.getElementById("stop-button");
    stop_button.onclick = function() {
      self.port.emit("stop");
    }

We save this file in the add-on's `data` directory as "button-script.js".
Finally. in the add-on's "main.js" file, we create the widget, assign it
the HTML file and the content script, and listen for events from the content
script:

    const widgets = require("widget");
    const data = require("self").data;

    var player = widgets.Widget({
      id: "player",
      width: 72,
      label: "Player",
      contentURL: data.url("buttons.html"),
      contentScriptFile: data.url("button-script.js")
    });

    // Listen for messages from the script
    // using the "on()" function of the widget's
    // "port" property

    player.port.on("play", function() {
      console.log("playing");
    });

    player.port.on("pause", function() {
      console.log("pausing");
    });

    player.port.on("stop", function() {
      console.log("stopping");
    });



To learn much more about content scripts, see the
[Working with Content Scripts](dev-guide/addon-development/web-content.html)
guide.