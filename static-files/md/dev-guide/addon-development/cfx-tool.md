<!-- contributed by Noelle Murata [fiveinchpixie@gmail.com] -->
# cfx #

The cfx command-line tool gives you access to the SDK documentation and
development servers as well as testing, running, and building packages.

cfx usage is:

<pre>
  cfx [options] command [command-specific options]
</pre>

"Options" are global options applicable to the tool itself or to all
commands (for example `--help`). "Command-specific options" are only
applicable to some subset of the commands.

Global Options
--------------

Any of the cfx commands can be run with the following options:

<pre>
  -h, --help        - show a help message and exit
  -v, --verbose     - enable lots of output
</pre>

Commands
--------

### Supported Commands ###

#### `cfx docs` ####

This command launches a mini-server on the localhost to view web-based
documentation in a new Firefox window.

#### `cfx init` ####

Just create a new directory, change into it, and run `cfx init`.

This command will create an skeleton add-on, as a starting point for your
own add-on development, with the following file structure:

<pre>
  README.md
  package.json
  data/
  lib/
      main.js
  tests/
      test-main.js
  docs/
      main.md
</pre>

#### `cfx xpi` ####

<span class="aside"> For more information on how XPIs are generated,
see the [XPI Generation](#guide/module-development/xpi) reference.</span>

This tool is used to build the XPI file that you can distribute by submitting
it to [addons.mozilla.org][].

[addons.mozilla.org]: http://addons.mozilla.org

**Supported Options:**

<pre>
  --extra-packages=EXTRA_PACKAGES
                               extra packages to include, comma-separated

  -g CONFIG, --use-config=CONFIG
                               use named config from local.json

  --pkgdir=PKGDIR              package dir containing the package.json;
                               default is the current dir

  --static-args=STATIC_ARGS
                               extra harness options as JSON

  --templatedir=TEMPLATEDIR
                               XULRunner application extension template

  --update-link=UPDATE_LINK
                               generate update.rdf

  --update-url=UPDATE_URL
                               update URL in install.rdf
</pre>

**Internal Options**

<pre>
  --keydir=KEYDIR              directory holding private keys; default is
                               ~/.jetpack/keys
</pre>

#### `cfx run` ####

This command is used to run the add-on.

**Supported Options:**

<pre>
  -a APP, --app=APP            application to run: firefox (default),
                               xulrunner, fennec, or thunderbird

  -b BINARY, --binary=BINARY   path to application binary

  --extra-packages=EXTRA_PACKAGES
                               extra packages to include, comma-separated

  -g CONFIG, --use-config=CONFIG
                               use named config from local.json

  -p PROFILEDIR, --profiledir=PROFILEDIR
                               profile directory to pass to the application

  --pkgdir=PKGDIR              package dir containing the package.json;
                               default is the current dir

  --static-args=STATIC_ARGS
                               extra harness options as JSON

  --templatedir=TEMPLATEDIR
                               XULRunner application extension template
</pre>

**Internal Options**

<pre>
  --addons=ADDONS              paths of add-ons to install, comma-separated

  --e10s                       enable out-of-process Jetpacks

  --keydir=KEYDIR              directory holding private keys; default is
                               ~/.jetpack/keys
</pre>

#### `cfx test` ####

Run available tests for the specified package.

**Supported Options:**

<pre>
  -a APP, --app=APP            application to run: firefox (default), xulrunner,
                               fennec, or thunderbird

  -b BINARY, --binary=BINARY   path to application binary

  --dependencies               include tests for all dependencies

  -f FILTER, --filter=FILTER
                               only run tests whose filenames match FILTER, a regexp

  -g CONFIG, --use-config=CONFIG
                               use named config from local.json

  -p PROFILEDIR, --profiledir=PROFILEDIR
                               profile directory to pass to the application

  --times=ITERATIONS
                               number of times to run tests
</pre>

**Experimental Options**

<pre>
  --use-server                 use development server
</pre>

**Internal Options**

<pre>
  --addons=ADDONS              paths of add-ons to install, comma-separated

  --e10s                       enable out-of-process Jetpacks

  --keydir=KEYDIR              directory holding private keys; default is
                               ~/.jetpack/keys

  --logfile=LOGFILE
                               log console output to file

  --profile-memory=PROFILEMEMORY
                               profile memory usage (default is false)

  --test-runner-pkg=TEST_RUNNER_PKG
                               name of package containing test runner program
                               (default is test-harness)
</pre>

### Experimental Commands ###

#### `cfx develop` ####

This initiates an instance of a host application in development mode,
and allows you to pipe commands into it from another shell without
having to constantly restart it. Aside from convenience, for SDK
Platform developers this has the added benefit of making it easier to
detect leaks.

For example, in shell A, type:

<pre>
  cfx develop
</pre>

In shell B, type:

<pre>
  cfx test --use-server
</pre>

This will send `cfx test --use-server` output to shell A. If you repeat the
command in shell B, `cfx test --use-server` output will appear again in shell A
without restarting the host application.

### Internal Commands ###

#### `cfx sdocs` ####

Executing this command builds a tarball of the .md and .json files as well as
the JavaScript needed to render the Markdown correctly. The tarball will be
saved to the directory in which the command was executed.

#### `cfx testcfx` ####

This will run a number of tests on the cfx tool, including tests against the
documentation. Use `cfx testcfx -v` for the specific list of tests.

#### `cfx testpkgs` ####

This will test all of the available CommonJS packages. Note that the number
of tests run and their success depends on what application they are run
with, and which binary is used.

**Options:**

<pre>
  -a APP, --app=APP            application to run: firefox (default), xulrunner,
                               fennec, or thunderbird

  --addons=ADDONS              paths of add-ons to install, comma-separated

  -b BINARY, --binary=BINARY   path to application binary

  --dependencies               include tests for all dependencies

  -f FILTER, --filter=FILTER
                               only run tests whose filenames match FILTER, a regexp

  -g CONFIG, --use-config=CONFIG
                               use named config from local.json

  --keydir=KEYDIR              directory holding private keys; default is
                               ~/.jetpack/keys

  --logfile=LOGFILE
                               log console output to file

  -p PROFILEDIR, --profiledir=PROFILEDIR
                               profile directory to pass to the application

  --profile-memory=PROFILEMEMORY
                               profile memory usage (default is false)

  --test-runner-pkg=TEST_RUNNER_PKG
                               name of package containing test runner program
                               (default is test-harness)

  --times=ITERATIONS
                               number of times to run tests

  --use-server                 use development server
</pre>

#### `cfx testex` ####

This will test all available example code. Note that the number
of tests run and their success depends on what application they are run
with, and which binary is used.


**Options:**

<pre>
  -a APP, --app=APP            application to run: firefox (default), xulrunner,
                               fennec, or thunderbird

  --addons=ADDONS              paths of add-ons to install, comma-separated

  -b BINARY, --binary=BINARY   path to application binary

  --dependencies               include tests for all dependencies

  -f FILTER, --filter=FILTER
                               only run tests whose filenames match FILTER, a regexp

  -g CONFIG, --use-config=CONFIG
                               use named config from local.json

  --keydir=KEYDIR              directory holding private keys; default is
                               ~/.jetpack/keys

  --logfile=LOGFILE
                               log console output to file

  -p PROFILEDIR, --profiledir=PROFILEDIR
                               profile directory to pass to the application

  --profile-memory=PROFILEMEMORY
                               profile memory usage (default is false)

  --test-runner-pkg=TEST_RUNNER_PKG
                               name of package containing test runner program
                               (default is test-harness)

  --times=ITERATIONS
                               number of times to run tests

  --use-server                 use development server
</pre>

#### `cfx testall` ####

This will test *everything*: the cfx tool, all available CommonJS packages,
and all examples.

**Options:**

<pre>
  -a APP, --app=APP            application to run: firefox (default), xulrunner,
                                 fennec, or thunderbird

  --addons=ADDONS              paths of add-ons to install, comma-separated

  -b BINARY, --binary=BINARY   path to application binary

  --dependencies               include tests for all dependencies

  -f FILTER, --filter=FILTER
                               only run tests whose filenames match FILTER, a regexp

  -g CONFIG, --use-config=CONFIG
                               use named config from local.json

  --keydir=KEYDIR              directory holding private keys; default is
                               ~/.jetpack/keys

  --logfile=LOGFILE
                               log console output to file

  -p PROFILEDIR, --profiledir=PROFILEDIR
                               profile directory to pass to the application

  --profile-memory=PROFILEMEMORY
                               profile memory usage (default is false)

  --test-runner-pkg=TEST_RUNNER_PKG
                               name of package containing test runner program
                               (default is test-harness)

  --times=ITERATIONS
                                 number of times to run tests

  --use-server                 use development server
</pre>

Configuring local.json
----------------------

Define configuration options using a file called `local.json` which should live
in the root directory of your SDK. You can specify command-line options for cfx
using a key called "configs".

For example:

<pre>
  {
      "configs": {
          "ff35": ["-a", "firefox", "-b", "/home/me/firefox-3.5/firefox-bin"]
      }
  }
</pre>

Using the above configuration, you can run:

<pre>
  cfx test --use-config=ff35
</pre>

And it would be equivalent to:

<pre>
  cfx test -a firefox -b /home/me/firefox-3.5/firefox-bin
</pre>

This method of defining configuration options can be used for all of the run,
build, and test tools. If "default" is defined in the `local.json` cfx will use
that configuration unless otherwise specified.


Passing Arguments to Programs
-----------------------------

You can use the cfx `--static-args` option to pass arbitrary data to your
program.  This may be especially useful if you run cfx from a script.

The value of `--static-args` must be a JSON string.  The object encoded by the
JSON becomes the `staticArgs` member of the `options` object passed as the first
argument to your program's `main` function.  The default value of
`--static-args` is `"{}"` (an empty object), so you don't have to worry about
checking whether `staticArgs` exists in `options`.

For example, if your `main.js` looks like this:

    exports.main = function (options, callbacks) {
      console.log(options.staticArgs.foo);
    };

And you run cfx like this:

<pre>
  cfx run --static-args="{ \"foo\": \"Hello from the command line\" }"
</pre>

Then your console should contain this:

<pre>
  info: Hello from the command line
</pre>

The `--static-args` option is recognized by two of the package-specific
commands: `run` and `xpi`.  When used with the `xpi` command, the JSON is
packaged with the XPI's harness options and will therefore be used whenever the
program in the XPI is run.
