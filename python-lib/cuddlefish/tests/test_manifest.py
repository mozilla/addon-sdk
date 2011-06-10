
import os, re
import unittest
from StringIO import StringIO
from cuddlefish.manifest import scan_module

class Extra:
    def failUnlessKeysAre(self, d, keys):
        self.failUnlessEqual(sorted(d.keys()), sorted(keys))

class Require(unittest.TestCase, Extra):
    def scan(self, text):
        lines = StringIO(text).readlines()
        requires, problems = scan_module("fake.js", lines)
        self.failUnlessEqual(problems, False)
        return requires

    def test_modules(self):
        mod = """var foo = require('one');"""
        requires = self.scan(mod)
        self.failUnlessKeysAre(requires, ["one"])

        mod = """var foo = require(\"one\");"""
        requires = self.scan(mod)
        self.failUnlessKeysAre(requires, ["one"])

        mod = """var foo=require(  'one' )  ;  """
        requires = self.scan(mod)
        self.failUnlessKeysAre(requires, ["one"])

        mod = """var foo = require('o'+'ne'); // tricky, denied"""
        requires = self.scan(mod)
        self.failUnlessKeysAre(requires, [])

        mod = """require('one').immediately.do().stuff();"""
        requires = self.scan(mod)
        self.failUnlessKeysAre(requires, ["one"])

        # these forms are commented out, and thus ignored

        mod = """// var foo = require('one');"""
        requires = self.scan(mod)
        self.failUnlessKeysAre(requires, [])

        mod = """/* var foo = require('one');"""
        requires = self.scan(mod)
        self.failUnlessKeysAre(requires, [])

        mod = """ * var foo = require('one');"""
        requires = self.scan(mod)
        self.failUnlessKeysAre(requires, [])

        mod = """ ' var foo = require('one');"""
        requires = self.scan(mod)
        self.failUnlessKeysAre(requires, [])

        mod = """ \" var foo = require('one');"""
        requires = self.scan(mod)
        self.failUnlessKeysAre(requires, [])

        # multiple requires

        mod = """const foo = require('one');
        const foo = require('two');"""
        requires = self.scan(mod)
        self.failUnlessKeysAre(requires, ["one", "two"])

        mod = """const foo = require('one'); const foo = require('two');"""
        requires = self.scan(mod)
        self.failUnlessKeysAre(requires, ["one", "two"])

        # define calls

        mod = """define('one', ['two', 'numbers/three'], function(t, th) {});"""
        requires = self.scan(mod)
        self.failUnlessKeysAre(requires, ["two", "numbers/three"])

        mod = """define(
        ['odd',
        "numbers/four"], function() {});"""
        requires = self.scan(mod)
        self.failUnlessKeysAre(requires, ["odd", "numbers/four"])

        mod = """define(function(require, exports, module) {
                var a = require("some/module/a"),
                    b = require('b/v1');
                exports.a = a;
                //This is a fakeout: require('bad');
                /* And another var bad = require('bad2'); */
                require('foo').goFoo();
            });"""
        requires = self.scan(mod)
        self.failUnlessKeysAre(requires, ["some/module/a", "b/v1", "foo"])

        mod = """define (
            "foo",
            ["bar"], function (bar) {
                var me = require("me");
            }
        )"""
        requires = self.scan(mod)
        self.failUnlessKeysAre(requires, ["bar", "me"])

        mod = """define(['se' + 'ven', 'eight', nine], function () {});"""
        requires = self.scan(mod)
        self.failUnlessKeysAre(requires, ["eight"])

        # async require calls

        mod = """require(['one'], function(one) {var o = require("one");});"""
        requires = self.scan(mod)
        self.failUnlessKeysAre(requires, ["one"])

        mod = """require([  'one' ], function(one) {var t = require("two");});"""
        requires = self.scan(mod)
        self.failUnlessKeysAre(requires, ["one", "two"])

        mod = """require ( ['two', 'numbers/three'], function(t, th) {});"""
        requires = self.scan(mod)
        self.failUnlessKeysAre(requires, ["two", "numbers/three"])

        mod = """require (
            ["bar", "fa" + 'ke'  ], function (bar) {
                var me = require("me");
                // require("bad").doBad();
            }
        )"""
        requires = self.scan(mod)
        self.failUnlessKeysAre(requires, ["bar", "me"])

def scan2(text, fn="fake.js"):
    stderr = StringIO()
    lines = StringIO(text).readlines()
    requires, problems = scan_module(fn, lines, stderr)
    stderr.seek(0)
    return requires, problems, stderr.readlines()

class Chrome(unittest.TestCase, Extra):

    def test_ignore_loader(self):
        # we specifically ignore the two loader files
        mod = """let {Cc,Ci} = require('chrome');"""
        requires, problems, err = scan2(mod, "blah/cuddlefish.js")
        self.failUnlessKeysAre(requires, ["chrome"])
        self.failUnlessEqual(problems, False)
        self.failUnlessEqual(err, [])

        mod = """let {Cc,Ci} = require('chrome');"""
        requires, problems, err = scan2(mod, "securable-module.js")
        self.failUnlessKeysAre(requires, ["chrome"])
        self.failUnlessEqual(problems, False)
        self.failUnlessEqual(err, [])

    def test_chrome(self):
        mod = """let {Cc,Ci} = require('chrome');"""
        requires, problems, err = scan2(mod)
        self.failUnlessKeysAre(requires, ["chrome"])
        self.failUnlessEqual(problems, False)
        self.failUnlessEqual(err, [])

        mod = """var foo = require('foo');
        let {Cc,Ci} = require('chrome');"""
        requires, problems, err = scan2(mod)
        self.failUnlessKeysAre(requires, ["foo", "chrome"])
        self.failUnlessEqual(problems, False)
        self.failUnlessEqual(err, [])

        mod = """let c = require('chrome');"""
        requires, problems, err = scan2(mod)
        self.failUnlessKeysAre(requires, ["chrome"])
        self.failUnlessEqual(problems, False)
        self.failUnlessEqual(err, [])

        mod = """var foo = require('foo');
        let c = require('chrome');"""
        requires, problems, err = scan2(mod)
        self.failUnlessKeysAre(requires, ["foo", "chrome"])
        self.failUnlessEqual(problems, False)
        self.failUnlessEqual(err, [])

    def test_not_chrome(self):
        # from bug 596595
        mod = r'soughtLines: new RegExp("^\\s*(\\[[0-9 .]*\\])?\\s*\\(\\((EE|WW)\\)|.* [Cc]hipsets?: \\)|\\s*Backtrace")'
        requires, problems, err = scan2(mod)
        self.failUnlessKeysAre(requires, [])
        self.failUnlessEqual((problems,err), (False, []))

    def test_not_chrome2(self):
        # from bug 655788
        mod = r"var foo = 'some stuff Cr';"
        requires, problems, err = scan2(mod)
        self.failUnlessKeysAre(requires, [])
        self.failUnlessEqual((problems,err), (False, []))

class BadChrome(unittest.TestCase, Extra):
    def test_bad_alias(self):
        # using Components.* gets you a warning. If it looks like you're
        # using it to build an alias, the warning suggests a better way.
        mod = """let Cc = Components.classes;
        let Cu = Components.utils;"""
        requires, problems, err = scan2(mod)
        self.failUnlessKeysAre(requires, [])
        self.failUnlessEqual(problems, True)
        self.failUnlessEqual(err[1], "To use chrome authority, you need a line like this:\n") 
        self.failUnlessEqual(err[2], '  const {Cc,Cu} = require("chrome");\n')
        self.failUnlessEqual(err[3], "because things like 'Components.classes' will not be available\n")

    def test_bad_misc(self):
        # If it looks like you're using something that doesn't have an alias,
        # the warning also suggests a better way.
        mod = """if (Components.isSuccessCode(foo))"""
        requires, problems, err = scan2(mod)
        self.failUnlessKeysAre(requires, [])
        self.failUnlessEqual(problems, True)
        self.failUnlessEqual(err[1], "To use chrome authority, you need a line like this:\n") 
        self.failUnlessEqual(err[2], '  const {components} = require("chrome");\n')

if __name__ == '__main__':
    unittest.main()
