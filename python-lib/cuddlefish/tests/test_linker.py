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
    def get_pkg(self, name):
        d = os.path.join(up(os.path.abspath(__file__)), "linker-files", name)
        return packaging.get_config_in_dir(d)

    def test_deps(self):
        target_cfg = self.get_pkg("one")
        pkg_cfg = packaging.build_config(self.root, target_cfg)
        deps = packaging.get_deps_for_targets(pkg_cfg, ["one"])
        self.failUnlessEqual(deps, ["one"])
        deps = packaging.get_deps_for_targets(pkg_cfg,
                                              [target_cfg.name, "addon-kit"])
        self.failUnlessEqual(deps, ["addon-kit", "api-utils", "one"])

    def assertReqIs(self, manifest, modname, reqname, uri):
        reqs = manifest["P/one-lib/%s.js" % modname]["requirements"]
        self.failUnlessEqual(reqs[reqname]["uri"], uri)

    def test_manifest(self):
        target_cfg = self.get_pkg("one")
        pkg_cfg = packaging.build_config(self.root, target_cfg)
        deps = packaging.get_deps_for_targets(pkg_cfg,
                                              [target_cfg.name, "addon-kit"])
        self.failUnlessEqual(deps, ["addon-kit", "api-utils", "one"])
        target_cfg.dependencies.extend(["addon-kit"])
        m = manifest.build_manifest(target_cfg, pkg_cfg, deps,
                                    "P/", scan_tests=False)
        m = m.get_harness_options_manifest("P/")
        self.assertReqIs(m, "main", "panel", "P/addon-kit-lib/panel.js")
        self.assertReqIs(m, "main", "two", "P/one-lib/two.js")
        self.assertReqIs(m, "main", "./two", "P/one-lib/two.js")
        self.assertReqIs(m, "main", "addon-kit/tabs", "P/addon-kit-lib/tabs.js")
        self.assertReqIs(m, "main", "./subdir/three", "P/one-lib/subdir/three.js")
        self.assertReqIs(m, "two", "main", "P/one-lib/main.js")
        self.assertReqIs(m, "subdir/three", "../main", "P/one-lib/main.js")

if __name__ == '__main__':
    unittest.main()
    
