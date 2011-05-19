import os.path
import unittest
from cuddlefish import packaging, manifest
from cuddlefish.bunch import Bunch

def up(path, generations=1):
    for i in range(generations):
        path = os.path.dirname(path)
    return path

class Basic(unittest.TestCase):
    def setUp(self):
        self.root = up(os.path.abspath(__file__), 4)
    def get_linker_files_dir(self, name):
        return os.path.join(up(os.path.abspath(__file__)), "linker-files", name)
    def get_pkg(self, name):
        d = self.get_linker_files_dir(name)
        return packaging.get_config_in_dir(d)

    def test_deps(self):
        target_cfg = self.get_pkg("one")
        pkg_cfg = packaging.build_config(self.root, target_cfg)
        deps = packaging.get_deps_for_targets(pkg_cfg, ["one"])
        self.failUnlessEqual(deps, ["one"])
        deps = packaging.get_deps_for_targets(pkg_cfg,
                                              [target_cfg.name, "addon-kit"])
        self.failUnlessEqual(deps, ["addon-kit", "api-utils", "one"])

    def test_manifest(self):
        target_cfg = self.get_pkg("one")
        pkg_cfg = packaging.build_config(self.root, target_cfg)
        deps = packaging.get_deps_for_targets(pkg_cfg,
                                              [target_cfg.name, "addon-kit"])
        self.failUnlessEqual(deps, ["addon-kit", "api-utils", "one"])
        # target_cfg.dependencies is not provided, so we'll search through
        # all known packages (everything in 'deps').
        m = manifest.build_manifest(target_cfg, pkg_cfg, deps,
                                    "P/", scan_tests=False)
        m = m.get_harness_options_manifest("P/")

        def assertReqIs(modname, reqname, uri):
            reqs = m["P/one-lib/%s.js" % modname]["requirements"]
            self.failUnlessEqual(reqs[reqname]["uri"], uri)
        assertReqIs("main", "panel", "P/addon-kit-lib/panel.js")
        assertReqIs("main", "two", "P/one-lib/two.js")
        assertReqIs("main", "./two", "P/one-lib/two.js")
        assertReqIs("main", "addon-kit/tabs", "P/addon-kit-lib/tabs.js")
        assertReqIs("main", "./subdir/three", "P/one-lib/subdir/three.js")
        assertReqIs("two", "main", "P/one-lib/main.js")
        assertReqIs("subdir/three", "../main", "P/one-lib/main.js")

        target_cfg.dependencies = []
        # now, because .dependencies *is* provided, we won't search 'deps',
        # so we'll get a link error
        self.assertRaises(manifest.ModuleNotFoundError,
                          manifest.build_manifest,
                          target_cfg, pkg_cfg, deps, "P/", scan_tests=False)

    def test_main_in_deps(self):
        target_cfg = self.get_pkg("three")
        package_path = [self.get_linker_files_dir("three-deps")]
        pkg_cfg = packaging.build_config(self.root, target_cfg,
                                         packagepath=package_path)
        deps = packaging.get_deps_for_targets(pkg_cfg,
                                              [target_cfg.name, "addon-kit"])
        self.failUnlessEqual(deps, ["addon-kit", "api-utils", "three"])
        m = manifest.build_manifest(target_cfg, pkg_cfg, deps,
                                    "P/", scan_tests=False)
        m = m.get_harness_options_manifest("P/")
        def assertReqIs(modname, reqname, uri):
            reqs = m["P/three-lib/%s.js" % modname]["requirements"]
            self.failUnlessEqual(reqs[reqname]["uri"], uri)
        assertReqIs("main", "three-a", "P/three-a-lib/main.js")
        assertReqIs("main", "three-b", "P/three-b-lib/main.js")
        assertReqIs("main", "three-c", "P/three-c-lib/main.js")

    def test_relative_main_in_top(self):
        target_cfg = self.get_pkg("five")
        package_path = []
        pkg_cfg = packaging.build_config(self.root, target_cfg,
                                         packagepath=package_path)
        deps = packaging.get_deps_for_targets(pkg_cfg,
                                              [target_cfg.name, "addon-kit"])
        self.failUnlessEqual(deps, ["addon-kit", "api-utils", "five"])
        # all we care about is that this next call doesn't raise an exception
        m = manifest.build_manifest(target_cfg, pkg_cfg, deps,
                                    "P/", scan_tests=False)
        m = m.get_harness_options_manifest("P/")
        reqs = m["P/five-lib/main.js"]["requirements"]
        self.failUnlessEqual(reqs, {});

    def test_unreachable_relative_main_in_top(self):
        target_cfg = self.get_pkg("six")
        package_path = []
        pkg_cfg = packaging.build_config(self.root, target_cfg,
                                         packagepath=package_path)
        deps = packaging.get_deps_for_targets(pkg_cfg,
                                              [target_cfg.name, "addon-kit"])
        self.failUnlessEqual(deps, ["addon-kit", "api-utils", "six"])
        self.assertRaises(manifest.UnreachablePrefixError,
                          manifest.build_manifest,
                          target_cfg, pkg_cfg, deps,
                          "P/", scan_tests=False)

    def test_unreachable_in_deps(self):
        target_cfg = self.get_pkg("four")
        package_path = [self.get_linker_files_dir("four-deps")]
        pkg_cfg = packaging.build_config(self.root, target_cfg,
                                         packagepath=package_path)
        deps = packaging.get_deps_for_targets(pkg_cfg,
                                              [target_cfg.name, "addon-kit"])
        self.failUnlessEqual(deps, ["addon-kit", "api-utils", "four"])
        self.assertRaises(manifest.UnreachablePrefixError,
                          manifest.build_manifest,
                          target_cfg, pkg_cfg, deps,
                          "P/", scan_tests=False)
        

if __name__ == '__main__':
    unittest.main()
