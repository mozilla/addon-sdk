<!-- contributed by Irakli Gozalishvili [gozala@mozilla.com]  -->

The `passwords` module allows consumers to interact with an application's
built-in password management system, in order to:

1. Retrieve credentials for a website, to access the user's account on the
   website and retrieve information about the user.
2. Securely store credentials that are associated with the add-on, to access
   them in subsequent sessions.
3. Store credentials that are associated with a particular website so that both
   add-on and the user (when visiting the site without the add-on) can access
   them in subsequent sessions.

<api name="search">
@function

Module exports `search` function that may be used to locate a credential stored
in the application's built-in login management system.

@param options {object}
An object containing fields associated with a credential being searched. It may
contain any combination of the following fields: `username`, `password`,
`realm`, `url`, `usernameField`, `passwordField`. All those fields are
described in details under the `store` section. Given fields will be used as
search terms to narrow down search results.

Options need to contain `onComplete` callback property which will be called
with an array of matched credentials.

## Searching for add-on associated credential ##

    require("passwords").search({
      realm: "{{add-on}} Login",
      onComplete: function onComplete(credentials) {
        // credentials is an array of all credentials with a given `realm`.
        credentials.forEach(function(credential) {
          // Your logic goes here.
        });
      }
    });

## Searching a credentials for a given user name ##

    require("passwords").search({
      username: "jack",
      onComplete: function onComplete(credentials) {
        // credentials is an array of all credentials with a given `username`.
        credentials.forEach(function(credential) {
          // Your logic goes here.
        });
      }
    });

## Searching web page associated credentials ##

    require("passwords").search({
      url: "http://www.example.com",
      onComplete: function onComplete(credentials) {
        // credentials is an array of all credentials associated with given url.
        credentials.forEach(function(credential) {
          // Your logic goes here.
        });
      }
    });

## Combining search temps together ##

    require("passwords").search({
      url: "http://www.example.com",
      username: "jack",
      realm: "Login",
      onComplete: function onComplete(credentials) {
        // credentials is an array of all credentials associated with given url
        // and given realm for useres with given username. 
        credentials.forEach(function(credential) {
          // Your logic goes here.
        });
      }
    });

</api>

<api name="store">
@function 

Module exports `store` method allowing users to store credentials in the
application built-in login manager. Function takes an `options` object as an
argument containing fields necessary to create a login credential. Properties
of an `options` depend on type of authentication, but regardless of that,
there are two optional callback `onComplete` and `onError` properties that may
be passed to observe success or failure of performed operation.

@param options {object}
An object containing fields associated to a credential being created and stored.
Some fields are necessary for one type of authentication and not for second.
Please see examples to find more details.

@prop username {string}
The user name for the login.

@prop password {string}
The password for the login.

@prop [url] {string}
The `url` to which the login applies, formatted as a URL (for example,
"http://www.site.com"). A port number (":123") may be appended.

_Please note: `http`, `https` and `ftp` URLs should not include path from the
full URL, it will be stripped out if included._

@prop [formSubmitURL] {string}
The URL a form-based login was submitted to. For logins obtained from HTML
forms, this field is the `action` attribute from the form element, with the
with the path removedwith the path removed (for example, "http://www.site.com").
Forms with no `action` attribute default to submitting to their origin URL, so
that should be stored here. (`formSubmitURL` should not include path from the
full URL, it will be stripped out if included).

@prop [realm] {string}
The HTTP Realm for which the login was requested. When an HTTP server sends a
401 result, the WWW-Authenticate header includes a realm to identify the
"protection space." See [RFC 2617](http://tools.ietf.org/html/rfc2617). If the
result did not include a realm, then option must be omitted. For logins
obtained from HTML forms, this field must be omitted. 
For add-on associated credentials this field briefly denotes the credentials
purpose (It is displayed as a description in the application's built-in login
management UI).

@prop [usernameField] {string}
The `name` attribute for the user name input in a form. Non-form logins
must omit this field.

@prop [passwordField] {string}
The `name` attribute for the password input in a form. Non-form logins
must omit this field.

@prop  [onComplete] {function}
The callback function that is called once credential is stored.

@prop [onError] {function}
The callback function that is called if storing a credential failed. Function is
passed an `error` containing a reason of a failure.

## Storing an add-on associated credential ##

Add-ons also may store credentials that are not associated with any web sites.
In such case `realm` string briefly denotes the login's purpose.

    require("passwords").store({
      realm: "User Registration",
      username: "joe",
      password: "SeCrEt123",
    });

## Storing a web page associated credential ##

Most sites use HTML form login based authentication. Following example stores
credentials for such a web site:

    require("passwords").store({
      url: "http://www.example.com",
      formSubmitURL: "http://login.example.com",
      username: "joe",
      usernameField: "uname",
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

## Storing a site authentication login ##

Some web sites use HTTP/FTP authentication mechanism and associated credentials
contain different fields:

    require("passwords").store({
      url: "http://www.example.com",
      realm: "ExampleCo Login",
      username: "joe",
      password: "SeCrEt123",
    });

This would correspond to a login on "http://www.example.com" when the server
sends a reply such as:

    HTTP/1.0 401 Authorization Required
    Server: Apache/1.3.27
    WWW-Authenticate: Basic realm="ExampleCo Login"

If website does not sends `realm` string with `WWW-Authenticate` header then
`realm` property must be omitted.

</api>

<api name="remove">
@function
@param options {object}
When removing a credentials the specified `options` object must exactly match
what was stored (including a `password`). For this reason it is recommended to
chain this function with `search` to make sure that only necessary matches are
removed.

## Removing a credential ##

    require("passwords").search({
      url: "http://www.example.com",
      username: "joe",
      onComplete: function onComplete(credentials) {
        credentials.forEach(require("passwords").remove);
      })
    });

## Changing a credential ##

There is no direct function to change an existing login, still doing it is
rather simple. It's just matter of calling `store` after `remove` succeeds:

    require("passwords").remove({
      realm: "User Registration",
      username: "joe",
      password: "SeCrEt123"
      onComplete: function onComplete() {
        require("passwords").store({
          realm: "User Registration",
          username: "joe",
          password: "{{new password}}"
        })
      }
    });

</api>
