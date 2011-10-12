import os
import shutil
import unittest
import StringIO

from cuddlefish.docs import generate
from cuddlefish.tests import env_root

INITIAL_FILESET = [ ["static-files", "base.html"], \
                    ["dev-guide", "welcome.html"], \
                    ["packages", "aardvark", "aardvark.html"] ]

EXTENDED_FILESET = [ ["static-files", "base.html"], \
                    ["dev-guide", "extra.html"], \
                    ["dev-guide", "welcome.html"], \
                    ["packages", "aardvark", "aardvark.html"] ]

EXTRAFILE = ["dev-guide", "extra.html"]

class Generate_Docs_Tests(unittest.TestCase):
    def test_generate_static_docs_does_not_smoke(self):
        filename = 'testdocs.tgz'
        if os.path.exists(filename):
            os.remove(filename)
        filename = generate.generate_static_docs(env_root)
        self.assertTrue(os.path.exists(filename))
        os.remove(filename)

    def test_generate_docs_does_not_smoke(self):
        test_root = os.path.join(env_root, "python-lib", "cuddlefish", "tests", "static-files")
        docs_root = os.path.join(test_root, "doc")
        generate.clean_generated_docs(docs_root)
        new_digest = self.check_generate_regenerate_cycle(test_root, INITIAL_FILESET)
        # touching an MD file under packages **does** cause a regenerate
        os.utime(os.path.join(test_root, "packages", "aardvark", "doc", "main.md"), None)
        new_digest = self.check_generate_regenerate_cycle(test_root, INITIAL_FILESET, new_digest)
        # touching a non MD file under packages **does not** cause a regenerate
        os.utime(os.path.join(test_root, "packages", "aardvark", "lib", "main.js"), None)
        self.check_generate_is_skipped(test_root, INITIAL_FILESET, new_digest)
        # touching a non MD file under static-files **does not** cause a regenerate
        os.utime(os.path.join(docs_root, "static-files", "base.html"), None)
        new_digest = self.check_generate_is_skipped(test_root, INITIAL_FILESET, new_digest)
        # touching an MD file under dev-guide **does** cause a regenerate
        os.utime(os.path.join(docs_root, "dev-guide-source", "welcome.md"), None)
        new_digest = self.check_generate_regenerate_cycle(test_root, INITIAL_FILESET, new_digest)
        # adding a file **does** cause a regenerate
        open(os.path.join(docs_root, "dev-guide-source", "extra.md"), "w").write("some content")
        new_digest = self.check_generate_regenerate_cycle(test_root, EXTENDED_FILESET, new_digest)
        # deleting a file **does** cause a regenerate
        os.remove(os.path.join(docs_root, "dev-guide-source", "extra.md"))
        new_digest = self.check_generate_regenerate_cycle(test_root, INITIAL_FILESET, new_digest)
        # remove the files
        generate.clean_generated_docs(docs_root)

    def check_generate_is_skipped(self, test_root, files_to_expect, initial_digest):
        generate.generate_docs(test_root, stdout=StringIO.StringIO())
        docs_root = os.path.join(test_root, "doc")
        for file_to_expect in files_to_expect:
            self.assertTrue(os.path.exists(os.path.join(docs_root, *file_to_expect)))
        self.assertTrue(initial_digest == open(os.path.join(docs_root, "status.md5"), "r").read())

    def check_generate_regenerate_cycle(self, test_root, files_to_expect, initial_digest = None):
        # test that if we generate, files are getting generated
        generate.generate_docs(test_root, stdout=StringIO.StringIO())
        docs_root = os.path.join(test_root, "doc")
        for file_to_expect in files_to_expect:
            self.assertTrue(os.path.exists(os.path.join(docs_root, *file_to_expect)))
        if initial_digest:
            self.assertTrue(initial_digest != open(os.path.join(docs_root, "status.md5"), "r").read())
        # and that if we regenerate, nothing changes...
        new_digest = open(os.path.join(docs_root, "status.md5"), "r").read()
        self.check_generate_is_skipped(test_root, files_to_expect, new_digest)
        return new_digest

if __name__ == '__main__':
    unittest.main()
