<!-- contributed by Paul O'Shannessy [paul@oshannessy.com]  -->
<!-- edited by Noelle Murata [fiveinchpixie@gmail.com]  -->
<!-- contributed by Irakli Gozalishvili [gozala@mozilla.com] -->

The `private-browsing` module allows you to access Firefox's private browsing
mode, detecting if it is active and when its state changes.

This module is available in all applications. However, only Firefox will ever
transition into or out of private browsing mode. For all other applications,
`pb.isActive` will always be `false`, and none of the events will be emitted.

<api name="isActive">
@property {boolean}
  This read-only boolean is true if private browsing mode is turned on.
</api>

<api name="activate">
@function
  Turns on private browsing mode.
</api>

<api name="deactivate">
@function
  Turns off private browsing mode.
</api>

<api name="start">
@event
Emitted when the browser starts private browsing mode.

    var pb = require("private-browsing");
    pb.on("start", function() {
      // Do something when the browser starts private browsing mode.
    });

</api>

<api name="stop">
@event
Emitted when the browser stops private browsing mode.

    var pb = require("private-browsing");
    pb.on("stop", function() {
      // Do something when the browser stops private browsing mode.
    });
</api>