# Modifying Web Pages #

There are two main ways you can use the SDK to modify web pages.

* to modify any pages matching a particular URL pattern (for
example:"mozilla.com" or "*.org") as they are loaded, use
[`page-mod`](dev-guide/addon-development/tutorials/modifying-web-pages.html#page-mod)
* to modify the page hosted by a particular tab (for example,
the currently active tab) use
[`tab.attach()`](dev-guide/addon-development/tutorials/modifying-web-pages.html#tab-attach)

## <a name="page-mod">Modifying Pages Based on URL</a> ##

`page-mod` enables you to attach scripts to web pages which match a particular
URL pattern.

To use it you need to specify two things:

* the script to run
* a pattern to match the URLs for the pages you want to modify

Here's a simple example. The script is supplied as the `contentScript` option,
and the URL pattern is given as the `include` option:

    // Import the page-mod API
    var pageMod = require("page-mod");

    // Create a page mod
    // It will run a script whenever a ".org" URL is loaded
    // The script replaces the page contents with a message
    pageMod.PageMod({
      include: "*.org",
      contentScript: 'document.body.innerHTML = ' +
                     ' "<h1>Page matches ruleset</h1>";'
    });

Try it out:

* create a new directory and navigate to it
* run `cfx init`
* open the `lib/main.js` file, and replace its contents with the code above
* run `cfx run`, then run `cfx run` again
* open [ietf.org](http://www.ietf.org) in the browser window that opens

This is what you should see:

<img src="static-files/media/screenshots/pagemod-ietf.png"
alt="ietf.org eaten by page-mod" />

## <a name="tab-attach">Modifying the Page Hosted by a Tab</a> ##

Here's a simple example:

    // Import the page-mod API
    var pageMod = require("page-mod");

    // Create a page mod
    // It will run a script whenever a ".org" URL is loaded
    // The script replaces the page contents with a message
    pageMod.PageMod({
      include: "*.org",
      contentScript: 'document.body.innerHTML = ' +
                     ' "<h1>Page matches ruleset</h1>";'


You can learn all about [API reference page](packages/addon-kit/page-mod.html)