import unittest
import xml.dom.minidom
import os.path

from cuddlefish import rdf, packaging

parent = os.path.dirname
test_dir = parent(os.path.abspath(__file__))
template_dir = os.path.join(parent(test_dir), "app-extension")

class RDFTests(unittest.TestCase):
    def testBug567660(self):
        obj = rdf.RDF()
        data = u'\u2026'.encode('utf-8')
        x = '<?xml version="1.0" encoding="utf-8"?><blah>%s</blah>' % data
        obj.dom = xml.dom.minidom.parseString(x)
        self.assertEqual(obj.dom.documentElement.firstChild.nodeValue,
                         u'\u2026')
        self.assertEqual(str(obj).replace("\n",""), x.replace("\n",""))

    def failUnlessIn(self, substring, s, msg=""):
        if substring not in s:
            self.fail("(%s) substring '%s' not in string '%s'"
                      % (msg, substring, s))

    def testUnpack(self):
        basedir = os.path.join(test_dir, "bug-715340-files")
        for n in ["pkg-1-pack", "pkg-2-pack", "pkg-3-pack",
                  "pkg-4-unpack", "pkg-5-unpack", "pkg-6-unpack",
                  "pkg-7-pack"]:
            cfg = packaging.get_config_in_dir(os.path.join(basedir, n))
            m = rdf.gen_manifest(template_dir, cfg, jid="JID")
            if n.endswith("-pack"):
                # these ones should remain packed
                self.failUnlessEqual(m.get("em:unpack"), "false")
                self.failUnlessIn("<em:unpack>false</em:unpack>", str(m), n)
            else:
                # and these should be unpacked
                self.failUnlessEqual(m.get("em:unpack"), "true")
                self.failUnlessIn("<em:unpack>true</em:unpack>", str(m), n)

if __name__ == '__main__':
    unittest.main()
