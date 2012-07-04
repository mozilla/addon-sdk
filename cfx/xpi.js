/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Cc, Ci } = require("chrome");

const { ZipWriter } = require("./zip");
const preferences = require("./preferences");
const { InternalCfxError, InvalidArgument } = require("./exception");

const FILE_SEPARATOR = require("api-utils/runtime").OS === "WINNT" ? "\\" : "/";

// Utility function which allow to concatenate file path fragments
// This function accept n-th arguments. It basically join given string with
// the correct file separator depending on your OS
function joinPath() {
  let list = Array.slice(arguments);
  // We ignore empty arguments in order to avoid having two adjacent separators
  return list.filter(isNotEmpty).join(FILE_SEPARATOR);
}
function isNotEmpty(value) {
  return value !== "";
}

// Utility function to ignore unwanted files in .xpi
const IGNORED_FILE_PREFIXES = ["."];
const IGNORED_FILE_SUFFIXES = ["~", ".swp"];
const IGNORED_DIRS = [".git", ".svn", ".hg"];

function isIgnoredDirectory(name) {
  return IGNORED_DIRS.indexOf(name) !== -1;
}

function isIgnoredFile(name) {
  return IGNORED_FILE_PREFIXES.some(function(prefix) {
    return name.indexOf(prefix) === 0;
  }) || IGNORED_FILE_SUFFIXES.some(function(suffix) {
    return name.substr(-1 * suffix.length) === suffix;
  });
}

// Utility function in order to read a folder recursively
// Returns a list of all sub-directories. Each directory is represented with
// an object contains following attributes:
// - path: relative path the the directory (is an empty string for root folder)
// - dirnames: a list of all directory names existing in this directory
// - filenames: a list of all file names available in this directory
function walkDir(path) {
  let file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
  try {
    file.initWithPath(path);
  } catch(e) {
    throw new Error("This directory path is not valid : " + path + "\n" + e);
  }
  let directories = [];
  function readDir(path, file) {
    let dirs = [], files = [];
    let entries = file.directoryEntries;
    while (entries.hasMoreElements()) {
      let entry = entries.getNext();
      entry.QueryInterface(Ci.nsIFile);
      if (entry.isDirectory()) {
        if (!isIgnoredDirectory(entry.leafName)) {
          dirs.push(entry.leafName);
          readDir(joinPath(path, entry.leafName), entry);
        }
      }
      else {
        if (!isIgnoredFile(entry.leafName))
          files.push(entry.leafName);
      }
    }
    directories.push({ path: path, dirnames: dirs, filenames: files });
  }
  readDir("", file);
  return directories;
}

function rm(path) {
  let file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
  try {
    file.initWithPath(path);
  } catch(e) {
    throw new Error("Can't delete non-existent file: " + path + "\n" + e);
  }
  try {
    file.remove(false);
  } catch(e) {
    throw new Error("Error while try to delete: " + path + "\n" + e);
  }
}

// Utility function for zip library usage. zip library only accept `/` as file
// separator for relative in-zip paths.
function makeZipPath(path) {
  return path.split(FILE_SEPARATOR).join("/");
}

// Return a pretty printed JSON string with 2 spaces indentation
function prettyPrintJSON(json) {
  return JSON.stringify(json, null, 2);
}

/**
 * Write icon files into xpi
 * @param {ZipWriter} zip
 *    ZipWriter instance for the xpi file
 * @param {String} icon
 *    Optional absolute path to default addon icon
 * @param {String} icon64
 *    Optional absolute path to default addon icon with bigger size (64x64)
 */
function writeIcons(zip, icon, icon64) {
  if (icon)
    zip.addFile("icon.png", icon);
  if (icon64)
    zip.addFile("icon64.png", icon64);
}

/**
 * Write default preferences file and xul options document (opened from
 * about:addons)
 * @param {ZipWriter} zip
 *    ZipWriter instance for the xpi file
 * @param {String} jetpackID
 *    Addon id
 * @param {Object} prefsManifest
 *    Preferences fields written in addon's package.json `preferences` attribute
 */
function writePreferences(zip, jetpackID, prefsManifest) {
  if (prefsManifest) {
    preferences.validate(prefsManifest);

    let optionsXul = preferences.generateOptionsXul(prefsManifest,
                                              jetpackID);
    zip.addData("options.xul", optionsXul);

    let prefsJs = preferences.generatePrefsJS(prefsManifest,
                                           jetpackID);
    zip.addData("defaults/preferences/prefs.js", prefsJs);
  }
  else {
    zip.addData("defaults/preferences/prefs.js", "");
  }
}

/**
 * Write all harness files to xpi, mainly bootstrap.js
 * @param {ZipWriter} zip
 *    ZipWriter instance for the xpi file
 * @param {String} templatePath
 *    Absolute path to the template directory from which we will install files
 */
function writeTemplate(zip, templatePath) {
  // Copy addon/application template to the xpi
  walkDir(templatePath).forEach(function (directory) {
    directory.dirnames.forEach(function (name) {
      let relpath = joinPath(directory.path, name);
      zip.mkdir(makeZipPath(relpath));
    });
    directory.filenames.filter(function (name) {
      return ["install.rdf", "application.ini"].indexOf(name) === -1;
    }).forEach(function (name) {
      let relpath = joinPath(directory.path, name);
      let abspath = joinPath(templatePath, relpath);
      zip.addFile(makeZipPath(relpath), abspath);
    });
  });
}

/**
 * Write all packages to `resources/` folder
 * @param {ZipWriter} zip
 *    ZipWriter instance for the xpi file
 * @param {Object} packages
 *     A dictionnary of packages. keys are packages names. Values are another
 *     dictionnary with packages section folder absolute path.
 *     These folders are written into `resources/` directory in the xpi.
 * @param {Array} limitTo
 *     List of all white-listed files. If given, only file whose absolute path
 *     is in this list are copied into the xpi.
 * @param {String} xpiPath
 *     Absolute path to the xpi file. Used to avoid copying the xpi in itself!
 */
function writePackages(zip, packages, limitTo, xpiPath) {
  // `packages` is a dictionnary whose keys are package name and values are
  // another dictionnary whose keys are section name (lib or test) and final
  // value is absolute path to this package's section
  zip.mkdir("resources");
  for (let packageName in packages) {
    // Always write the top directory, even if it contains no files, since
    // the harness will try to access it.
    zip.mkdir('resources/' + packageName);
    for (let sectionName in packages[packageName]) {
      // Get the section absolute path on file system
      let sectionAbsPath = packages[packageName][sectionName];
      // And the section relative path in the zip file
      let sectionZipPath = ["resources", packageName, sectionName].join("/");
      // Always write the top directory, even if it contains no files, since
      // the harness will try to access it.
      zip.mkdir(sectionZipPath);
      // cp -r stuff from sectionAbsPath/ into ZIP/resources/RESOURCEBASE/
      walkDir(sectionAbsPath).forEach(function (directory) {
        directory.filenames.forEach(function (filename) {
          // Get current file absolute path on file system
          let fileAbsPath = joinPath(sectionAbsPath, directory.path, filename);
          // Ignore xpi file
          if (fileAbsPath == xpiPath)
            return;
          // Strip unused files
          if (limitTo && limitTo.indexOf(fileAbsPath) === -1)
            return;

          // Now compute the file relative path in zip file
          let fileZipPath = [sectionZipPath];
          // directory.path may be an empty string for files at root folder
          if (directory.path.length > 0) {
            let dirPath = makeZipPath(directory.path);
            fileZipPath.push(dirPath);
            // Ensure creating a zip entry for sub folders
            zip.mkdir(fileZipPath.join("/"));
          }
          fileZipPath.push(filename);
          // Always use `/` as separator in zip
          zip.addFile(fileZipPath.join("/"), fileAbsPath);
        });
      });
    }
  }
}

/**
 * Write locale manifest and locale files to the xpi
 * @param {ZipWriter} zip
 *    ZipWriter instance for the xpi file
 * @param {Object} locales
 *    A dictionnary of available locales for this addon. Keys are language code
 *    and values are another dictionnary with all translated strings
 */
function writeLocales(zip, locales) {
  // We store a sorted list of locales
  let languages = Object.keys(locales).sort();
  let localesManifest = {
    locales: languages
  };
  zip.addData("locales.json", prettyPrintJSON(localesManifest) + "\n");
  zip.mkdir("locale/");
  languages.forEach(function (language) {
    let locale = locales[language];
    zip.addData("locale/" + language + ".json", prettyPrintJSON(locale));
  });
}

/**
 * Write `harness-options.json` manifest file at xpi root
 * @param {ZipWriter} zip
 *    ZipWriter instance for the xpi file
 * @param {Object} harnessOptions
 *    Manifest dictionnary to write into harness-options.json file
 * @param {Object} extraHarnessOptions
 *    Additional user attributes to inject into this file
 */
function writeManifest(zip, harnessOptions, extraHarnessOptions) {
  // TODO: print better error message on harness-options loading error
  // "Error: Component returned failure code: 0x80520012
  //  (NS_ERROR_FILE_NOT_FOUND) [nsIChannel.open]"

  // Include extra manifest options given manually to cfx
  for (let key in extraHarnessOptions) {
    if (key in harnessOptions) {
      throw new InvalidArgument(
        "Can't use --harness-option for existing key '" + key + "'");
    }
    harnessOptions[key] = extraHarnessOptions[key];
  }
  zip.addData("harness-options.json", prettyPrintJSON(harnessOptions));
}

exports.build = function buildXPI(options) {
  if (!("xpi-path" in options))
    throw new InternalCfxError("Missing `xpiPath` in cfxjs options");
  let xpiPath = options["xpi-path"];

  if (!("harness-options" in options))
    throw new InternalCfxError(
      "Missing `harnessOptions` in cfxjs options");
  let harnessOptions = options["harness-options"];

  if (!("template-path" in options))
    throw new InternalCfxError(
      "Missing `templatePath` in cfxjs options");
  let templatePath = options["template-path"];

  if (!("locale" in options))
    throw new InternalCfxError("Missing `locale` in cfxjs options");

  if (!("packages" in options))
    throw new InternalCfxError("Missing `packages` in cfxjs options");

  if (!("install-rdf" in options))
    throw new InternalCfxError(
      "Missing `install-rdf` in cfxjs options");
  let installRdf = options["install-rdf"];

  if (!("extra-harness-options" in options))
    throw new InternalCfxError(
      "Missing `extra-harness-options` in cfxjs options");
  let extraHarnessOptions = options["extra-harness-options"];

  if (!("limit-to" in options))
    throw new InternalCfxError(
      "Missing `limit-to` in cfxjs options");
  let limitTo = options["limit-to"];

  let zip = new ZipWriter(xpiPath);

  try {
    zip.addData("install.rdf", installRdf);

    writeIcons(zip, options.icon, options.icon64);

    writePreferences(zip, harnessOptions.jetpackID,
                     harnessOptions.preferences || null);

    writeTemplate(zip, templatePath);

    writePackages(zip, options.packages, limitTo, xpiPath);

    writeLocales(zip, options.locale);

    writeManifest(zip, harnessOptions, extraHarnessOptions);
  }
  catch(e) {
    // In case or any error, we delete the eventually created xpi file
    // in order to avoid processing it in futher steps in python code
    zip.close();
    try {
      // We do not care about any error while removing the xpi file,
      // we try to ensure that we do not leave any temporary file around.
      // It may not even be created.
      rm(xpiPath);
    }
    finally {
      throw e;
    }
  }
  zip.close();
}
