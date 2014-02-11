# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import sys
import os
import unittest
import zipfile
import pprint
import shutil

from cuddlefish import native, packaging, manifest, buildJID
from cuddlefish.tests import test_packaging

class PrefsTests(unittest.TestCase):
    def makexpi(self, pkg_name):
        self.xpiname = "native-%s.xpi" % pkg_name
        create_xpi(self.xpiname, pkg_name, 'preferences-files')
        self.xpi = zipfile.ZipFile(self.xpiname, 'r')

    def setUp(self):
        self.xpiname = None
        self.xpi = None

    def tearDown(self):
        if self.xpi:
            self.xpi.close()
        if self.xpiname and os.path.exists(self.xpiname):
            os.remove(self.xpiname)

    def testPackageWithPreferencesBranch(self):
        self.makexpi('preferences-branch')
        self.failUnless('options.xul' not in self.xpi.namelist())
        self.failUnless('prefs.js' not in self.xpi.namelist())

    def testPackageWithNoPrefs(self):
        self.makexpi('no-prefs')
        self.failUnless('options.xul' not in self.xpi.namelist())
        self.failUnless('prefs.js' not in self.xpi.namelist())

    def testPackageWithInvalidPreferencesBranch(self):
        self.makexpi('curly-id')
        self.failUnless('options.xul' not in self.xpi.namelist())
        self.failUnless('prefs.js' not in self.xpi.namelist())

def create_xpi(xpiname, pkg_name='aardvark', dirname='static-files',
               extra_harness_options={}):
    configs = test_packaging.get_configs(pkg_name, dirname)
    options = {'main': configs.target_cfg.main,
               'jetpackID': buildJID(configs.target_cfg), }
    options.update(configs.build)
    native.build_xpi(xpi_path=xpiname,
                  harness_options=options,
                  extra_harness_options=extra_harness_options)

if __name__ == '__main__':
    unittest.main()
