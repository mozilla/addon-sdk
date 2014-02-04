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

* `--retro`: If the `retro` flag is set to true, JPM will add a `install.rdf` and `bootstrap.js` to the addon when bundling up the addon. This allows us to test and configure JPM while AOM changes are under development, and to be used if the target version of Firefox does not yet have the AOM changes to support new native jetpacks. This will be a temporary option that will be deprecated once the AOM changes have landed, and removed perhaps 2-3 Firefox releases afterward. This will always show a warning message.

### Will be Supported

* **init**: generates a directory with all the files needed to start add-on development. Because JPM does not require a transpile step, this is mostly similar to `npm init`, which generates a `package.json`.

* **run/test**: Installs and runs Firefox with the current add-on installed.
  * `-b/--binary <BINARY>`: Sets the binary of Firefox to use
  * `--binary-args <CMDARGS>`: Passes additional binary arguments to Firefox
  * `-p/--profile-dir <PROFILE>`: Start Firefox up with this profile (Should be able to take either a name or a directory)
  * `-o/--overload/--overload-modules`: Bake the SDK add-ons into the addon itself so it uses the local repo SDK rather than the ones built into Firefox. Should be able to consume a PATH to the SDK or use a global ENV var.
* **test**: Runs tests for the current add-on or the SDK
  * `-f/--filter <FILENAMES>:<TESTNAMES>`: Filter tests to be run by the expression. Maybe a better interface for this?
* **xpi**: Creates a `xpi` file of the CWD.

### Will be Supported Eventually (not high priority)

* `run --pkgdir`: Uses pkgdir instead of CWD.
* `run --addons`: Path of other addons to install. Should be able to consume a working directory or an xpi.
* `run --e10s`: Not currently implemented.
* `run --static-args`: [Passes in arguments into the addon](https://developer.mozilla.org/en-US/Add-ons/SDK/Tools/cfx#Passing_Static_Arguments). Is this needed?
* `test --logfile`: Dumps a logfile of test results.
* `test --profile-memory`: Dumps a log of memory tests.

### Will NOT be Supported

* `--test-packges/--test-addons`: An alias for the old `testaddons` and `testpkgs`, do we need these to be two separate commands? A test should set up an addon on its own and be filterable with `-f` if we want to separate the two.
* `test --test-runner-package`: Name of package containing test-runner program. Defaults to `test-harness`. Probably should not implement this until we can run tests with any harness.
* `xpi --update-link, xpi --update-url`: These should probably be handled in the `package.json`.
* `run --keydir`: Location of signing keys.
* `test --times`: Runs tests x number of times.
* `run --extra-packages`: As dependencies will be handled via `dependencies` in the `package.json` with npm, this is not necessary.
* `run -g/--use-config`: This uses a `local.json` file to store arguments to be passed into jpm. [How it currently works with cfx](https://developer.mozilla.org/en-US/Add-ons/SDK/Tools/cfx#Using_Configurations). With the new tool being written in JS, if a developer wants to do this, they can easily script it. May be useful, not not important (IMO).
* `run -a/--app`: Only `firefox` is currently supported, although this is needed for Fennec. Maybe we can have a better way of Fennec support.
* `run --no-run`: Prints the command used to start the add-on. Necessary? Can just ensure `-v` prints this.
* `run --templatedir`: Uses a template from `app-extension`. I do not think this is necessary.
* `test --dependencies`: Runs tests on all the dependencies as well, possibly including SDK tests. Necessary?
* `testcfx`: JPM will contain its own tests run with `npm install`.
* `testex`: Example code is no longer in the SDK repo.

## Implementation

Current implementation can be found at [http://github.com/jsantell/jpm](http://github.com/jsantell/jpm). This should be moved into the Mozilla GitHub account.

## Dependencies & Requirements 

Changes in AOM supporting native jetpacks should land before releasing, although the `--retro` flag should support these addons even if the version of Firefox does not yet have AOM changes.

Bugs must be worked out of toolkit/loader since using the new style of native jetpacks will have the Loader's `isNative` flag on. This is needed for any style of native jetpack even not using JPM, but releasing JPM will cause more usage.

## Comments

* [Discuss this JEP further in the Groups page](https://groups.google.com/forum/#!topic/mozilla-labs-jetpack/3ggiCNk0I9g)
