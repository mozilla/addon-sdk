"""
Add-on templates for 'cfx init'
"""

import os

#Template used by main.js
MAIN_JS = '''\
const widgets = require("widget");
const tabs = require("tabs");

var widget = widgets.Widget({
  id: "mozilla-link",
  label: "Mozilla website",
  contentURL: "http://www.mozilla.org/favicon.ico",
  onClick: function() {
    tabs.open("http://www.mozilla.org/");
  }
});

console.log("The add-on is running.");
'''

#Template used by test-main.js
TEST_MAIN_JS = '''\
const main = require("main");

exports.test_test_run = function(test) {
  test.pass("Unit test running!");
};

exports.test_id = function(test) {
  test.assert(require("self").id.length > 0);
};

exports.test_url = function(test) {
  require("request").Request({
    url: "http://www.mozilla.org/",
    onComplete: function(response) {
      test.assertEqual(response.statusText, "OK");
      test.done();
    }
  }).get();
  test.waitUntilDone(20000);
};

exports.test_open_tab = function(test) {
  const tabs = require("tabs");
  tabs.open({
    url: "about:",
    onReady: function(tab) {
      test.assertEqual(tab.url, "about:");
      test.done();
    }
  });
  test.waitUntilDone(20000);
};
'''

TEST_XUL_MODULE='''\
const {Cu} = require("chrome");

exports.test_modules = function(test) {
  // test that chrome.manifest was processed by checking that the resource://
  // URL registered in the manifest works.
  var obj = {};
  Cu.import("resource://%(name)s-res/module.jsm", obj);
  test.assertEqual(obj.exported_test, "foo");
};
'''

XUL_MODULE='''\
EXPORTED_SYMBOLS = ["exported_test"]
var exported_test = "foo";
'''

#Template used by main.md
MAIN_JS_DOC = '''\
The main module is a program that creates a widget.  When a user clicks on
the widget, the program loads the mozilla.org website in a new tab.
'''

#Template used by README.md
README_DOC = '''\
This is the %(name)s add-on.  It contains:

* A program (lib/main.js).
* A few tests.
* Some meager documentation.
'''

def get_simple_package_json(addon_name):
  return {
    "name": addon_name.lower(),
    "fullName": addon_name,
    "description": "a basic add-on",
    "author": "",
    "license": "MPL 1.1/GPL 2.0/LGPL 2.1",
    "version": "0.1"
  }

def get_xul_package_json(addon_name):
  obj = get_simple_package_json(addon_name)

  import uuid
  obj["templatedir"] = "extension"
  obj["harnessClassID"] = str(uuid.uuid4())
  return obj

def app_extension_path(env_root):
  return os.path.join(env_root, "python-lib", "cuddlefish", "app-extension")

def copy_from_template(path_in_template):
  def write_copy(target_cfg, env_root):
    src_path = os.path.join(app_extension_path(env_root),
                            *path_in_template.split("/"))
    return open(src_path).read()
  return write_copy

def write_xul_chrome_manifest(target_cfg, env_root):
  return """\
# This registers the 'harness' component, which is the entry point
# for the Addon SDK-based part of the extension.
component {%(harness_guid)s} components/harness.js
contract @mozilla.org/harness-service;1?id=%(id)s {%(harness_guid)s}
category profile-after-change %(name)s-harness @mozilla.org/harness-service;1?id=%(id)s

# This is used in tests/test-module.js to test that chrome.manifest
# was loaded for this extension.
resource %(name)s-res modules/
""" % {"harness_guid": target_cfg["harnessClassID"],
       "id": target_cfg["id"],
       "name": target_cfg["name"]}

def write_xul_install_rdf(target_cfg, env_root):
  from rdf import gen_manifest
  manifest = gen_manifest(template_root_dir=app_extension_path(env_root),
                          target_cfg=target_cfg,
                          # mirroring the code in cuddlefish.run()
                          bundle_id=target_cfg["id"] + "@jetpack",
                          update_url=None,
                          bootstrap=False)
  return str(manifest)

EMPTY_FOLDER = '''\
  This is a special value indicating that the template item is an empty folder
'''

addon_templates = {
  "default": {
    "get_package_json_obj": get_simple_package_json,
    "content": {
      "lib/main.js": MAIN_JS,
      "data/": EMPTY_FOLDER,
      "doc/main.md": MAIN_JS_DOC,
      "test/test-main.js": TEST_MAIN_JS,
      "README.md": README_DOC
    }
  },
  "xul": {
    "get_package_json_obj": get_xul_package_json,
    "content": {
      "lib/main.js": MAIN_JS,
      "data/": EMPTY_FOLDER,
      "doc/main.md": MAIN_JS_DOC,
      "test/test-main.js": TEST_MAIN_JS,
      "test/test-module.js": TEST_XUL_MODULE,
      "README.md": README_DOC,
      "extension/chrome.manifest": write_xul_chrome_manifest,
      "extension/install.rdf": write_xul_install_rdf,
      "extension/components/harness.js":
        copy_from_template("components/harness.js"),
      "extension/modules/module.jsm": XUL_MODULE
    }
  }
}
