import os
import sys
import time
import tempfile
import atexit
import shutil
import shlex
import subprocess
import re

import simplejson as json
import mozrunner
from cuddlefish.prefs import DEFAULT_COMMON_PREFS
from cuddlefish.prefs import DEFAULT_FIREFOX_PREFS
from cuddlefish.prefs import DEFAULT_THUNDERBIRD_PREFS

def follow_file(filename):
    """
    Generator that yields the latest unread content from the given
    file, or None if no new content is available.

    For example:

      >>> f = open('temp.txt', 'w')
      >>> f.write('hello')
      >>> f.flush()
      >>> tail = follow_file('temp.txt')
      >>> tail.next()
      'hello'
      >>> tail.next() is None
      True
      >>> f.write('there')
      >>> f.flush()
      >>> tail.next()
      'there'
      >>> f.close()
      >>> os.remove('temp.txt')
    """

    last_pos = 0
    last_size = 0
    while True:
        newstuff = None
        if os.path.exists(filename):
            size = os.stat(filename).st_size
            if size > last_size:
                last_size = size
                f = open(filename, 'r')
                f.seek(last_pos)
                newstuff = f.read()
                last_pos = f.tell()
                f.close()
        yield newstuff

# subprocess.check_output only appeared in python2.7, so this code is taken
# from python source code for compatibility with py2.5/2.6
class CalledProcessError(Exception):
    def __init__(self, returncode, cmd, output=None):
        self.returncode = returncode
        self.cmd = cmd
        self.output = output
    def __str__(self):
        return "Command '%s' returned non-zero exit status %d" % (self.cmd, self.returncode)

def check_output(*popenargs, **kwargs):
    if 'stdout' in kwargs:
        raise ValueError('stdout argument not allowed, it will be overridden.')
    process = subprocess.Popen(stdout=subprocess.PIPE, *popenargs, **kwargs)
    output, unused_err = process.communicate()
    retcode = process.poll()
    if retcode:
        cmd = kwargs.get("args")
        if cmd is None:
            cmd = popenargs[0]
        raise CalledProcessError(retcode, cmd, output=output)
    return output


class FennecProfile(mozrunner.Profile):
    preferences = {}
    names = ['fennec']

class FennecRunner(mozrunner.Runner):
    profile_class = FennecProfile

    names = ['fennec']

    __DARWIN_PATH = '/Applications/Fennec.app/Contents/MacOS/fennec'

    def __init__(self, binary=None, **kwargs):
        if sys.platform == 'darwin' and binary and binary.endswith('.app'):
            # Assume it's a Fennec app dir.
            binary = os.path.join(binary, 'Contents/MacOS/fennec')

        self.__real_binary = binary

        mozrunner.Runner.__init__(self, **kwargs)

    def find_binary(self):
        if not self.__real_binary:
            if sys.platform == 'darwin':
                if os.path.exists(self.__DARWIN_PATH):
                    return self.__DARWIN_PATH
            self.__real_binary = mozrunner.Runner.find_binary(self)
        return self.__real_binary

class XulrunnerAppProfile(mozrunner.Profile):
    preferences = {}
    names = []

class XulrunnerAppRunner(mozrunner.Runner):
    """
    Runner for any XULRunner app. Can use a Firefox binary in XULRunner
    mode to execute the app, or can use XULRunner itself. Expects the
    app's application.ini to be passed in as one of the items in
    'cmdargs' in the constructor.

    This class relies a lot on the particulars of mozrunner.Runner's
    implementation, and does some unfortunate acrobatics to get around
    some of the class' limitations/assumptions.
    """

    profile_class = XulrunnerAppProfile

    # This is a default, and will be overridden in the instance if
    # Firefox is used in XULRunner mode.
    names = ['xulrunner']

    # Default location of XULRunner on OS X.
    __DARWIN_PATH = "/Library/Frameworks/XUL.framework/xulrunner-bin"
    __LINUX_PATH  = "/usr/bin/xulrunner"

    # What our application.ini's path looks like if it's part of
    # an "installed" XULRunner app on OS X.
    __DARWIN_APP_INI_SUFFIX = '.app/Contents/Resources/application.ini'

    def __init__(self, binary=None, **kwargs):
        if sys.platform == 'darwin' and binary and binary.endswith('.app'):
            # Assume it's a Firefox app dir.
            binary = os.path.join(binary, 'Contents/MacOS/firefox-bin')

        self.__app_ini = None
        self.__real_binary = binary

        mozrunner.Runner.__init__(self, **kwargs)

        # See if we're using a genuine xulrunner-bin from the XULRunner SDK,
        # or if we're being asked to use Firefox in XULRunner mode.
        self.__is_xulrunner_sdk = 'xulrunner' in self.binary

        if sys.platform == 'linux2' and not self.env.get('LD_LIBRARY_PATH'):
            self.env['LD_LIBRARY_PATH'] = os.path.dirname(self.binary)

        newargs = []
        for item in self.cmdargs:
            if 'application.ini' in item:
                self.__app_ini = item
            else:
                newargs.append(item)
        self.cmdargs = newargs

        if not self.__app_ini:
            raise ValueError('application.ini not found in cmdargs')
        if not os.path.exists(self.__app_ini):
            raise ValueError("file does not exist: '%s'" % self.__app_ini)

        if (sys.platform == 'darwin' and
            self.binary == self.__DARWIN_PATH and
            self.__app_ini.endswith(self.__DARWIN_APP_INI_SUFFIX)):
            # If the application.ini is in an app bundle, then
            # it could be inside an "installed" XULRunner app.
            # If this is the case, use the app's actual
            # binary instead of the XUL framework's, so we get
            # a proper app icon, etc.
            new_binary = '/'.join(self.__app_ini.split('/')[:-2] +
                                  ['MacOS', 'xulrunner'])
            if os.path.exists(new_binary):
                self.binary = new_binary

    @property
    def command(self):
        """Returns the command list to run."""

        if self.__is_xulrunner_sdk:
            return [self.binary, self.__app_ini, '-profile',
                    self.profile.profile]
        else:
            return [self.binary, '-app', self.__app_ini, '-profile',
                    self.profile.profile]

    def __find_xulrunner_binary(self):
        if sys.platform == 'darwin':
            if os.path.exists(self.__DARWIN_PATH):
                return self.__DARWIN_PATH
        if sys.platform == 'linux2':
            if os.path.exists(self.__LINUX_PATH):
                return self.__LINUX_PATH
        return None

    def find_binary(self):
        # This gets called by the superclass constructor. It will
        # always get called, even if a binary was passed into the
        # constructor, because we want to have full control over
        # what the exact setting of self.binary is.

        if not self.__real_binary:
            self.__real_binary = self.__find_xulrunner_binary()
            if not self.__real_binary:
                dummy_profile = {}
                runner = mozrunner.FirefoxRunner(profile=dummy_profile)
                self.__real_binary = runner.find_binary()
                self.names = runner.names
        return self.__real_binary

def run_app(harness_root_dir, harness_options,
            app_type, binary=None, profiledir=None, verbose=False,
            timeout=None, logfile=None, addons=None, args=None, norun=None):
    if binary:
        binary = os.path.expanduser(binary)

    if addons is None:
        addons = []
    else:
        addons = list(addons)

    cmdargs = []
    preferences = dict(DEFAULT_COMMON_PREFS)

    if app_type == "xulrunner":
        profile_class = XulrunnerAppProfile
        runner_class = XulrunnerAppRunner
        cmdargs.append(os.path.join(harness_root_dir, 'application.ini'))
    else:
        addons.append(harness_root_dir)
        if app_type == "firefox":
            profile_class = mozrunner.FirefoxProfile
            preferences.update(DEFAULT_FIREFOX_PREFS)
            runner_class = mozrunner.FirefoxRunner
        elif app_type == "thunderbird":
            profile_class = mozrunner.ThunderbirdProfile
            preferences.update(DEFAULT_THUNDERBIRD_PREFS)
            runner_class = mozrunner.ThunderbirdRunner
        elif app_type == "fennec":
            profile_class = FennecProfile
            runner_class = FennecRunner
        else:
            raise ValueError("Unknown app: %s" % app_type)
        if sys.platform == 'darwin':
            cmdargs.append('-foreground')
    
    if args:
        cmdargs.extend(shlex.split(args))

    # tempfile.gettempdir() was constant, preventing two simultaneous "cfx
    # run"/"cfx test" on the same host. On unix it points at /tmp (which is
    # world-writeable), enabling a symlink attack (e.g. imagine some bad guy
    # does 'ln -s ~/.ssh/id_rsa /tmp/harness_result'). NamedTemporaryFile
    # gives us a unique filename that fixes both problems. We leave the
    # (0-byte) file in place until the browser-side code starts writing to
    # it, otherwise the symlink attack becomes possible again.
    fileno,resultfile = tempfile.mkstemp(prefix="harness-result-")
    os.close(fileno)
    harness_options['resultFile'] = resultfile

    def maybe_remove_logfile():
        if os.path.exists(logfile):
            os.remove(logfile)

    logfile_tail = None

    if sys.platform in ['win32', 'cygwin']:
        if not logfile:
            # If we're on Windows, we need to keep a logfile simply
            # to print console output to stdout.
            fileno,logfile = tempfile.mkstemp(prefix="harness-log-")
            os.close(fileno)
        logfile_tail = follow_file(logfile)
        atexit.register(maybe_remove_logfile)

    if logfile:
        logfile = os.path.abspath(os.path.expanduser(logfile))
        maybe_remove_logfile()
        harness_options['logFile'] = logfile

    env = {}
    env.update(os.environ)
    env['MOZ_NO_REMOTE'] = '1'
    env['XPCOM_DEBUG_BREAK'] = 'warn'
    env['NS_TRACE_MALLOC_DISABLE_STACKS'] = '1'
    if norun:
        cmdargs.append("-no-remote")

    # Write the harness options file to the SDK's extension template directory
    # so mozrunner will copy it to the profile it creates.  We don't want
    # to leave such files lying around the SDK's directory tree, so we delete it
    # below after getting mozrunner to create the profile.
    optionsFile = os.path.join(harness_root_dir, 'harness-options.json')
    open(optionsFile, "w").write(str(json.dumps(harness_options)))

    starttime = time.time()

    popen_kwargs = {}
    profile = None

    profile = profile_class(addons=addons,
                            profile=profiledir,
                            preferences=preferences)

    # Delete the harness options file we wrote to the SDK's extension template
    # directory.
    os.remove(optionsFile)

    runner = runner_class(profile=profile,
                          binary=binary,
                          env=env,
                          cmdargs=cmdargs,
                          kp_kwargs=popen_kwargs)

    sys.stdout.flush(); sys.stderr.flush()
    print >>sys.stderr, "Using binary at '%s'." % runner.binary

    # Ensure cfx is being used with Firefox 4.0+.
    # TODO: instead of dying when Firefox is < 4, warn when Firefox is outside
    # the minVersion/maxVersion boundaries.
    version_output = check_output(runner.command + ["-v"])
    # Note: this regex doesn't handle all valid versions in the Toolkit Version
    # Format <https://developer.mozilla.org/en/Toolkit_version_format>, just the
    # common subset that we expect Mozilla apps to use.
    mo = re.search(r"Mozilla (Firefox|Iceweasel) ((\d+)\.\S*)",
                   version_output)
    if not mo:
        # cfx may be used with Thunderbird, SeaMonkey or an exotic Firefox
        # version.
        print """
  WARNING: cannot determine Firefox version; please ensure you are running
  a Mozilla application equivalent to Firefox 4.0 or greater.
  """
    else:
        version = mo.group(3)
        if int(version) < 4:
            print """
  cfx requires Firefox 4 or greater and is unable to find a compatible
  binary. Please install a newer version of Firefox or provide the path to
  your existing compatible version with the --binary flag:

    cfx --binary=PATH_TO_FIREFOX_BINARY"""
            return

        # Set the appropriate extensions.checkCompatibility preference to false,
        # so the tests run even if the SDK is not marked as compatible with the
        # version of Firefox on which they are running, and we don't have to
        # ensure we update the maxVersion before the version of Firefox changes
        # every six weeks.
        #
        # The regex we use here is effectively the same as BRANCH_REGEX from
        # /toolkit/mozapps/extensions/content/extensions.js, which toolkit apps
        # use to determine whether or not to load an incompatible addon.
        #
        br = re.search(r"^([^\.]+\.[0-9]+[a-z]*).*", mo.group(2), re.I)
        if br:
            prefname = 'extensions.checkCompatibility.' + br.group(1)
            profile.preferences[prefname] = False
            # Calling profile.set_preferences here duplicates the list of prefs
            # in prefs.js, since the profile calls self.set_preferences in its
            # constructor, but that is ok, because it doesn't change the set of
            # preferences that are ultimately registered in Firefox.
            profile.set_preferences(profile.preferences)

    print >>sys.stderr, "Using profile at '%s'." % profile.profile
    sys.stderr.flush()
    
    if norun:
        print "To launch the application, enter the following command:"
        print " ".join(runner.command) + " " + (" ".join(runner.cmdargs))
        return 0
    
    runner.start()

    done = False
    output = None
    try:
        while not done:
            time.sleep(0.05)
            if logfile_tail:
                new_chars = logfile_tail.next()
                if new_chars:
                    sys.stderr.write(new_chars)
                    sys.stderr.flush()
            if os.path.exists(resultfile):
                output = open(resultfile).read()
                if output:
                    if output in ['OK', 'FAIL']:
                        done = True
                    else:
                        sys.stderr.write("Hrm, resultfile (%s) contained something weird (%d bytes)\n" % (resultfile, len(output)))
                        sys.stderr.write("'"+output+"'\n")
            if timeout and (time.time() - starttime > timeout):
                raise Exception("Wait timeout exceeded (%ds)" %
                                timeout)
    except:
        runner.stop()
        raise
    else:
        runner.wait(10)
    finally:
        if profile:
            profile.cleanup()

    print >>sys.stderr, "Total time: %f seconds" % (time.time() - starttime)

    if output == 'OK':
        print >>sys.stderr, "Program terminated successfully."
        return 0
    else:
        print >>sys.stderr, "Program terminated unsuccessfully."
        return -1
