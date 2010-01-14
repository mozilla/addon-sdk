# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is Mozilla Corporation Code.
#
# The Initial Developer of the Original Code is
# Mikeal Rogers.
# Portions created by the Initial Developer are Copyright (C) 2008-2009
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#  Mikeal Rogers <mikeal.rogers@gmail.com>
#  Clint Talbert <ctalbert@mozilla.com>
#  Henrik Skupin <hskupin@mozilla.com>
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****

import os
import sys
import copy
import tempfile
import signal
import commands
import zipfile
import optparse
import killableprocess
import subprocess
from xml.etree import ElementTree
from distutils import dir_util
from time import sleep

try:
    import simplejson
except ImportError:
    import json as simplejson

import logging
logger = logging.getLogger(__name__)

# Use dir_util for copy/rm operations because shutil is all kinds of broken
copytree = dir_util.copy_tree
rmtree = dir_util.remove_tree

if sys.platform != 'win32':
    import pwd

def findInPath(fileName, path=os.environ['PATH']):
    dirs = path.split(os.pathsep)
    for dir in dirs:
        if os.path.isfile(os.path.join(dir, fileName)):
            return os.path.join(dir, fileName)
        if os.name == 'nt' or sys.platform == 'cygwin':
            if os.path.isfile(os.path.join(dir, fileName + ".exe")):
                return os.path.join(dir, fileName + ".exe")
    return None

stdout = sys.stdout
stderr = sys.stderr
stdin = sys.stdin

def run_command(cmd, env=None, **kwargs):
    """Run the given command in killable process."""
    killable_kwargs = {'stdout':stdout ,'stderr':stderr, 'stdin':stdin}
    killable_kwargs.update(kwargs)

    if sys.platform != "win32":
        return killableprocess.Popen(cmd, preexec_fn=lambda : os.setpgid(0, 0),
                                     env=env, **killable_kwargs)
    else:
        return killableprocess.Popen(cmd, env=env, **killable_kwargs)

def getoutput(l):
    tmp = tempfile.mktemp()
    x = open(tmp, 'w')
    subprocess.call(l, stdout=x, stderr=x)
    x.close(); x = open(tmp, 'r')
    r = x.read() ; x.close()
    os.remove(tmp)
    return r

def get_pids(name, minimun_pid=0):
    """Get all the pids matching name, exclude any pids below minimum_pid."""
    if os.name == 'nt' or sys.platform == 'cygwin':
        #win32pdhutil.ShowAllProcesses()  #uncomment for testing
        pids = win32pdhutil.FindPerformanceAttributesByName(name)

    else:
        # get_pids_cmd = ['ps', 'ax']
        # h = killableprocess.runCommand(get_pids_cmd, stdout=subprocess.PIPE, universal_newlines=True)
        # h.wait(group=False)
        # data = h.stdout.readlines()
        data = getoutput(['ps', 'ax']).splitlines()
        pids = [int(line.split()[0]) for line in data if line.find(name) is not -1]

    matching_pids = [m for m in pids if m > minimun_pid]
    return matching_pids

def kill_process_by_name(name):
    """Find and kill all processes containing a certain name"""

    pids = get_pids(name)

    if os.name == 'nt' or sys.platform == 'cygwin':
        for p in pids:
            handle = win32api.OpenProcess(win32con.PROCESS_TERMINATE, 0, p) #get process handle
            win32api.TerminateProcess(handle,0) #kill by handle
            win32api.CloseHandle(handle) #close api

    else:
        for pid in pids:
            try:
                os.kill(pid, signal.SIGTERM)
            except OSError: pass
            sleep(.5)
            if len(get_pids(name)) is not 0:
                try:
                    os.kill(pid, signal.SIGKILL)
                except OSError: pass
                sleep(.5)
                if len(get_pids(name)) is not 0:
                    logger.error('Could not kill process')

def NaN(str):
    try: int(str); return False;
    except: return True

def makedirs(name):
    # from errno import EEXIST
    head, tail = os.path.split(name)
    if not tail:
        head, tail = os.path.split(head)
    if head and tail and not os.path.exists(head):
        try:
            makedirs(head)
        except OSError, e:
            pass
        if tail == os.curdir:           # xxx/newdir/. exists if xxx/newdir exists
            return
    try:
        os.mkdir(name)
    except:
        pass

class Profile(object):
    """Handles all operations regarding profile. Created new profiles, installs extensions,
    sets preferences and handles cleanup."""
    def __init__(self, binary=None, profile=None, create_new=True, plugins=[], preferences={}):
        self.plugins_installed = []
        self.profile = profile
        self.binary = binary
        self.create_new = create_new
        self.plugins = plugins
        if not hasattr(self, 'preferences'):
            self.preferences = preferences
        else:
            self.preferences = copy.copy(self.preferences)
            self.preferences.update(preferences)

        if profile is not None and create_new is True:
            raise Exception('You cannot set the profie location if you want mozrunner to create a new one for you.')
        if create_new is False and profile is None:
            raise Exception('If you set create_new to False you must provide the location of the profile you would like to run')
        if create_new is True:
            self.profile = self.create_new_profile(self.binary)
        for plugin in plugins:
            self.install_plugin(plugin)

        self.set_preferences(self.preferences)

    def create_new_profile(self, binary):
        """Create a new clean profile in tmp which is a simple empty folder"""
        profile = tempfile.mkdtemp(suffix='.mozrunner')
        if os.path.exists(profile) is True:
            rmtree(profile)
        makedirs(profile)

        return profile

    def install_plugin(self, plugin):
        """Installs the given plugin path in the profile."""
        tmpdir = None
        if plugin.endswith('.xpi'):
            tmpdir = tempfile.mkdtemp(suffix="."+os.path.split(plugin)[-1])
            compressed_file = zipfile.ZipFile(plugin, "r")
            for name in compressed_file.namelist():
                if name.endswith('/'):
                    makedirs(os.path.join(tmpdir, name))
                else:
                    if not os.path.isdir(os.path.dirname(os.path.join(tmpdir, name))):
                        makedirs(os.path.dirname(os.path.join(tmpdir, name)))
                    data = compressed_file.read(name)
                    f = open(os.path.join(tmpdir, name), 'w')
                    f.write(data) ; f.close()
            plugin = tmpdir

        tree = ElementTree.ElementTree(file=os.path.join(plugin, 'install.rdf'))
        # description_element =
        # tree.find('.//{http://www.w3.org/1999/02/22-rdf-syntax-ns#}Description/')

        desc = tree.find('.//{http://www.w3.org/1999/02/22-rdf-syntax-ns#}Description')
        if desc and desc.attrib.has_key('{http://www.mozilla.org/2004/em-rdf#}id'):
            plugin_id = desc.attrib['{http://www.mozilla.org/2004/em-rdf#}id']
        else:
            about = [e for e in tree.findall(
                        './/{http://www.w3.org/1999/02/22-rdf-syntax-ns#}Description') if
                         e.get('{http://www.w3.org/1999/02/22-rdf-syntax-ns#}about') ==
                         'urn:mozilla:install-manifest'
                    ]

            x = e.find('.//{http://www.w3.org/1999/02/22-rdf-syntax-ns#}Description')

            if len(about) is 0:
                plugin_element = tree.find('.//{http://www.mozilla.org/2004/em-rdf#}id')
                plugin_id = plugin_element.text
            else:
                plugin_id = about[0].get('{http://www.mozilla.org/2004/em-rdf#}id')

        plugin_path = os.path.join(self.profile, 'extensions', plugin_id)
        copytree(plugin, plugin_path, preserve_symlinks=1)
        self.plugins_installed.append(plugin_path)

    def set_preferences(self, preferences):
        """Adds preferences dict to profile preferences"""
        prefs_file = os.path.join(self.profile, 'user.js')
        # Ensure that the file exists first otherwise create an empty file
        if os.path.isfile(prefs_file):
            f = open(prefs_file, 'a+')
        else:
            f = open(prefs_file, 'w')

        f.write('\n#MozRunner Prefs Start\n')

        pref_lines = ['user_pref(%s, %s);' %
                      (simplejson.dumps(k), simplejson.dumps(v) ) for k, v in
                       preferences.items()]
        for line in pref_lines:
            f.write(line+'\n')
        f.write('#MozRunner Prefs End\n')
        f.flush() ; f.close()

    def clean_preferences(self):
        """Removed preferences added by mozrunner."""
        lines = open(os.path.join(self.profile, 'user.js'), 'r').read().splitlines()
        s = lines.index('#MozRunner Prefs Start') ; e = lines.index('#MozRunner Prefs End')
        cleaned_prefs = '\n'.join(lines[:s] + lines[e+1:])
        f = open(os.path.join(self.profile, 'user.js'), 'w')
        f.write(cleaned_prefs) ; f.flush() ; f.close()

    def clean_plugins(self):
        """Cleans up plugins in the profile."""
        for plugin in self.plugins_installed:
            if os.path.isdir(plugin):
                rmtree(plugin)

    def cleanup(self):
        """Cleanup operations on the profile."""
        if self.create_new:
            rmtree(self.profile)
        else:
            self.clean_preferences()
            self.clean_plugins()


class FirefoxProfile(Profile):
    """Specialized Profile subclass for Firefox"""
    preferences = {'extensions.update.enabled'    : False,
                   'extensions.update.notifyUser' : False,
                   'browser.shell.checkDefaultBrowser' : False,
                   'browser.tabs.warnOnClose' : False,
                   'browser.warnOnQuit': False,
                   'browser.sessionstore.resume_from_crash': False,
                   }

    @property
    def names(self):
        if sys.platform == 'darwin':
            return ['firefox', 'minefield', 'shiretoko']
        if sys.platform == 'linux2':
            return ['firefox', 'mozilla-firefox', 'iceweasel']
        if os.name == 'nt' or sys.platform == 'cygwin':
            return ['firefox']

class ThunderbirdProfile(Profile):
    preferences = {'extensions.update.enabled'    : False,
                   'extensions.update.notifyUser' : False,
                   'browser.shell.checkDefaultBrowser' : False,
                   'browser.tabs.warnOnClose' : False,
                   'browser.warnOnQuit': False,
                   'browser.sessionstore.resume_from_crash': False,
                   }
    names = ["thunderbird", "shredder"]


class Runner(object):
    """Handles all running operations. Finds bins, runs and kills the process."""

    def __init__(self, binary=None, profile=None, cmdargs=[], env=None,
                 aggressively_kill=['crashreporter'], kp_kwargs={}):
        if binary is None:
            self.binary = self.find_binary()
        elif binary.endswith('.app'):
            self.binary = os.path.join(binary, 'Contents/MacOS/'+self.names[0]+'-bin')
        else:
            self.binary = binary


        if not os.path.exists(self.binary):
            raise Exception("Binary path does not exist "+self.binary)

        self.profile = profile

        self.cmdargs = cmdargs
        if env is None:
            self.env = copy.copy(os.environ)
            self.env.update({'MOZ_NO_REMOTE':"1",})
        else:
            self.env = env
        self.aggressively_kill = aggressively_kill
        self.kp_kwargs = kp_kwargs

    def find_binary(self):
        """Finds the binary for self.names if one was not provided."""
        binary = None
        if sys.platform == 'linux2':
            for name in reversed(self.names):
                binary = findInPath(name)
        elif os.name == 'nt' or sys.platform == 'cygwin':
            for name in reversed(self.names):
                binary = findInPath(name)
                if sys.platform == 'cygwin':
                    program_files = os.environ['PROGRAMFILES']
                else:
                    program_files = os.environ['ProgramFiles']

                if binary is None:
                    for bin in [(program_files, 'Mozilla Firefox', 'firefox.exe'),
                                ]:
                        path = os.path.join(*bin)
                        if os.path.isfile(path):
                            binary = path
                            break
        elif sys.platform == 'darwin':
            for name in reversed(self.names):
                appdir = os.path.join('Applications', name.capitalize()+'.app')
                if os.path.isdir(os.path.join(os.path.expanduser('~/'), appdir)):
                    binary = os.path.join(os.path.expanduser('~/'), appdir,
                                          'Contents/MacOS/'+name+'-bin')
                elif os.path.isdir('/'+appdir):
                    binary = os.path.join("/"+appdir, 'Contents/MacOS/'+name+'-bin')

                if binary is not None:
                    if not os.path.isfile(binary):
                        binary = binary.replace(name+'-bin', 'firefox-bin')
                    if not os.path.isfile(binary):
                        binary = None
        if binary is None:
            raise Exception('Mozrunner could not locate your binary, you will need to set it.')
        return binary

    @property
    def command(self):
        """Returns the command list to run."""
        return [self.binary, '-profile', self.profile.profile]

    def start(self):
        """Run self.command in the proper environment."""
        if self.profile is None:
            self.profile = self.profile_class()
        self.process_handler = run_command(self.command+self.cmdargs, self.env, **self.kp_kwargs)

    def wait(self, timeout=None):
        """Wait for the browser to exit."""
        self.process_handler.wait(timeout=timeout)

        if sys.platform != 'win32':
            for name in self.names:
                for pid in get_pids(name, self.process_handler.pid):
                    self.process_handler.pid = pid
                    self.process_handler.wait(timeout=timeout)

    def kill(self, kill_signal=signal.SIGTERM):
        """Kill the browser"""
        if sys.platform != 'win32':
            self.process_handler.kill()
            for name in self.names:
                for pid in get_pids(name, self.process_handler.pid):
                    self.process_handler.pid = pid
                    self.process_handler.kill()
        else:
            try:
                self.process_handler.kill(group=True)
            except Exception, e:
                logger.error('Cannot kill process, '+type(e).__name__+' '+e.message)

        for name in self.aggressively_kill:
            kill_process_by_name(name)

    def stop(self):
        self.kill()

class FirefoxRunner(Runner):
    """Specialized Runner subclass for running Firefox."""

    profile_class = FirefoxProfile

    @property
    def names(self):
        if sys.platform == 'darwin':
            return ['firefox', 'minefield', 'shiretoko']
        if sys.platform == 'linux2':
            return ['firefox', 'mozilla-firefox', 'iceweasel']
        if os.name == 'nt' or sys.platform == 'cygwin':
            return ['firefox']

class ThunderbirdRunner(Runner):
    """Specialized Runner subclass for running Thunderbird"""
    profile_class = ThunderbirdProfile

    names = ["thunderbird", "shredder"]

class CLI(object):
    """Command line interface."""

    runner_class = FirefoxRunner
    profile_class = FirefoxProfile

    parser_options = {("-b", "--binary",): dict(dest="binary", help="Binary path.",
                                                metavar=None, default=None),
                      ('-p', "--profile",): dict(dest="profile", help="Profile path.",
                                                 metavar=None, default=None),
                      ('-w', "--plugins",): dict(dest="plugins",
                                                 help="Plugin paths to install.",
                                                 metavar=None, default=None),
                      ("-n", "--no-new-profile",): dict(dest="create_new",
                                                        action="store_false",
                                                        help="Do not create new profile.",
                                                        metavar="MOZRUNNER_NEW_PROFILE",
                                                        default=True ),
                     }

    def __init__(self):
        """ Setup command line parser and parse arguments """
        self.parser = optparse.OptionParser()
        for names, opts in self.parser_options.items():
            self.parser.add_option(*names, **opts)
        (self.options, self.args) = self.parser.parse_args()

        try:
            self.plugins = self.options.plugins.split(',')
        except:
            self.plugins = []

    def create_runner(self):
        """ Get the runner object """
        runner = self.get_runner(binary=self.options.binary)
        profile = self.get_profile(binary=runner.binary,
                                   profile=self.options.profile,
                                   create_new=self.options.create_new,
                                   plugins=self.plugins)
        runner.profile = profile
        return runner

    def get_runner(self, binary=None, profile=None):
        """Returns the runner instance for the given command line binary argument
        the profile instance returned from self.get_profile()."""
        return self.runner_class(binary, profile)

    def get_profile(self, binary=None, profile=None, create_new=None, plugins=[],
                    preferences={}):
        """Returns the profile instance for the given command line arguments."""
        return self.profile_class(binary, profile, create_new, plugins, preferences)

    def run(self):
        runner = self.create_runner()
        self.start(runner)
        runner.profile.cleanup()

    def start(self, runner):
        """Starts the runner and waits for Firefox to exitor Keyboard Interrupt.
        Shoule be overwritten to provide custom running of the runner instance."""
        runner.start()
        print 'Started:', ' '.join(runner.command)
        try:
            runner.wait()
        except KeyboardInterrupt:
            runner.stop()


def cli():
    CLI().run()
