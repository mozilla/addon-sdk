<!-- contributed by Paul O’Shannessy [paul@oshannessy.com]  -->
<!-- edited by Noelle Murata [fiveinchpixie@gmail.com]  -->


The `private-browsing` module allows you to access the private browsing service
- detecting if it is active and adding callbacks for transitioning into and out
of private browsing mode.

Private browsing is a singleton, so in most cases it will be easiest to store it
in a variable.

    var pb = require("private-browsing");


## Attributes ##

<api name="active">
@property {boolean}
This is a boolean. You can read this attribute to determine if private browsing
mode is active. You can also set the attribute to enter or exit private
browsing.
</api>

    // If browser is in private browsing mode
    if (pb.active)
      doSomething();
    
    // Enter private browsing mode
    pb.active = true;
    
    // Exit private browsing mode
    pb.active = false;


##Events##

When browser enters or leaves private browsing mode following events are
emitted:

###enter###
Emitted when the browser enters private browsing mode.
    
    pb.on('enter', function() {
      // do something when browser enters private mode
    });
    
 
###exit###
Emitted when the browser leaves private browsing mode.

    
    pb.on('exit', function() {
      // do something when browser leaves private mode
    });
    


## Supported Applications ##

This module is available in all applications. However, only Firefox will ever
transition into or out of private browsing mode. For all other applications,
`pb.active` will always return `null`, and none of the events will be emitted.

