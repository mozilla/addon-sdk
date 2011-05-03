import os, unittest, shutil
from StringIO import StringIO
from cuddlefish import initializer
from cuddlefish import run_in_temp_subdir
from cuddlefish.templates import MAIN_JS, TEST_MAIN_JS
from cuddlefish import packaging

class TestInit(unittest.TestCase):

    def do_test_init(self,basedir):
        # Let's init the addon, no error admited
        f = open(".ignoreme","w")
        f.write("stuff")
        f.close()

        keydir = os.path.join(basedir, ".jetpack-keys")
        out, err = StringIO(), StringIO()
        init_run = initializer(None, ["init"], "default", keydir, out, err)
        out, err = out.getvalue(), err.getvalue()
        self.assertEqual(init_run, 0)
        self.assertTrue("* lib directory created" in out)
        self.assertTrue("* data directory created" in out)
        self.assertTrue("Have fun!" in out)
        self.assertEqual(err,"No 'id' in package.json: creating a new keypair for you.\n")
        self.assertTrue(len(os.listdir(basedir))>0)
        main_js = os.path.join(basedir,"lib","main.js")
        package_json = os.path.join(basedir,"package.json")
        test_main_js = os.path.join(basedir,"test","test-main.js")
        self.assertTrue(os.path.exists(main_js))
        self.assertTrue(os.path.exists(package_json))
        self.assertTrue(os.path.exists(test_main_js))
        self.assertEqual(open(main_js,"r").read(),MAIN_JS)

        package_cfg = packaging.load_json_file(package_json)
        self.assertTrue("id" in package_cfg)
        self.assertEqual(package_cfg["name"], "tmp_addon_sample")

        self.assertEqual(open(test_main_js,"r").read(),TEST_MAIN_JS)

        # Let's check that the addon is initialized
        out, err = StringIO(), StringIO()
        init_run = initializer(None, ["init"], "default", keydir, out, err)
        out, err = out.getvalue(), err.getvalue()
        self.failIfEqual(init_run,0)
        self.assertTrue("This command must be run in an empty directory." in err)

    def test_initializer(self):
        run_in_temp_subdir(os.path.join(self.id(), "tmp_addon_sample"),
                           self.do_test_init)

    def do_test_args(self, basedir):
        # check that running it with spurious arguments will fail
        out,err = StringIO(), StringIO()
        init_run = initializer(None, ["init", "ignored-dirname"], "default", None, out, err)
        out, err = out.getvalue(), err.getvalue()
        self.failIfEqual(init_run, 0)
        self.assertTrue("Too many arguments" in err)

    def test_args(self):
        run_in_temp_subdir(os.path.join(self.id(), "tmp_addon_sample"),
                           self.do_test_args)

    def _test_existing_files(self, basedir):
        f = open("pay_attention_to_me","w")
        f.write("stuff")
        f.close()
        out,err = StringIO(), StringIO()
        rc = initializer(None, ["init"], "default", None, out, err)
        out, err = out.getvalue(), err.getvalue()
        self.assertEqual(rc, 1)
        self.failUnless("This command must be run in an empty directory" in err,
                        err)
        self.failIf(os.path.exists("lib"))

    def test_existing_files(self):
        run_in_temp_subdir(os.path.join(self.id(), "existing_files"),
                           self._test_existing_files)

if __name__ == "__main__":
    unittest.main()
