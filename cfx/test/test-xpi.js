/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Cc, Ci, Cu } = require("chrome");
let { setTimeout } = require("timer");
const AddonInstall = require("api-utils/addon/installer");
const xpi = require("xpi");
const self = require("self");
const { getChromeURIContent } = require("api-utils/utils/data");
const tmpFile = require("test-harness/tmp-file");
const file = require("api-utils/file");

const { AddonManager } = Cu.import("resource://gre/modules/AddonManager.jsm");
const stringConverter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].
                        createInstance(Ci.nsIScriptableUnicodeConverter);
stringConverter.charset = "UTF-8";

exports.testIt = function (test) {
  test.waitUntilDone(1000000);

  let xpiPath = tmpFile.createFromString("", "test.xpi");

  let metadata = {
    id: "test-install-rdf@jetpack",
    version: "1.2",
    name: "test install.rdf",
    description: "test install.rdf description",
    creator: "test creator"
  };
  let installRDF =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<RDF xmlns="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:em="http://www.mozilla.org/2004/em-rdf#">' +
      '<Description about="urn:mozilla:install-manifest">' +
        '<em:id>' + metadata.id + '</em:id>' +
        '<em:version>' + metadata.version + '</em:version>' +
        '<em:type>2</em:type>' +
        '<em:bootstrap>true</em:bootstrap>' +
        '<em:unpack>false</em:unpack>' +

        '<em:targetApplication>' +
          '<Description>' +
            '<em:id>{ec8030f7-c20a-464f-9b0e-13a3a9e97384}</em:id>' +
            '<em:minVersion>1</em:minVersion>' +
            '<em:maxVersion>*</em:maxVersion>' +
          '</Description>' +
        '</em:targetApplication>' +

        '<em:name>' + metadata.name + '</em:name>' +
        '<em:description>' + metadata.description + '</em:description>' +
        '<em:creator>' + metadata.creator + '</em:creator>' +
      '</Description>' +
    '</RDF>';

  function writeFile(path, content) {
    let testFile = file.open(path, "w");
    testFile.write(content);
    testFile.close();
  }

  // Create a section test directory
  let section = tmpFile.createDirectory("section");
  let rootJsFile = "root js file";
  writeFile(file.join(section, "test.js"), rootJsFile);
  file.mkpath(file.join(section, "folder"));
  let subFolderJsFile = "js file in a sub folder";
  writeFile(file.join(section, "folder", "test.js"), subFolderJsFile);
  writeFile(file.join(section, ".hidden"), "hidden file");
  writeFile(file.join(section, "test.js.swp"), "crap file");
  writeFile(file.join(section, "test.js~"), "crap file 2");
  file.mkpath(file.join(section, ".git"));
  writeFile(file.join(section, ".git", "test.js"), "git file");

  // Fill a template test directory
  let harness = tmpFile.createDirectory("harness");
  let bootstrapJsFile = "function install() {}; function startup() {};";
  writeFile(file.join(harness, "bootstrap.js"), bootstrapJsFile);
  file.mkpath(file.join(harness, "folder"));
  let templateFolderFile = "An arbitrary file from template in a folder";
  writeFile(file.join(harness, "folder", "template.foo"), templateFolderFile);

  let iconData = "icon";
  let icon64Data = "icon64";
  let usTranslation = "translation";
  let reverseTranslation = "uoıʇɐןsuɐɹʇ";
  let options = {
    "xpi-path": xpiPath,
    "template-path": harness,
    "install-rdf": installRDF,
    "harness-options": {
      "jetpackID": "foo@bar.com",
      "icon": tmpFile.createFromString(iconData, "icon.png"),
      "icon64": tmpFile.createFromString(icon64Data, "icon64.png"),
      "packages": {
        "api-utils": {
          "test": section,
          "lib": section
        }
      },
      "locale": {
        "en-US": {
          "key": usTranslation
        },
        "en-reverse": {
          "key": reverseTranslation
        }
      },
      "manifest": {}
    },
    "limit-to": null,
    "extra-harness-options": {
      "extra": "option"
    }
  };
  xpi.build(options);

  // Returns a pretty printed JSON string with 2 spaces indentation
  function prettyJSON(json) {
    return JSON.stringify(json, null, 2);
  }
  AddonInstall.install(xpiPath).then(function (addonId) {
    // Check that various metadata set in install.rdf are correctly set/read
    test.assertEqual(addonId, metadata.id);
    AddonManager.getAddonByID(addonId, function (addon) {
      test.assertEqual(addon.name, metadata.name);
      test.assertEqual(addon.description, metadata.description);
      test.assertEqual(addon.version, metadata.version);
      test.assertEqual(addon.creator.name, metadata.creator);
      test.assertEqual(getChromeURIContent(addon.iconURL), iconData);
      test.assertEqual(getChromeURIContent(addon.icon64URL), icon64Data);

      function assertFileContent(path, content) {
        let url = addon.getResourceURI(path).spec;
        try {
          let data = getChromeURIContent(url);
          // We need to convert string to UTF8 for locale files
          data = stringConverter.ConvertToUnicode(data);
          test.assertEqual(data, content);
        }
        catch(e) {
          test.fail("Failed to open '" + path + "'");
        }
      }
      // harness manifest contains only extra option and manifest attribute,
      // as all other are removed during xpi building process:
      let expectedHarnessOptions = {
        jetpackID: options["harness-options"].jetpackID,
        manifest: {},
        extra: "option"
      };
      assertFileContent("harness-options.json",
                        prettyJSON(expectedHarnessOptions));

      // Verify files coming from template directory:
      assertFileContent("bootstrap.js", bootstrapJsFile);
      assertFileContent("folder/template.foo", templateFolderFile);

      // Check files from package directories:
      assertFileContent("resources/api-utils/test/test.js", rootJsFile);
      assertFileContent("resources/api-utils/test/folder/test.js", subFolderJsFile);
      assertFileContent("resources/api-utils/lib/test.js", rootJsFile);
      assertFileContent("resources/api-utils/lib/folder/test.js", subFolderJsFile);

      // Ensure that unwanted files are not in xpi
      test.assert(!addon.hasResource("resources/api-utils/test/.hidden"));
      test.assert(!addon.hasResource("resources/api-utils/test/test.js.swp"));
      test.assert(!addon.hasResource("resources/api-utils/test/test.js~"));
      test.assert(!addon.hasResource("resources/api-utils/test/.git/test.js"));

      // Ensure locale files are correct:
      assertFileContent("locales.json",
                        prettyJSON({locales: ["en-US", "en-reverse"]}) + "\n");
      assertFileContent("locale/en-reverse.json",
                        prettyJSON({key: reverseTranslation}));
      assertFileContent("locale/en-US.json",
                        prettyJSON({key: usTranslation}));

      test.done();
    });
  });
}
