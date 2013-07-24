# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.

__all__ = ['Profile',
           'FirefoxProfile',
           'MetroFirefoxProfile',
           'ThunderbirdProfile']

import os
import time
import tempfile
import types
import uuid
from addons import AddonManager
from permissions import Permissions
from prefs import Preferences
from shutil import copytree, rmtree
from webapps import WebappCollection

try:
    import json
except ImportError:
    import simplejson as json

class Profile(object):
    """Handles all operations regarding profile. Created new profiles, installs extensions,
    sets preferences and handles cleanup."""

    def __init__(self, profile=None, addons=None, addon_manifests=None, apps=None,
                 preferences=None, locations=None, proxy=None, restore=True):
        """
        :param profile: Path to the profile
        :param addons: String of one or list of addons to install
        :param addon_manifests: Manifest for addons, see http://ahal.ca/blog/2011/bulk-installing-fx-addons/
        :param apps: Dictionary or class of webapps to install
        :param preferences: Dictionary or class of preferences
        :param locations: locations to proxy
        :param proxy: setup a proxy - dict of server-loc,server-port,ssl-port
        :param restore: If true remove all installed addons preferences when cleaning up
        """

        # if true, remove installed addons/prefs afterwards
        self.restore = restore

        # prefs files written to
        self.written_prefs = set()

        # our magic markers
        nonce = '%s %s' % (str(time.time()), uuid.uuid4())
        self.delimeters = ('#MozRunner Prefs Start %s' % nonce,'#MozRunner Prefs End %s' % nonce)

        # Handle profile creation
        self.create_new = not profile
        if profile:
            # Ensure we have a full path to the profile
            self.profile = os.path.abspath(os.path.expanduser(profile))
            if not os.path.exists(self.profile):
                os.makedirs(self.profile)
        else:
            self.profile = self.create_new_profile()

        # set preferences
        if hasattr(self.__class__, 'preferences'):
            # class preferences
            self.set_preferences(self.__class__.preferences)
        self._preferences = preferences
        if preferences:
            # supplied preferences
            if isinstance(preferences, dict):
                # unordered
                preferences = preferences.items()
            # sanity check
            assert not [i for i in preferences
                        if len(i) != 2]
        else:
            preferences = []
        self.set_preferences(preferences)

        # set permissions
        self._locations = locations # store this for reconstruction
        self._proxy = proxy
        self.permissions = Permissions(self.profile, locations)
        prefs_js, user_js = self.permissions.network_prefs(proxy)
        self.set_preferences(prefs_js, 'prefs.js')
        self.set_preferences(user_js)

        # handle addon installation
        self.addon_manager = AddonManager(self.profile)
        self.addon_manager.install_addons(addons, addon_manifests)

        # handle webapps
        self.webapps = WebappCollection(profile=self.profile, apps=apps)
        self.webapps.update_manifests()

    def exists(self):
        """returns whether the profile exists or not"""
        return os.path.exists(self.profile)

    def reset(self):
        """
        reset the profile to the beginning state
        """
        self.cleanup()
        if self.create_new:
            profile = None
        else:
            profile = self.profile
        self.__init__(profile=profile,
                      addons=self.addon_manager.installed_addons,
                      addon_manifests=self.addon_manager.installed_manifests,
                      preferences=self._preferences,
                      locations=self._locations,
                      proxy = self._proxy)

    @classmethod
    def clone(cls, path_from, path_to=None, **kwargs):
        """Instantiate a temporary profile via cloning
        - path: path of the basis to clone
        - kwargs: arguments to the profile constructor
        """
        if not path_to:
            tempdir = tempfile.mkdtemp() # need an unused temp dir name
            rmtree(tempdir) # copytree requires that dest does not exist
            path_to = tempdir
        copytree(path_from, path_to)

        def cleanup_clone(fn):
            """Deletes a cloned profile when restore is True"""
            def wrapped(self):
                fn(self)
                if self.restore and os.path.exists(self.profile):
                        rmtree(self.profile, onerror=self._cleanup_error)
            return wrapped

        c = cls(path_to, **kwargs)
        c.__del__ = c.cleanup = types.MethodType(cleanup_clone(cls.cleanup), c)
        return c

    def create_new_profile(self):
        """Create a new clean temporary profile which is a simple empty folder"""
        return tempfile.mkdtemp(suffix='.mozrunner')


    ### methods for preferences

    def set_preferences(self, preferences, filename='user.js'):
        """Adds preferences dict to profile preferences"""

        # append to the file
        prefs_file = os.path.join(self.profile, filename)
        f = open(prefs_file, 'a')

        if preferences:

            # note what files we've touched
            self.written_prefs.add(filename)

            # opening delimeter
            f.write('\n%s\n' % self.delimeters[0])

            # write the preferences
            Preferences.write(f, preferences)

            # closing delimeter
            f.write('%s\n' % self.delimeters[1])

        f.close()

    def pop_preferences(self, filename):
        """
        pop the last set of preferences added
        returns True if popped
        """

        lines = file(os.path.join(self.profile, filename)).read().splitlines()
        def last_index(_list, value):
            """
            returns the last index of an item;
            this should actually be part of python code but it isn't
            """
            for index in reversed(range(len(_list))):
                if _list[index] == value:
                    return index
        s = last_index(lines, self.delimeters[0])
        e = last_index(lines, self.delimeters[1])

        # ensure both markers are found
        if s is None:
            assert e is None, '%s found without %s' % (self.delimeters[1], self.delimeters[0])
            return False # no preferences found
        elif e is None:
            assert s is None, '%s found without %s' % (self.delimeters[0], self.delimeters[1])

        # ensure the markers are in the proper order
        assert e > s, '%s found at %s, while %s found at %s' % (self.delimeters[1], e, self.delimeters[0], s)

        # write the prefs
        cleaned_prefs = '\n'.join(lines[:s] + lines[e+1:])
        f = file(os.path.join(self.profile, 'user.js'), 'w')
        f.write(cleaned_prefs)
        f.close()
        return True

    def clean_preferences(self):
        """Removed preferences added by mozrunner."""
        for filename in self.written_prefs:
            if not os.path.exists(os.path.join(self.profile, filename)):
                # file has been deleted
                break
            while True:
                if not self.pop_preferences(filename):
                    break

    ### cleanup

    def _cleanup_error(self, function, path, excinfo):
        """ Specifically for windows we need to handle the case where the windows
            process has not yet relinquished handles on files, so we do a wait/try
            construct and timeout if we can't get a clear road to deletion
        """

        try:
            from exceptions import WindowsError
            from time import sleep
            def is_file_locked():
                return excinfo[0] is WindowsError and excinfo[1].winerror == 32

            if excinfo[0] is WindowsError and excinfo[1].winerror == 32:
                # Then we're on windows, wait to see if the file gets unlocked
                # we wait 10s
                count = 0
                while count < 10:
                    sleep(1)
                    try:
                        function(path)
                        break
                    except:
                        count += 1
        except ImportError:
            # We can't re-raise an error, so we'll hope the stuff above us will throw
            pass

    def cleanup(self):
        """Cleanup operations for the profile."""
        if self.restore:
            if self.create_new:
                if os.path.exists(self.profile):
                    rmtree(self.profile, onerror=self._cleanup_error)
            else:
                self.clean_preferences()
                self.addon_manager.clean_addons()
                self.permissions.clean_db()
                self.webapps.clean()

    __del__ = cleanup

class FirefoxProfile(Profile):
    """Specialized Profile subclass for Firefox"""

    preferences = {# Don't automatically update the application
                   'app.update.enabled' : False,
                   # Don't restore the last open set of tabs if the browser has crashed
                   'browser.sessionstore.resume_from_crash': False,
                   # Don't check for the default web browser during startup
                   'browser.shell.checkDefaultBrowser' : False,
                   # Don't warn on exit when multiple tabs are open
                   'browser.tabs.warnOnClose' : False,
                   # Don't warn when exiting the browser
                   'browser.warnOnQuit': False,
                   # Don't send Firefox health reports to the production server
                   'datareporting.healthreport.documentServerURI' : 'http://%(server)s/healthreport/',
                   # Only install add-ons from the profile and the application scope
                   # Also ensure that those are not getting disabled.
                   # see: https://developer.mozilla.org/en/Installing_extensions
                   'extensions.enabledScopes' : 5,
                   'extensions.autoDisableScopes' : 10,
                   # Don't install distribution add-ons from the app folder
                   'extensions.installDistroAddons' : False,
                   # Dont' run the add-on compatibility check during start-up
                   'extensions.showMismatchUI' : False,
                   # Don't automatically update add-ons
                   'extensions.update.enabled'    : False,
                   # Don't open a dialog to show available add-on updates
                   'extensions.update.notifyUser' : False,
                   # Enable test mode to run multiple tests in parallel
                   'focusmanager.testmode' : True,
                   # Suppress delay for main action in popup notifications
                   'security.notification_enable_delay' : 0,
                   # Suppress automatic safe mode after crashes
                   'toolkit.startup.max_resumed_crashes' : -1,
                   # Don't report telemetry information
                   'toolkit.telemetry.enabled' : False,
                   'toolkit.telemetry.enabledPreRelease' : False,
                   }

class MetroFirefoxProfile(Profile):
    """Specialized Profile subclass for Firefox Metro"""

    preferences = {# Don't automatically update the application for desktop and metro build
                   'app.update.enabled' : False,
                   'app.update.metro.enabled' : False,
                   # Don't restore the last open set of tabs if the browser has crashed
                   'browser.sessionstore.resume_from_crash': False,
                   # Don't check for the default web browser during startup
                   'browser.shell.checkDefaultBrowser' : False,
                   # Don't send Firefox health reports to the production server
                   'datareporting.healthreport.documentServerURI' : 'http://%(server)s/healthreport/',
                   # Only install add-ons from the profile and the application scope
                   # Also ensure that those are not getting disabled.
                   # see: https://developer.mozilla.org/en/Installing_extensions
                   'extensions.enabledScopes' : 5,
                   'extensions.autoDisableScopes' : 10,
                   # Don't install distribution add-ons from the app folder
                   'extensions.installDistroAddons' : False,
                   # Dont' run the add-on compatibility check during start-up
                   'extensions.showMismatchUI' : False,
                   # Disable strict compatibility checks to allow add-ons enabled by default
                   'extensions.strictCompatibility' : False,
                   # Don't automatically update add-ons
                   'extensions.update.enabled'    : False,
                   # Don't open a dialog to show available add-on updates
                   'extensions.update.notifyUser' : False,
                   # Enable test mode to run multiple tests in parallel
                   'focusmanager.testmode' : True,
                   # Suppress delay for main action in popup notifications
                   'security.notification_enable_delay' : 0,
                   # Suppress automatic safe mode after crashes
                   'toolkit.startup.max_resumed_crashes' : -1,
                   # Don't report telemetry information
                   'toolkit.telemetry.enabled' : False,
                   'toolkit.telemetry.enabledPreRelease' : False,
                   }

class ThunderbirdProfile(Profile):
    """Specialized Profile subclass for Thunderbird"""

    preferences = {'extensions.update.enabled'    : False,
                   'extensions.update.notifyUser' : False,
                   'browser.shell.checkDefaultBrowser' : False,
                   'browser.tabs.warnOnClose' : False,
                   'browser.warnOnQuit': False,
                   'browser.sessionstore.resume_from_crash': False,
                   # prevents the 'new e-mail address' wizard on new profile
                   'mail.provider.enabled': False,
                   }
