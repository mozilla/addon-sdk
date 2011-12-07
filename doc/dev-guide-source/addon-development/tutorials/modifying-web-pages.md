# Modifying Web Pages #

To modify web pages, use the [`page-mod`](packages/addon-kit/page-mod.html)
module.

`page-mod` enables you to run scripts in the context of a web page. To use
it you need to specify two things:

* the script to run
* a pattern to match the URLs for the pages you want to modify

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
    });

Try it out:

* create a new directory and navigate to it
* run `cfx init`
* open the `lib/main.js` file, and replace its contents with the code above
* run `cfx run`, then run `cfx run` again
* open [mozilla.org](http://www.mozilla.org) in the browser window that opens




You can learn all about [API reference page](packages/addon-kit/page-mod.html)