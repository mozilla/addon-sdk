<!-- contributed by Irakli Gozalishvili [gozala@mozilla.com]  -->

Add-ons often need to securely store passwords to an external sites, web
applications, and so on. This module provides API for storing and searching
credentials in the application built-in password manager.

<api name="create">
@function 

Module exports `create` method allowing users to store credentials in the
application built-in password manager. Function takes `options` object as an
argument containing fields necessary to create a login credential. Properties
of an `options` depend on type of an authentication but regardless of that,
there are two optional callback `onDone` and `onError` properties that may
be passed to observe success or failure of performed operation.


@param options {object}
An object containing fields associated to a credential being created. Some
fields are necessary for one type of authentication and not for second. Please
see examples to find more details.

@prop user {string}
The user name for the login.

@prop password {string}
The password for the login.

@prop [url] {string}
The `url` to which the login applies, formatted as a URL (for example,
"http://www.site.com"). A port number (":123") may be appended.

@prop [formSubmitURL] {string}
The URL a form-based login was submitted to. For logins obtained from HTML
forms, this field is the `action` attribute from the form element, with the

@prop [realm] {string}
The HTTP Realm for which the login was requested. When an HTTP server sends a
401 result, the WWW-Authenticate header includes a realm to identify the
"protection space." See [RFC 2617](http://tools.ietf.org/html/rfc2617). If the
result did not include a realm, then option must be omitted. For logins
obtained from HTML forms, this field must be omitted. 

@prop [userField] {string}
The `name` attribute for the user name input in a form. Non-form logins
must omit this field.

@prop [passwordField] {string}
The `name` attribute for the password input in a form. Non-form logins
must omit this field.

@prop  [onDone] {function}
The callback function that is called once `login` is stored in the manager.

@prop [onError] {function}
The callback function that is called if storing a login failed. Function is
passed an `error` containing a reason of a failure.

## Creating a login for a web page ##

Most sites use HTML form login based authentication. Following example stores
credentials for such a web site:

    require("login-manager").create({
      url: "http://www.example.com",
      formSubmitURL: "http://login.example.com",
      user: "joe",
      userField: "uname",
      password: "SeCrEt123",
      passwordField: "pword"
    });


This login would correspond to a form on "http://www.example.com/login" with
following HTML:

    <form action="http://login.example.com/foo/authenticate.cgi">
          <div>Please log in.</div>
          <label>Username:</label> <input type="text" name="uname">      
          <label>Password:</label> <input type="password" name="pword">    
    </form>

## Creating a site authentication login ##

Some web sites use HTTP/FTP authentication mechanism and associated credentials
contain different fields:

    require("login-manager").create({
      url: "http://www.example.com",
      realm: "ExampleCo Login",
      user: "joe",
      password: "SeCrEt123",
    });

This would correspond to a login on "http://www.example.com" when the server
sends a reply such as:

    HTTP/1.0 401 Authorization Required
    Server: Apache/1.3.27
    WWW-Authenticate: Basic realm="ExampleCo Login"

If website does not sends `realm` string with `WWW-Authenticate` header then
`realm` property must be omitted.

## Creating a local add-on login ##

Add-ons also may store credentials that are not associated with any web sites.
In such case `realm` string briefly denotes the login's purpose.

    require("login-manager").create({
      realm: "User Registration",
      user: "joe",
      password: "SeCrEt123",
    });
</api>

<api name="find">
@function

Module exports `find` function that may be used to locate a credential stored
in the applications built-in login manager.

@param options {object}
An object containing fields associated to a credential being searched. It may
contain any of the fields described by `create`. Those properties will be used
to narrow down a search results.

The `onDone` callback is called with an array of matched logins.

    require("login-manager").find({
      url: "http://www.example.com",
      user: "joe",
      onDone: function onDone(logins) {
        logins.forEach(function(login) {
          // Do something with a `login.user` & `login.password`
        });
      })
    });
</api>

<api name="remove">
@function
@param options {object}
When removing a password the specified `options` object must exactly match what
was stored (including a `password`). For this reason it is recommended to chain
this function with `find` to make sure that only necessary matches are removed.

The `onError` callback is called on attempt to remove a non-existing login.

    require("login-manager").find({
      url: "http://www.example.com",
      user: "joe",
      onDone: function onDone(logins) {
        logins.forEach(require("login-manager").remove);
      })
    });
</api>

## Changing a login ##

There is no direct function to change an existing login, still doing it is
rather simple. It's just matter of calling `create` after `remove` succeeds:

    require("login-manager").remove({
      realm: "User Registration",
      user: "joe",
      password: "SeCrEt123"
      onDone: function onDone() {
        require("login-manager").create({
          realm: "User Registration",
          user: "joe",
          password: "{{new password}}"
        })
      }
    });

