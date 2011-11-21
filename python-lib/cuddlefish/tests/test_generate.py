import os
import shutil
import unittest
import StringIO
import tarfile
import HTMLParser
import urlparse
import urllib

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

def get_test_root():
    return os.path.join(env_root, "python-lib", "cuddlefish", "tests", "static-files")

def get_sdk_docs_root():
    return os.path.join(get_test_root(), "sdk-docs")

def get_base_url_path():
    return os.path.join(get_sdk_docs_root(), "doc")

def get_base_url():
    base_url_path = get_base_url_path().lstrip("/")
    return "file://"+"/"+"/".join(base_url_path.split(os.sep))+"/"

class Link_Checker(HTMLParser.HTMLParser):
    def __init__(self, tester, filename, base_url):
        HTMLParser.HTMLParser.__init__(self)
        self.tester = tester
        self.filename = filename
        self.base_url = base_url

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            href = dict(attrs).get('href', '')
            if href:
                self.validate_href(href)

    def validate_href(self, href):
        parsed = urlparse.urlparse(href)
        # there should not be any file:// URLs
        self.tester.assertNotEqual(parsed.scheme, "file")
        # any other absolute URLs will not be checked
        if parsed.scheme:
            return
        # otherwise try to open the file at: baseurl + path
        absolute_url = self.base_url + parsed.path
        try:
            urllib.urlopen(absolute_url)
        except IOError:
            self.tester.assertFalse(True, absolute_url + " link in " + self.filename + " is broken.")

class Generate_Docs_Tests(unittest.TestCase):

    def test_generate_static_docs(self):
        # make sure we start clean
        if os.path.exists(get_base_url_path()):
            shutil.rmtree(get_base_url_path())
        # generate a doc tarball, and extract it
        base_url = get_base_url()
        tar_filename = generate.generate_static_docs(env_root, base_url)
        tgz = tarfile.open(tar_filename)
        tgz.extractall(get_sdk_docs_root())
        # get each HTML file...
        for root, subFolders, filenames in os.walk(get_sdk_docs_root()):
            for filename in filenames:
                if not filename.endswith(".html"):
                    continue
                filename = os.path.join(root, filename)
                # ...and feed it to the link checker
                linkChecker = Link_Checker(self, filename, base_url)
                linkChecker.feed(open(filename, "r").read())
        # clean up
        shutil.rmtree(get_base_url_path())
        tgz.close()
        os.remove(tar_filename)
        generate.clean_generated_docs(os.path.join(env_root, "doc"))

    def test_generate_docs(self):
        test_root = get_test_root()
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
        os.utime(os.path.join(docs_root, "static-files", "another.html"), None)
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
