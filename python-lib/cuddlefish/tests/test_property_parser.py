import unittest

from cuddlefish.property_parser import parse, MalformedLocaleFileError

class TestParser(unittest.TestCase):

    def test_parse(self):
        pairs = parse([
          # Comments are striped only if `#` is the first non-space character
          "sharp=#can be in value",
          "# comment",
          "#key=value",
          "  # comment2",

          # All spaces before/after are striped
          " key = value ",
          "key2=value2",
          # Keys can contain '%'
          "%s key=%s value",

          # Accept empty lines
          "",
          "   ",

          # Multiline string must use backslash at end of lines
          "multi=line\\", "value",
          # With multiline string, left spaces are stripped ...
          "some= spaces\\", " are\\", " stripped ",
          # ... but not right spaces, except the last line!
          "but=not \\", "all of \\", " them "
        ])
        expected = {
          "sharp": "#can be in value",

          "key": "value",
          "key2": "value2",
          "%s key": "%s value",

          "multi": "linevalue",
          "some": "spacesarestripped",
          "but": "not all of them"
        }
        self.assertEqual(pairs, expected)

    def test_exceptions(self):
        self.failUnlessRaises(MalformedLocaleFileError, parse,
                              ["invalid line with no key value"])
        self.failUnlessRaises(MalformedLocaleFileError, parse,
                              ["plural[one]=plural with no generic value"])

if __name__ == "__main__":
    unittest.main()
