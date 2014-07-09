# JPM JEP
## Proposal

The current CFX tool used to assist development in addons is a great utility for developing addons, but over the years, several pain points and short-comings have surfaced. With the changes to [Addon Manager](https://github.com/mozilla/addon-sdk/pull/1241) to not require a transpile step and the new `isNative` option added to [toolkit/loader](https://github.com/mozilla/addon-sdk/pull/1279) having backwards-incompatable changes, now is a good time to investigate new options for a new Jetpack tool.

### Benefits of Change

* **JavaScript**: JPM is written in JavaScript as opposed to Python, hopefully increasing contributions. Also assumed that developers are more likely to have a node environment set up rather than Python already. Additionally, node seems to offer much smoother installation and maintenance. We think this combination of familiarity and ease-of-use is a win for Add-on Developers.
* **npm**: JPM will be in a separate repository and served over npm, being in an ecosystem familiar with many JavaScript developers.
* **Remove Legacy Code** CFX has been around for awhile with a lot of fallbacks to support all the SDK changes throughout the years. This makes fixing some issues difficult, or impossible in the cases of having to support every option available. For example, we can get rid of the aliased modules (`require('tabs') === require('sdk/tabs')`).
* **Support new native Loader**: The changes in `toolkit/loader` provides node-style lookup and dynamic module requires. This is currently not compatable with how CFX checks dependencies before running.
* **Use new changes in AOM**: We can take advantage of no longer needing to transpile jetpack directories and injecting `bootstrap.js` and `install.rdf`, resulting in a more transparent source code, and more similar to node modules and Chrome extensions.
* **Explicit Opt-In from Developers**: This is the most **important** feature, IMO, as CFX will be around for some time, with it the familiarity and legacy support. The new loader changes has some backwards-incompatable changes and this should not disrupt developers who are used to the current environment that do not want to change. Those that do want to use the new loader features can explicitly opt-in by using the JPM tool, so that they are aware of the new changes and features.

## Functionality

[Current CFX functionality](https://developer.mozilla.org/en-US/Add-ons/SDK/Tools/cfx).

### New Features

* Currently, any addon with unspecified engines, or engines supporting versions of Firefox where AOM support for native jetpacks does not exist, jpm will add a install.rdf and bootstrap.js file for backwards compatability. This can be overridden with the --force-aom flag, which will not build with these additional files. This is mainly for testing AOM support while still in development.

### Will be Supported

* **init**: generates a directory with all the files needed to start add-on development. Because JPM does not require a transpile step, this is mostly similar to `npm init`, which generates a `package.json`.

* **run/test**: Installs and runs Firefox with the current add-on installed.
  * `-b/--binary <BINARY>`: Sets the binary of Firefox to use
  * `--binary-args <CMDARGS>`: Passes additional binary arguments to Firefox
  * `-p/--profile-dir <PROFILE>`: Start Firefox up with this profile (Should be able to take either a name or a directory)
* **test**: Runs tests for the current add-on or the SDK
  * `-f/--filter <FILENAMES>:<TESTNAMES>`: Filter tests to be run by the expression. Maybe a better interface for this?
* **xpi**: Creates a `xpi` file of the CWD.


## Implementation

Current implementation can be found at [http://github.com/jsantell/jpm](http://github.com/jsantell/jpm). This should be moved into the Mozilla GitHub account.

## Dependencies & Requirements 

Changes in AOM supporting native jetpacks should land before releasing, although the `--retro` flag should support these addons even if the version of Firefox does not yet have AOM changes.

Bugs must be worked out of toolkit/loader since using the new style of native jetpacks will have the Loader's `isNative` flag on. This is needed for any style of native jetpack even not using JPM, but releasing JPM will cause more usage.

## Comments

* [Discuss this JEP further in the Groups page](https://groups.google.com/forum/#!topic/mozilla-labs-jetpack/3ggiCNk0I9g)
