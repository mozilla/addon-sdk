
import unittest
from cuddlefish.manifest import filter_filenames, filter_dirnames

class Filter(unittest.TestCase):
    def test_filter_filenames(self):
        names = ["foo", "bar.js", "image.png",
                 ".hidden", "foo~", ".foo.swp", "bar.js.swp"]
        self.failUnlessEqual(sorted(filter_filenames(names)),
                             sorted(["foo", "bar.js", "image.png"]))

    def test_filter_dirnames(self):
        names = ["subdir", "data", ".git", ".hg", ".svn"]
        self.failUnlessEqual(sorted(filter_dirnames(names)),
                             sorted(["subdir", "data"]))

if __name__ == '__main__':
    unittest.main()
