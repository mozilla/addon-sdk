The `match-pattern` module can be used to test URLs against simple patterns.


Patterns
--------

There are four kinds of patterns.  The first three use an asterisk as a
glob-style wildcard.  Note that these are not regular expressions.

1.   **A single asterisk** matches any URL with an `http`, `https`, or `ftp`
     scheme.  (For other schemes like `file`, see item 5.)

     *Example:*<br>
     &nbsp;&nbsp;&nbsp;&nbsp;**`*`**

     *Example matching URLs:*<br>
     &nbsp;&nbsp;&nbsp;&nbsp;`http://example.com/`<br>
     &nbsp;&nbsp;&nbsp;&nbsp;`https://example.com/`<br>
     &nbsp;&nbsp;&nbsp;&nbsp;`ftp://example.com/`

2.   **A domain name prefixed with an asterisk and dot** matches any URL of that
     domain or a subdomain, regardless of scheme.

     *Example:*<br>
     &nbsp;&nbsp;&nbsp;&nbsp;**`*.example.com`**

     *Example matching URLs:*<br>
     &nbsp;&nbsp;&nbsp;&nbsp;`http://example.com/`<br>
     &nbsp;&nbsp;&nbsp;&nbsp;`http://foo.example.com/`<br>
     &nbsp;&nbsp;&nbsp;&nbsp;`http://bar.foo.example.com/`<br>
     &nbsp;&nbsp;&nbsp;&nbsp;`https://example.com/`<br>
     &nbsp;&nbsp;&nbsp;&nbsp;`https://foo.example.com/`<br>
     &nbsp;&nbsp;&nbsp;&nbsp;`ftp://example.com/`<br>
     &nbsp;&nbsp;&nbsp;&nbsp;`ftp://foo.example.com/`

3.   **A URL followed by an asterisk** matches that URL and any URL prefixed
     with the pattern.

     *Example:*<br>
     &nbsp;&nbsp;&nbsp;&nbsp;**`https://example.com/*`**

     *Example matching URLs:*<br>
     &nbsp;&nbsp;&nbsp;&nbsp;`https://example.com/`<br>
     &nbsp;&nbsp;&nbsp;&nbsp;`https://example.com/foo`<br>
     &nbsp;&nbsp;&nbsp;&nbsp;`https://example.com/foo/bar`

4.   **A URL** matches only that URL.

     *Example:*<br>
     &nbsp;&nbsp;&nbsp;&nbsp;**`http://example.com/`**

     *Example matching URLs:*<br>
     &nbsp;&nbsp;&nbsp;&nbsp;`http://example.com/`

5.   **A scheme followed by an asterisk** matches all URLs with that scheme.  To
     match local files, use `file://*`.  To match files stored in your add-on's
     `data` directory, use `resource://*`.

     *Example:*<br>
     &nbsp;&nbsp;&nbsp;&nbsp;**`file://*`**

     *Example matching URLs:*<br>
     &nbsp;&nbsp;&nbsp;&nbsp;`file://C:/Users/User/Desktop/test-file.html`<br>
     &nbsp;&nbsp;&nbsp;&nbsp;`file:///home/user/test-file.png`<br>

Examples
--------

    var { MatchPattern } = require("match-pattern");
    var pattern = new MatchPattern("http://example.com/*");
    console.log(pattern.test("http://example.com/"));       // true
    console.log(pattern.test("http://example.com/foo"));    // true
    console.log(pattern.test("http://foo.com/"));           // false!

<api name="MatchPattern">
@class
<api name="MatchPattern">
@constructor
  This constructor creates match pattern objects that can be used to test URLs.
@param pattern {string}
  The pattern to use.  See Patterns above.
</api>

<api name="test">
@method
  Tests a URL against the match pattern.
@param url {string}
  The URL to test.
@returns {boolean}
  True if the URL matches the pattern and false otherwise.
</api>
</api>
