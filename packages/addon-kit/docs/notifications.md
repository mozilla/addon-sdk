<!-- contributed by Drew Willcoxon [adw@mozilla.com]  -->

The `notifications` module allows you to display transient [toaster]()- or
[Growl]()-style messages to the user.

[toaster]: http://en.wikipedia.org/wiki/Toast_%28computing%29
[Growl]: http://growl.info/

Examples
--------

Here's a typical example.  When the message is clicked, a string is logged to
the console.

    var notifications = require("notifications");
    notifications.notify({
      title: "Jabberwocky",
      text: "'Twas brillig, and the slithy toves",
      data: "did gyre and gimble in the wabe",
      onClick: function (event) {
        console.log(event.data);
      }
    });

This one displays an icon that's stored in the add-on's `data` directory.  (See
the `self` module documentation for more information.)

    var notifications = require("notifications");
    var self = require("self");
    var myIconURL = self.data.url("myIcon.png");
    notifications.notify({
      text: "I have an icon!",
      iconURL: myIconURL
    });


<api name="notify">
@function
  Displays a transient notification to the user.
@param options {object}
  An object with the following keys.  Each is optional.
  @prop [title] {string}
    A string to display as the message's title.
  @prop [text] {string}
    A string to display as the body of the message.
  @prop [iconURL] {string}
    The URL of an icon to display inside the message.  It may be a remote URL,
    a data URI, or a URL returned by the `self` module.
  @prop [onClick] {function}
    A function to be called when the user clicks the message.  It will be passed
    an event object with a single property named `data` whose value is the value
    of the `data` property used in the notification.
  @prop [data] {string}
    A string that will be passed in the event object to `onClick`.
</api>
