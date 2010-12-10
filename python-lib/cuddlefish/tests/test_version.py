import os
import unittest
import shutil

from cuddlefish.version import get_version

class Version(unittest.TestCase):
    def get_basedir(self):
        return os.path.join(".test_tmp", self.id())
    def make_basedir(self):
        basedir = self.get_basedir()
        if os.path.isdir(basedir):
            here = os.path.abspath(os.getcwd())
            assert os.path.abspath(basedir).startswith(here) # safety
            shutil.rmtree(basedir)
        os.makedirs(basedir)
        return basedir

    def test_current_version(self):
        # the SDK should be able to determine its own version. We don't care
        # what it is, merely that it can be computed.
        env_root = os.environ.get('CUDDLEFISH_ROOT')
        version = get_version(env_root)
        self.failUnless(isinstance(version, str), (version, type(version)))
        self.failUnless(len(version) > 0, version)
    def test_read(self):
        basedir = self.make_basedir()
        f = open(os.path.join(basedir, ".version"), "w")
        f.write("versioniffic\n")
        f.close()
        sdk_version = get_version(basedir)
        self.failUnlessEqual(sdk_version, "versioniffic")
