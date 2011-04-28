import os
import unittest
import zipfile
import pprint

import simplejson as json
from cuddlefish import xpi
from cuddlefish.tests import test_packaging

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
        if self.xpiname:
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
