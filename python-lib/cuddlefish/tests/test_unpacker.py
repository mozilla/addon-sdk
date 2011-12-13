import os
import unittest
import zipfile
import shutil
from cStringIO import StringIO
from hashlib import md5 # CRC would be good enough for this purpose

import cuddlefish
from test_linker import up

class Unpacker(unittest.TestCase):
    def setUp(self):
        self.root = up(os.path.abspath(__file__), 4)
    def get_linker_files_dir(self, name):
        return os.path.join(up(os.path.abspath(__file__)),
                            "unpacker-files", name)
    def get_basedir(self):
        return os.path.abspath(os.path.join(".test_tmp", self.id()))
    def make_basedir(self):
        basedir = self.get_basedir()
        if os.path.isdir(basedir):
            here = os.path.abspath(os.getcwd())
            assert os.path.abspath(basedir).startswith(here) # safety
            shutil.rmtree(basedir)
        os.makedirs(basedir)
        return basedir

    def run_cfx(self, args, directory):
        out = StringIO()
        olddir = os.getcwd()
        try:
            os.chdir(directory)
            try:
                cuddlefish.run(arguments=args, stdout=out)
            except SystemExit, e:
                #print "OMG need to resolve this"
                return e.args[0], out.getvalue()
        finally:
            os.chdir(olddir)

    def scan_files(self, root):
        all_files = {}
        for dirpath, dirnames, filenames in os.walk(root):
            for fn in filenames:
                absfn = os.path.join(root, dirpath, fn)
                relfn = absfn[len(root+os.sep):]
                all_files[relfn] = md5(open(absfn,"rb").read()).hexdigest()
        return all_files

    def compare_trees(self, a, b):
        afiles = self.scan_files(a)
        bfiles = self.scan_files(b)
        in_a_not_b = set(afiles) - set(bfiles)
        in_b_not_a = set(bfiles) - set(afiles)
        in_both = set(afiles).union(set(bfiles))
        self.failIf(in_a_not_b, in_a_not_b)
        self.failIf(in_b_not_a, in_b_not_a)
        for fn in in_both:
            self.failUnlessEqual(afiles[fn], bfiles[fn],
                                 "%s differs between %s and %s" % (fn, a, b))

    def test_unpack(self):
        self.make_basedir()
        sourcedir = self.get_linker_files_dir("one")
        onedir = os.path.join(self.get_basedir(), "one")
        shutil.copytree(sourcedir, onedir)
        self.run_cfx(["xpi"], onedir)
        gen1_fn = os.path.join(onedir, "one.xpi")
        gen1_files = set([i.filename
                          for i in zipfile.ZipFile(gen1_fn,"r").infolist()])
        self.failUnless("decompile_data.json" in gen1_files)
        gen2_dir = os.path.join(self.get_basedir(), "gen2")
        self.run_cfx(["unpack", gen1_fn, gen2_dir], self.get_basedir())
        gen2_sourcedir = os.path.join(gen2_dir, "one")
        self.compare_trees(sourcedir, gen2_sourcedir)
        self.run_cfx(["xpi"], gen2_sourcedir)
        gen2_fn = os.path.join(gen2_sourcedir, "one.xpi")
        gen3_dir = os.path.join(self.get_basedir(), "gen3")
        self.run_cfx(["unpack", gen2_fn, gen3_dir], self.get_basedir())
        os.unlink(gen2_fn)
        self.compare_trees(gen2_dir, gen3_dir)
        
        


if __name__ == '__main__':
    unittest.main()

