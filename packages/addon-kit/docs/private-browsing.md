<!-- contributed by Paul O’Shannessy [paul@oshannessy.com]  -->
<!-- edited by Noelle Murata [fiveinchpixie@gmail.com]  -->
<!-- contributed by Irakli Gozalishvili [gozala@mozilla.com] -->

The `private-browsing` module allows you to access Firefox's private browsing
mode, detecting if it is active and when its state changes.

## Events ##

When the browser starts or stops private browsing mode, the following events
are emitted.  In each case, listeners are passed an event object that has a
single property `emitter` whose value is the private browsing module itself.

### start ###
Emitted when the browser starts private browsing mode.

    var pb = require("private-browsing");
    pb.on("start", function(event) {
      // Do something when the browser starts private browsing mode.
    });


### stop ###
Emitted when the browser stops private browsing mode.

    var pb = require("private-browsing");
    pb.on("stop", function(event) {
      // Do something when the browser stops private browsing mode.
    });

## Supported Applications ##

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
