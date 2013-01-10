# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import unittest
from cuddlefish import cfxjs

class TestCFX_JS(unittest.TestCase):

    # this method doesn't exists in python 2.5,
    # implements our own
    def assertIn(self, member, container):
        """Just like self.assertTrue(a in b), but with a nicer default message."""
        if member not in container:
            standardMsg = '"%s" not found in "%s"' % (member,
                                                  container)
            self.fail(standardMsg)

    def test_unknown_command(self):
        out, err = cfxjs.execute("foo", {}, catch_stdio=True)
        self.assertIn("Unknown cfxjs command 'foo'", out)


if __name__ == "__main__":
    unittest.main()
