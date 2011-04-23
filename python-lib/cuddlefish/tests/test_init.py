import os, unittest, shutil
from StringIO import StringIO
from cuddlefish import initializer
from cuddlefish.templates import MAIN_JS, TEST_MAIN_JS, PACKAGE_JSON

class TestInit(unittest.TestCase):

    def run_init_in_subdir(self, dirname, f, *args, **kwargs):
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

    def do_test_init(self,basedir):
        # Let's init the addon, no error admited
        f = open(".ignoreme","w")
        f.write("stuff")
        f.close()

        out, err = StringIO(), StringIO()
        init_run = initializer(None, ["init"], out, err)
        out, err = out.getvalue(), err.getvalue()
        self.assertEqual(init_run, 0)
        self.assertTrue("* lib directory created" in out)
        self.assertTrue("* data directory created" in out)
        self.assertTrue("Have fun!" in out)
        self.assertEqual(err,"")
        self.assertTrue(len(os.listdir(basedir))>0)
        main_js = os.path.join(basedir,"lib","main.js")
        package_json = os.path.join(basedir,"package.json")
        test_main_js = os.path.join(basedir,"test","test-main.js")
        self.assertTrue(os.path.exists(main_js))
        self.assertTrue(os.path.exists(package_json))
        self.assertTrue(os.path.exists(test_main_js))
        self.assertEqual(open(main_js,"r").read(),MAIN_JS)
        self.assertEqual(open(package_json,"r").read(),
                         PACKAGE_JSON % {"name":"tmp_addon_sample"})
        self.assertEqual(open(test_main_js,"r").read(),TEST_MAIN_JS)

        # Let's check that the addon is initialized
        out, err = StringIO(), StringIO()
        init_run = initializer(None, ["init"], out, err)
        out, err = out.getvalue(), err.getvalue()
        self.failIfEqual(init_run,0)
        self.assertTrue("This command must be run in an empty directory." in err)

    def test_initializer(self):
        self.run_init_in_subdir("tmp_addon_sample",self.do_test_init)

    def do_test_args(self, basedir):
        # check that running it with spurious arguments will fail
        out,err = StringIO(), StringIO()
        init_run = initializer(None, ["init", "ignored-dirname"], out, err)
        out, err = out.getvalue(), err.getvalue()
        self.failIfEqual(init_run, 0)
        self.assertTrue("Too many arguments" in err)

    def test_args(self):
        self.run_init_in_subdir("tmp_addon_sample", self.do_test_args)

    def _test_existing_files(self, basedir):
        f = open("pay_attention_to_me","w")
        f.write("stuff")
        f.close()
        out,err = StringIO(), StringIO()
        rc = initializer(None, ["init"], out, err)
        out, err = out.getvalue(), err.getvalue()
        self.assertEqual(rc, 1)
        self.failUnless("This command must be run in an empty directory" in err,
                        err)
        self.failIf(os.path.exists("lib"))

    def test_existing_files(self):
        self.run_init_in_subdir("existing_files", self._test_existing_files)

if __name__ == "__main__":
    unittest.main()
