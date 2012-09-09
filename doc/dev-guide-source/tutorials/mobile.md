<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

<div class="warning">Developing add-ons for Firefox Mobile is still
an experimental feature of the SDK. Although the SDK modules used are
stable, the setup instructions and cfx commands are likely to change.
</div>

# Developing for Firefox Mobile #

<span class="aside">
To follow this tutorial you'll need to have
[installed the SDK](dev-guide/tutorials/installation.html)
and learned the
[basics of `cfx`](dev-guide/tutorials/getting-started-with-cfx.html).
</span>

Mozilla has recently decided to
[reimplement the UI for Firefox Mobile on Android](http://starkravingfinkle.org/blog/2011/11/firefox-for-android-native-android-ui/)
 using native Android widgets instead of XUL. With the add-on SDK you
can develop add-ons that run on this new version of Firefox Mobile as
well as on the desktop version of Firefox.

You can use the same code to target both desktop Firefox and Firefox
Mobile, and just specify some extra options to `cfx run`, `cfx test`,
and `cfx xpi` when targeting Firefox Mobile.

Right now only the following modules are fully functional:

* [page-mod](packages/addon-kit/page-mod.html)
* [page-worker](packages/addon-kit/page-worker.html)
* [passwords](packages/addon-kit/passwords.html)
* [private-browsing](packages/addon-kit/private-browsing.html)
* [request](packages/addon-kit/request.html)
* [self](packages/addon-kit/self.html)
* [simple-storage](packages/addon-kit/simple-storage.html)
* [timers](packages/addon-kit/timers.html)

We're working on adding support for the other modules.

This tutorial explains how to run SDK add-ons on an Android
device connected via USB to your development machine.
We'll use the
[Android Debug Bridge](http://developer.android.com/guide/developing/tools/adb.html)
(adb) to communicate between the Add-on SDK and the device.

<img class="image-center" src="static-files/media/mobile-setup-adb.png"/>

It's possible to use the
[Android emulator](http://developer.android.com/guide/developing/tools/emulator.html)
to develop add-ons for Android without access to a device, but it's slow,
so for the time being it's much easier to use the technique described
below.

## Setting up the Environment ##

First you'll need an
[Android device capable of running the native version of
Firefox Mobile](https://wiki.mozilla.org/Mobile/Platforms/Android#System_Requirements).
Then:

* install the
[Nightly build of the native version of Firefox Mobile](https://wiki.mozilla.org/Mobile/Platforms/Android#Download_Nightly)
on the device.
* [enable USB debugging on the device (step 3 of this link only)](http://developer.android.com/guide/developing/device.html#setting-up)

On the development machine:

* install version 1.5 or higher of the Add-on SDK
* install the correct version of the
[Android SDK](http://developer.android.com/sdk/index.html)
for your device
* using the Android SDK, install the
[Android Platform Tools](http://developer.android.com/sdk/installing.html#components)

Next, attach the device to the development machine via USB.

Now open up a command shell. Android Platform Tools will have
installed `adb` in the "platform-tools" directory under the directory
in which you installed the Android SDK. Make sure the "platform-tools"
directory is in your path. Then type:

<pre>
adb devices
</pre>

You should see some output like:

<pre>
List of devices attached
51800F220F01564 device
</pre>

(The long hex string will be different.)

If you do, then `adb` has found your device and you can get started.

## Running Add-ons on Android ##

You can develop your add-on as normal, as long as you restrict yourself
to the supported modules.

When you need to run the add-on, first ensure that Firefox is not running
on the device. Then execute `cfx run` with some extra options:

<pre>
cfx run -a fennec-on-device -b /path/to/adb --mobile-app fennec --force-mobile
</pre>

See ["cfx Options for Mobile Development"](dev-guide/tutorials/mobile.html#cfx-options)
for the details of this command.

In the command shell, you should see something like:

<pre>
Launching mobile application with intent name org.mozilla.fennec
Pushing the addon to your device
Starting: Intent { act=android.activity.MAIN cmp=org.mozilla.fennec/.App (has extras) }
--------- beginning of /dev/log/main
--------- beginning of /dev/log/system
Could not read chrome manifest 'file:///data/data/org.mozilla.fennec/chrome.manifest'.
info: starting
info: starting
zerdatime 1329258528988 - browser chrome startup finished.
</pre>

This will be followed by lots of debug output.

On the device, you should see Firefox launch with your add-on installed.

`console.log()` output from your add-on is written to the command shell,
just as it is in desktop development. However, because there's a
lot of other debug output in the shell, it's not easy to follow.
The command `adb logcat` prints `adb`'s log, so you can filter the
debug output after running the add-on. For example, on Mac OS X
or Linux you can use a command like:

<pre>
adb logcat | grep info:
</pre>

Running `cfx test` is identical:

<pre>
cfx test -a fennec-on-device -b /path/to/adb --mobile-app fennec --force-mobile
</pre>

## <a name="cfx-options">cfx Options for Mobile Development</a> ##

As you see in the quote above, `cfx run` and `cfx test` need four options to
work on Android devices.

<table>
<colgroup>
<col width="30%">
<col width="70%">
</colgroup>

<tr>
  <td>
    <code>-a fennec-on-device</code>
  </td>
  <td>
    This tells the Add-on SDK which application will host the
    add-on, and should be set to "fennec-on-device" when running
    an add-on on Firefox Mobile on a device.
  </td>
</tr>
<tr>
  <td>
    <code>-b /path/to/adb</code>
  </td>
  <td>
    <p>As we've seen, <code>cfx</code> uses the Android Debug Bridge (adb)
    to communicate with the Android device. This tells <code>cfx</code>
    where to find the <code>adb</code> executable.</p>
    <p>You need to supply the full path to the <code>adb</code> executable.</p>
  </td>
</tr>
<tr>
  <td>
    <code>--mobile-app</code>
  </td>
  <td>
    <p>This is the name of the <a href="http://developer.android.com/reference/android/content/Intent.html">
    Android intent</a>. Its value depends on the version of Firefox Mobile
    that you're running on the device:</p>
    <ul>
      <li><code>fennec</code>: if you're running Nightly</li>
      <li><code>fennec_aurora</code>: if you're running Aurora</li>
      <li><code>firefox_beta</code>: if you're running Beta</li>
      <li><code>firefox</code>: if you're running Release</li>
    </ul>
    <p>If you're not sure, run a command like this (on OS X/Linux, or the equivalent on Windows):</p>
    <pre>adb shell pm list packages | grep mozilla</pre>
    <p>You should see "package" followed by "org.mozilla." followed by a string.
    The final string is the name you need to use. For example, if you see:</p>
    <pre>package:org.mozilla.fennec</pre>
    <p>...then you need to specify:</p>
    <pre>--mobile-app fennec</pre>
    <p>This option is not required if you have only one Firefox application
    installed on the device.</p>
  </td>
</tr>
<tr>
  <td>
    <code>--force-mobile</code>
  </td>
  <td>
    <p>This is used to force compatibility with Firefox Mobile, and should
    always be used when running on Firefox Mobile.</p>
  </td>
</tr>
</table>

## Packaging Mobile Add-ons ##

To package a mobile add-on as an XPI, use the command:

<pre>
cfx xpi --force-mobile
</pre>

Actually installing the XPI on the device is a little tricky. The easiest way is
probably to copy the XPI somewhere on the device:

<pre>
adb push my-addon.xpi /mnt/sdcard/
</pre>

Then open Firefox Mobile and type this into the address bar:

<pre>
file:///mnt/sdcard/my-addon.xpi
</pre>

The browser should open the XPI and ask if you
want to install it.

Afterwards you can delete it using `adb` as follows:

<pre>
adb shell
cd /mnt/sdcard
rm my-addon.xpi
</pre>
