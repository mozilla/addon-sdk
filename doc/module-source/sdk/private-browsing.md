<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

<!-- contributed by Paul O'Shannessy [paul@oshannessy.com]  -->
<!-- edited by Noelle Murata [fiveinchpixie@gmail.com]  -->
<!-- contributed by Irakli Gozalishvili [gozala@mozilla.com] -->

The `private-browsing` module allows you to access Firefox's private browsing
mode, detecting if it is active and when its state changes.

This module is available in all applications. However, only Firefox will ever
transition into or out of private browsing mode. For all other applications,
`pb.isActive` will always be `false`, and none of the events will be emitted.

<div class="warning">
The <a href="modules/sdk/private-browsing.html#activate()"><code>activate</code></a> and
<a href="modules/sdk/private-browsing.html#deactivate()"><code>deactivate</code></a> functions
are now deprecated. They will continue to work until version 1.13 of the SDK.
From version 1.13 onwards they will still exist but will have no effect when called.
</div>

<api name="isActive">
@property {boolean}
  This read-only boolean is true if private browsing mode is turned on.
</api>

<api name="activate">
@function
  Turns on private browsing mode.
  <div class="warning">
  This function is deprecated. It will continue to work until version 1.13 of the SDK.
  From version 1.13 onwards it will still exist but will have no effect when called.
  </div>
</api>

<api name="deactivate">
@function
  Turns off private browsing mode.
  <div class="warning">
  This function is deprecated. It will continue to work until version 1.13 of the SDK.
  From version 1.13 onwards it will still exist but will have no effect when called.
  </div>
</api>

<api name="start">
@event
Emitted immediately after the browser enters private browsing mode.

    var pb = require("private-browsing");
    pb.on("start", function() {
      // Do something when the browser starts private browsing mode.
    });

</api>

<api name="stop">
@event
Emitted immediately after the browser exits private browsing mode.

    var pb = require("private-browsing");
    pb.on("stop", function() {
      // Do something when the browser stops private browsing mode.
    });
</api>
