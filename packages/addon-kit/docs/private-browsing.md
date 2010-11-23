<!-- contributed by Paul O’Shannessy [paul@oshannessy.com]  -->
<!-- edited by Noelle Murata [fiveinchpixie@gmail.com]  -->
<!-- contributed by Irakli Gozalishvili [gozala@mozilla.com] -->


The `private-browsing` module allows you to access the private browsing service
- detecting if it is active and adding callbacks for transitioning into and out
of private browsing mode.

Private browsing is a singleton, so in most cases it will be easiest to store it
in a variable.

    var pb = require("private-browsing");

## Events ##

When the browser starts or stops private browsing mode, the following events
are emitted:

### start ###
Emitted when the browser starts private browsing mode.

    pb.on("start", function() {
      // Do something when the browser starts private browsing mode.
    });


### stop ###
Emitted when the browser stops private browsing mode.


    pb.on("stop", function() {
      // Do something when the browser stops private browsing mode.
    });



## Supported Applications ##

This module is available in all applications. However, only Firefox will ever
transition into or out of private browsing mode. For all other applications,
`pb.active` will always return `false`, and none of the events will be emitted.

<api name="active">
@property {boolean}
This is a boolean. You can read this attribute to determine if private browsing
mode is active. You can also set the attribute to enter or exit private
browsing.

    // If private browsing is active, do something
    if (pb.active)
      doSomething();

    // Enter private browsing mode
    pb.active = true;

    // Exit private browsing mode
    pb.active = false;

</api>

