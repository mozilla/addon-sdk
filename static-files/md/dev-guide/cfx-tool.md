<!-- contributed by Noelle Murata [fiveinchpixie@gmail.com] -->

The cfx command-line tool gives you access to the SDK documentation and
development servers as well as testing, running, and building packages.

Any of the cfx commands can be run with the following options:

Global Options:

    -h, --help        - show this help message and exit
    -v, --verbose     - enable lots of output


Global Commands
---------------

**`cfx docs`**

This command launches a mini-server on the localhost to view web-based
documentation in a new Firefox window.

**`cfx sdocs`**

Executing this command builds a tarball of the .md and .json files as well as
the JavaScript needed to render the Markdown correctly. The tarball will be
saved to the directory in which the command was executed.

**`cfx testcfx`**

This will run a number of tests on the cfx tool, including tests against the
documentation. Use `cfx testcfx -v` for the specific list of tests.

**`cfx testpkgs`**

This will test all of the available CommonJS packages. Note that the number
of tests run and their success depends on what application they are run
with, and which binary is used.

**`cfx testex`**

This will test all available example code. Note that the number
of tests run and their success depends on what application they are run
with, and which binary is used.

**`cfx testall`**

This will test *everything*: the cfx tool, all available CommonJS packages,
and all examples.

Run options:

    -a APP, --app=APP            application to run: firefox (default), xulrunner,
                                 fennec, or thunderbird

    -b BINARY, --binary=BINARY   path to application binary

    -P PROFILEDIR, --profiledir=PROFILEDIR
                                 profile directory to pass to the application

    -r, --use-server             use development server

    -f LOGFILE, --logfile=LOGFILE
                                 log console output to file


Test options:

    -d, --dep-tests              include tests for all dependencies

    -x ITERATIONS, --times=ITERATIONS
                                 number of times to run tests

**`cfx develop`**

This initiates an instance of a host application in development mode,
and allows you to pipe commands into it from another shell without
having to constantly restart it. Aside from convenience, for SDK
Platform developers this has the added benefit of making it easier to
detect leaks.

For example, in shell A, type:

    cfx develop

In shell B, type:

    cfx test -r

This will send `cfx test -r` output to shell A. If you repeat the
command in shell B, `cfx test -r` output will appear again in shell A
without restarting the host application.


Package-Specific Commands
-------------------------

**`cfx init`**

Just create a new directory, change into it, and run `cfx init`.

This command will create an skeleton addon, as a starting point for your
own add-on development, with the following file structure:

    README.md
    package.json
    data/
    lib/
        main.js
    tests/
        test-main.js
    docs/
        main.md

**`cfx xpcom`**

This tool is used to build xpcom objects.

Compile options:

    -s MOZ_SRCDIR, --srcdir=MOZ_SRCDIR
                                 Mozilla source directory

    -o MOZ_OBJDIR, --objdir=MOZ_OBJDIR
                                 Mozilla object directory

Package creation/run options:

    -p PKGDIR, --pkgdir=PKGDIR   package dir containing the package.json; default is
                                 the current dir

    -t TEMPLATEDIR, --templatedir=TEMPLATEDIR
                                 XULRunner application extension template

    -k EXTRA_PACKAGES, --extra-packages=EXTRA_PACKAGES
                                 extra packages to include, comma-separated

    -g CONFIG, --use-config=CONFIG
                                 use named config from local.json

**`cfx xpi`**

<span class="aside"> For more information on how XPIs are generated,
see the [XPI Generation](#guide/xpi) reference.</span>

This tool is used to build the XPI file that you can distribute by submitting it to
[addons.mozilla.org][].

[addons.mozilla.org]: http://addons.mozilla.org

Compile options:

    -u UPDATE_URL, --update-url=UPDATE_URL
                                 update URL in install.rdf

    -l UPDATE_LINK, --update-link=UPDATE_LINK
                                 generate update.rdf


Package creation/run options:

    -p PKGDIR, --pkgdir=PKGDIR   package dir containing the package.json; default is
                                 the current dir

    -t TEMPLATEDIR, --templatedir=TEMPLATEDIR
                                 XULRunner application extension template

    -k EXTRA_PACKAGES, --extra-packages=EXTRA_PACKAGES
                                 extra packages to include, comma-separated

    -g CONFIG, --use-config=CONFIG
                                 use named config from local.json

    --static-args=STATIC_ARGS
                                 extra harness options as JSON

**`cfx run`**

This tool is used to run the extension code.

Run options:

    -a APP, --app=APP            application to run: firefox (default), xulrunner,
                                 fennec, or thunderbird

    -b BINARY, --binary=BINARY   path to application binary

    -P PROFILEDIR, --profiledir=PROFILEDIR
                                 profile directory to pass to the application

    -r, --use-server             use development server

    -f LOGFILE, --logfile=LOGFILE
                                 log console output to file

Package creation/run options:

    -p PKGDIR, --pkgdir=PKGDIR   package dir containing the package.json; default is
                                 the current dir

    -t TEMPLATEDIR, --templatedir=TEMPLATEDIR
                                 XULRunner application extension template

    -k EXTRA_PACKAGES, --extra-packages=EXTRA_PACKAGES
                                 extra packages to include, comma-separated

    -g CONFIG, --use-config=CONFIG
                                 use named config from local.json

    --static-args=STATIC_ARGS
                                 extra harness options as JSON

**`cfx test`**

Run available tests for the specified package.

Run options:

    -a APP, --app=APP            application to run: firefox (default), xulrunner,
                                 fennec, or thunderbird

    -b BINARY, --binary=BINARY   path to application binary

    -P PROFILEDIR, --profiledir=PROFILEDIR
                                 profile directory to pass to the application

    -r, --use-server             use development server

    -f LOGFILE, --logfile=LOGFILE
                                 log console output to file

Test options:

    -d, --dep-tests              include tests for all dependencies

    -x ITERATIONS, --times=ITERATIONS
                                 number of times to run tests


Configuring local.json
----------------------

Define configuration options using a file called `local.json` which should live
in the root directory of your SDK. You can specify command-line options for cfx
using a key called "configs".

For example:

    {
        "configs": {
            "ff35": ["-a", "firefox", "-b", "/home/me/firefox-3.5/firefox-bin"]
        }
    }

Using the above configuration, you can run:

    cfx testall --use-config=ff35

And it would be equivalent to:

    cfx testall -a firefox -b /home/me/firefox-3.5/firefox-bin

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

    cfx run --static-args="{ \"foo\": \"Hello from the command line\" }"

Then your console should contain this:

    info: Hello from the command line

The `--static-args` option is recognized by two of the package-specific
commands: `run` and `xpi`.  When used with the `xpi` command, the JSON is
packaged with the XPI's harness options and will therefore be used whenever the
program in the XPI is run.
