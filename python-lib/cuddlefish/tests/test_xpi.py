import os
import unittest
import zipfile
import pprint
import shutil

import simplejson as json
from cuddlefish import xpi, packaging, manifest
from cuddlefish.tests import test_packaging
from test_linker import up

xpi_template_path = os.path.join(test_packaging.static_files_path,
                                 'xpi-template')

fake_manifest = '<RDF><!-- Extension metadata is here. --></RDF>'

class Bug588119Tests(unittest.TestCase):
    def makexpi(self, pkg_name):
        self.xpiname = "%s.xpi" % pkg_name
        create_xpi(self.xpiname, pkg_name, 'bug-588119-files')
        self.xpi = zipfile.ZipFile(self.xpiname, 'r')
        options = self.xpi.read('harness-options.json')
        self.xpi_harness_options = json.loads(options)

    def setUp(self):
        self.xpiname = None
        self.xpi = None
        
    def tearDown(self):
        if self.xpi:
            self.xpi.close()
        if self.xpiname and os.path.exists(self.xpiname):
            os.remove(self.xpiname)

    def testPackageWithImplicitIcon(self):
        self.makexpi('implicit-icon')
        assert 'icon.png' in self.xpi.namelist()

    def testPackageWithImplicitIcon64(self):
        self.makexpi('implicit-icon')
        assert 'icon64.png' in self.xpi.namelist()

    def testPackageWithExplicitIcon(self):
        self.makexpi('explicit-icon')
        assert 'icon.png' in self.xpi.namelist()

    def testPackageWithExplicitIcon64(self):
        self.makexpi('explicit-icon')
        assert 'icon64.png' in self.xpi.namelist()

    def testPackageWithNoIcon(self):
        self.makexpi('no-icon')
        assert 'icon.png' not in self.xpi.namelist()

    def testIconPathNotInHarnessOptions(self):
        self.makexpi('implicit-icon')
        assert 'icon' not in self.xpi_harness_options

    def testIcon64PathNotInHarnessOptions(self):
        self.makexpi('implicit-icon')
        assert 'icon64' not in self.xpi_harness_options

class SmallXPI(unittest.TestCase):
    def setUp(self):
        self.root = up(os.path.abspath(__file__), 4)
    def get_linker_files_dir(self, name):
        return os.path.join(up(os.path.abspath(__file__)), "linker-files", name)
    def get_pkg(self, name):
        d = self.get_linker_files_dir(name)
        return packaging.get_config_in_dir(d)

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

    def test_contents(self):
        target_cfg = self.get_pkg("three")
        package_path = [self.get_linker_files_dir("three-deps")]
        pkg_cfg = packaging.build_config(self.root, target_cfg,
                                         packagepath=package_path)
        deps = packaging.get_deps_for_targets(pkg_cfg,
                                              [target_cfg.name, "addon-kit"])
        m = manifest.build_manifest(target_cfg, pkg_cfg, deps,
                                    "P/", scan_tests=False)
        used_files = list(m.get_used_files())
        here = up(os.path.abspath(__file__))
        def absify(*parts):
            fn = os.path.join(here, "linker-files", *parts)
            return os.path.abspath(fn)
        expected = [absify(*parts) for parts in
                    [("three", "lib", "main.js"),
                     ("three-deps", "three-a", "lib", "main.js"),
                     ("three-deps", "three-b", "lib", "main.js"),
                     ("three-deps", "three-c", "lib", "main.js"),
                     ("three-deps", "three-c", "lib", "sub", "foo.js"),
                     ]]
        self.failUnlessEqual(sorted(used_files), sorted(expected))
        used_deps = m.get_used_packages()

        build = packaging.generate_build_for_target(pkg_cfg, target_cfg.name,
                                                    used_deps,
                                                    prefix="p-",
                                                    include_tests=False)
        options = {'main': target_cfg.main}
        options.update(build)
        basedir = self.make_basedir()
        xpi_name = os.path.join(basedir, "contents.xpi")
        xpi.build_xpi(template_root_dir=xpi_template_path,
                      manifest=fake_manifest,
                      xpi_name=xpi_name,
                      harness_options=options,
                      limit_to=used_files)
        x = zipfile.ZipFile(xpi_name, "r")
        names = x.namelist()
        expected = ["components/harness.js",
                    # the real template also has 'bootstrap.js', but the fake
                    # one in tests/static-files/xpi-template doesn't
                    "harness-options.json",
                    "install.rdf",
                    "resources/p-api-utils-data/",
                    "resources/p-api-utils-lib/",
                    "resources/p-three-lib/",
                    "resources/p-three-lib/main.js",
                    "resources/p-three-a-lib/",
                    "resources/p-three-a-lib/main.js",
                    "resources/p-three-b-lib/",
                    "resources/p-three-b-lib/main.js",
                    "resources/p-three-c-lib/",
                    "resources/p-three-c-lib/main.js",
                    "resources/p-three-c-lib/sub/foo.js",
                    # notably absent: p-three-a-lib/unused.js
                    ]
        # showing deltas makes failures easier to investigate
        missing = set(expected) - set(names)
        self.failUnlessEqual(list(missing), [])
        extra = set(names) - set(expected)
        self.failUnlessEqual(list(extra), [])
        self.failUnlessEqual(sorted(names), sorted(expected))



def document_dir(name):
    if name in ['packages', 'xpi-template']:
        dirname = os.path.join(test_packaging.static_files_path, name)
        document_dir_files(dirname)
    elif name == 'xpi-output':
        create_xpi('test-xpi.xpi')
        document_zip_file('test-xpi.xpi')
        os.remove('test-xpi.xpi')
    else:
        raise Exception('unknown dir: %s' % name)

def normpath(path):
    """
    Make a platform-specific relative path use '/' as a separator.
    """

    return path.replace(os.path.sep, '/')

def document_zip_file(path):
    zip = zipfile.ZipFile(path, 'r')
    for name in sorted(zip.namelist()):
        contents = zip.read(name)
        lines = contents.splitlines()
        if len(lines) == 1 and name.endswith('.json') and len(lines[0]) > 75:
            # Ideally we would json-decode this, but it results
            # in an annoying 'u' before every string literal,
            # since json decoding makes all strings unicode.
            contents = eval(contents)
            contents = pprint.pformat(contents)
            lines = contents.splitlines()
        contents = "\n  ".join(lines)
        print "%s:\n  %s" % (normpath(name), contents)
    zip.close()

def document_dir_files(path):
    filename_contents_tuples = []
    for dirpath, dirnames, filenames in os.walk(path):
        relpath = dirpath[len(path)+1:]
        for filename in filenames:
            abspath = os.path.join(dirpath, filename)
            contents = open(abspath, 'r').read()
            contents = "\n  ".join(contents.splitlines())
            relfilename = os.path.join(relpath, filename)
            filename_contents_tuples.append((normpath(relfilename), contents))
    filename_contents_tuples.sort()
    for filename, contents in filename_contents_tuples:
        print "%s:" % filename
        print "  %s" % contents

def create_xpi(xpiname, pkg_name='aardvark', dirname='static-files'):
    configs = test_packaging.get_configs(pkg_name, dirname)
    options = {'main': configs.target_cfg.main}
    options.update(configs.build)
    xpi.build_xpi(template_root_dir=xpi_template_path,
                  manifest=fake_manifest,
                  xpi_name=xpiname,
                  harness_options=options)

if __name__ == '__main__':
    unittest.main()
