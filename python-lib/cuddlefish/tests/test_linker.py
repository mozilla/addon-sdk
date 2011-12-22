import os.path
import shutil
import zipfile
from StringIO import StringIO
import unittest
import cuddlefish
from cuddlefish import packaging, manifest

def up(path, generations=1):
    for i in range(generations):
        path = os.path.dirname(path)
    return path

ROOT = up(os.path.abspath(__file__), 4)
def get_linker_files_dir(name):
    return os.path.join(up(os.path.abspath(__file__)), "linker-files", name)

class Basic(unittest.TestCase):
    def get_pkg(self, name):
        d = get_linker_files_dir(name)
        return packaging.get_config_in_dir(d)

    def test_deps(self):
        target_cfg = self.get_pkg("one")
        pkg_cfg = packaging.build_config(ROOT, target_cfg)
        deps = packaging.get_deps_for_targets(pkg_cfg, ["one"])
        self.failUnlessEqual(deps, ["one"])
        deps = packaging.get_deps_for_targets(pkg_cfg,
                                              [target_cfg.name, "addon-kit"])
        self.failUnlessEqual(deps, ["addon-kit", "api-utils", "one"])

    def test_manifest(self):
        target_cfg = self.get_pkg("one")
        pkg_cfg = packaging.build_config(ROOT, target_cfg)
        deps = packaging.get_deps_for_targets(pkg_cfg,
                                              [target_cfg.name, "addon-kit"])
        self.failUnlessEqual(deps, ["addon-kit", "api-utils", "one"])
        # target_cfg.dependencies is not provided, so we'll search through
        # all known packages (everything in 'deps').
        m = manifest.build_manifest(target_cfg, pkg_cfg, deps, scan_tests=False)
        m = m.get_harness_options_manifest()

        def assertReqIs(modname, reqname, path):
            reqs = m["one/lib/%s.js" % modname]["requirements"]
            self.failUnlessEqual(reqs[reqname]["path"], path)
        assertReqIs("main", "panel", "addon-kit/lib/panel.js")
        assertReqIs("main", "two.js", "one/lib/two.js")
        assertReqIs("main", "./two", "one/lib/two.js")
        assertReqIs("main", "addon-kit/tabs.js", "addon-kit/lib/tabs.js")
        assertReqIs("main", "./subdir/three", "one/lib/subdir/three.js")
        assertReqIs("two", "main", "one/lib/main.js")
        assertReqIs("subdir/three", "../main", "one/lib/main.js")

        target_cfg.dependencies = []
        # now, because .dependencies *is* provided, we won't search 'deps',
        # so we'll get a link error
        self.assertRaises(manifest.ModuleNotFoundError,
                          manifest.build_manifest,
                          target_cfg, pkg_cfg, deps, scan_tests=False)

    def test_main_in_deps(self):
        target_cfg = self.get_pkg("three")
        package_path = [get_linker_files_dir("three-deps")]
        pkg_cfg = packaging.build_config(ROOT, target_cfg,
                                         packagepath=package_path)
        deps = packaging.get_deps_for_targets(pkg_cfg,
                                              [target_cfg.name, "addon-kit"])
        self.failUnlessEqual(deps, ["addon-kit", "api-utils", "three"])
        m = manifest.build_manifest(target_cfg, pkg_cfg, deps, scan_tests=False)
        m = m.get_harness_options_manifest()
        def assertReqIs(modname, reqname, path):
            reqs = m["three/lib/%s.js" % modname]["requirements"]
            self.failUnlessEqual(reqs[reqname]["path"], path)
        assertReqIs("main", "three-a", "three-a/lib/main.js")
        assertReqIs("main", "three-b", "three-b/lib/main.js")
        assertReqIs("main", "three-c", "three-c/lib/main.js")

    def test_relative_main_in_top(self):
        target_cfg = self.get_pkg("five")
        package_path = []
        pkg_cfg = packaging.build_config(ROOT, target_cfg,
                                         packagepath=package_path)
        deps = packaging.get_deps_for_targets(pkg_cfg,
                                              [target_cfg.name, "addon-kit"])
        self.failUnlessEqual(deps, ["addon-kit", "api-utils", "five"])
        # all we care about is that this next call doesn't raise an exception
        m = manifest.build_manifest(target_cfg, pkg_cfg, deps, scan_tests=False)
        m = m.get_harness_options_manifest()
        reqs = m["five/lib/main.js"]["requirements"]
        self.failUnlessEqual(reqs, {});

    def test_unreachable_relative_main_in_top(self):
        target_cfg = self.get_pkg("six")
        package_path = []
        pkg_cfg = packaging.build_config(ROOT, target_cfg,
                                         packagepath=package_path)
        deps = packaging.get_deps_for_targets(pkg_cfg,
                                              [target_cfg.name, "addon-kit"])
        self.failUnlessEqual(deps, ["addon-kit", "api-utils", "six"])
        self.assertRaises(manifest.UnreachablePrefixError,
                          manifest.build_manifest,
                          target_cfg, pkg_cfg, deps, scan_tests=False)

    def test_unreachable_in_deps(self):
        target_cfg = self.get_pkg("four")
        package_path = [get_linker_files_dir("four-deps")]
        pkg_cfg = packaging.build_config(ROOT, target_cfg,
                                         packagepath=package_path)
        deps = packaging.get_deps_for_targets(pkg_cfg,
                                              [target_cfg.name, "addon-kit"])
        self.failUnlessEqual(deps, ["addon-kit", "api-utils", "four"])
        self.assertRaises(manifest.UnreachablePrefixError,
                          manifest.build_manifest,
                          target_cfg, pkg_cfg, deps, scan_tests=False)

class Contents(unittest.TestCase):

    def run_in_subdir(self, dirname, f, *args, **kwargs):
        top = os.path.abspath(os.getcwd())
        basedir = os.path.abspath(os.path.join(".test_tmp",self.id(),dirname))
        if os.path.isdir(basedir):
            assert basedir.startswith(top)
            shutil.rmtree(basedir)
        os.makedirs(basedir)
        try:
            os.chdir(basedir)
            return f(basedir, *args, **kwargs)
        finally:
            os.chdir(top)

    def assertIn(self, what, inside_what):
        self.failUnless(what in inside_what, inside_what)

    def test_strip_default(self):
        seven = get_linker_files_dir("seven")
        # now run 'cfx xpi' in that directory, except put the generated .xpi
        # elsewhere
        def _test(basedir):
            stdout = StringIO()
            shutil.copytree(seven, "seven")
            os.chdir("seven")
            try:
                # regrettably, run() always finishes with sys.exit()
                cuddlefish.run(["xpi"], # --strip-xpi is now the default
                               stdout=stdout)
            except SystemExit, e:
                self.failUnlessEqual(e.args[0], 0)
            zf = zipfile.ZipFile("seven.xpi", "r")
            names = zf.namelist()
            # the first problem found in bug 664840 was that cuddlefish.js
            # (the loader) was stripped out on windows, due to a /-vs-\ bug
            self.assertIn("resources/api-utils/lib/cuddlefish.js", names)
            # the second problem found in bug 664840 was that an addon
            # without an explicit tests/ directory would copy all files from
            # the package into a bogus JID-PKGNAME-tests/ directory, so check
            # for that
            testfiles = [fn for fn in names if "seven/tests" in fn]
            self.failUnlessEqual([], testfiles)
            # the third problem was that data files were being stripped from
            # the XPI. Note that data/ is only supposed to be included if a
            # module that actually gets used does a require("self") .
            self.assertIn("resources/seven/data/text.data",
                          names)
            self.failIf("seven/lib/unused.js"
                        in names, names)
        self.run_in_subdir("x", _test)


if __name__ == '__main__':
    unittest.main()
