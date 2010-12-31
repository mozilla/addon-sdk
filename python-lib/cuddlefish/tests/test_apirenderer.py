
import os
import unittest
from cuddlefish.apiparser import parse_hunks, ParseError
from cuddlefish.apirenderer import md_to_html

tests_path = os.path.abspath(os.path.dirname(__file__))
static_files_path = os.path.join(tests_path, "static-files")

class ParserTests(unittest.TestCase):
    def pathname(self, filename):
        return os.path.join(static_files_path, "docs", filename)

    def render_markdown(self, pathname):
        return md_to_html(pathname)

    def test_renderer(self):
        test = self.render_markdown(self.pathname("APIsample.md"))
        reference = open(self.pathname("APIreference.html")).read()
        test_lines = test.splitlines(True)
        reference_lines = reference.splitlines(True)
        for x in range(len(test_lines)):
            self.assertEqual(test_lines[x], reference_lines[x])

if __name__ == "__main__":
    unittest.main()
