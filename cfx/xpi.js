const { Cc, Ci } = require("chrome");

const { ZipWriter } = require("./zip");
const file = require("api-utils/file");
const preferences = require("./preferences");
const { InternalCfxError, InvalidArgument } = require("./exception");

const FILE_SEPARATOR = require("api-utils/runtime").OS === "WINNT" ? "\\" : "/";

// Utility function which allow to concatenate file path fragments
// This function accept n-th arguments. It basically join given string with
// the correct file separator depending on your OS
function removeEmpty(value) {
  return value !== ""
}
function joinPath() {
  let list = Array.slice(arguments);
  return list.filter(removeEmpty).join(FILE_SEPARATOR);
}

// Utility function to ignore unwanted files in .xpi
const IGNORED_FILE_PREFIXES = ["."];
const IGNORED_FILE_SUFFIXES = ["~", ".swp"];
const IGNORED_DIRS = [".git", ".svn", ".hg"];

function isAcceptableDirectory(name) {
  return IGNORED_DIRS.indexOf(name) === -1;
}

function isAcceptableFile(name, blackList) {
  for (let i = 0; i < IGNORED_FILE_PREFIXES.length; i++) {
    let prefix = IGNORED_FILE_PREFIXES[i];
    if (name.substr(0, prefix.length) == prefix)
      return false;
  }
  for (let i = 0; i < IGNORED_FILE_SUFFIXES.length; i++) {
    let suffix = IGNORED_FILE_SUFFIXES[i];
    if (name.substr(-1 * suffix.length) == suffix)
      return false;
  }
  return true;
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
    while(entries.hasMoreElements()) {
      let entry = entries.getNext();
      entry.QueryInterface(Ci.nsIFile);
      if (entry.isDirectory()) {
        if (isAcceptableDirectory(entry.leafName)) {
          dirs.push(entry.leafName);
          readDir(joinPath(path, entry.leafName), entry);
        }
      }
      else {
        if (isAcceptableFile(entry.leafName))
          files.push(entry.leafName);
      }
    }
    directories.push({ path: path, dirnames: dirs, filenames: files });
  }
  readDir("", file);
  return directories;
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

// Write icon files
function writeIcons(zip, harnessOptions) {
  if ('icon' in harnessOptions) {
    zip.addFile("icon.png", harnessOptions.icon);
    delete harnessOptions.icon;
  }
  if ('icon64' in harnessOptions) {
    zip.addFile("icon64.png", harnessOptions.icon64);
    delete harnessOptions.icon64;
  }
}

// Write default preferences and xul options document (opened from about:addons)
function writePreferences(zip, jetpackId, preferences) {
  // Handle `preferences` from package.json
  if (preferences) {
    preferences.validate(preferences);

    opts_xul = preferences.generateOptionsXul(preferences,
                                              jetpackID);
    zip.addData("options.xul", opts_xul);

    prefs_js = preferences.generatePrefsJS(preferences,
                                           jetpackID);
    zip.addData("defaults/preferences/prefs.js", prefs_js);
  }
  else {
    zip.addData("defaults/preferences/prefs.js", "");
  }
}

// Write all harness files to xpi, mainly bootstrap.js
function writeTemplate(zip, templatePath) {
  // Copy addon/application template to the xpi
  for each (let directory in walkDir(templatePath)) {
    // TODO: implement filtering
    //filenames = list(filter_filenames(filenames, IGNORED_FILES))
    //dirnames[:] = filter_dirnames(dirnames)
    for each(let name in directory.dirnames) {
      let relpath = joinPath(directory.path, name);
      zip.mkdir(makeZipPath(relpath));
    }
    for each(let name in directory.filenames) {
      if (["install.rdf", "application.ini"].indexOf(name) !== -1)
        continue;
      let relpath = joinPath(directory.path, name);
      let abspath = joinPath(templatePath, relpath);
      zip.addFile(makeZipPath(relpath), abspath);
    }
  }
}

// Write all packages to resources/ folder
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
      let abs_dirname = packages[packageName][sectionName]
      let base_arcpath = ["resources", packageName, sectionName].join("/")
      // Always write the top directory, even if it contains no files, since
      // the harness will try to access it.
      zip.mkdir(base_arcpath);
      // cp -r stuff from abs_dirname/ into ZIP/resources/RESOURCEBASE/
      for each (let directory in walkDir(abs_dirname)) {
        let goodfiles = directory.filenames;
        for each(let filename in goodfiles) {
          let abspath = joinPath(abs_dirname, directory.path, filename)
          // Ignore xpi file
          if (abspath == xpiPath)
            continue;
          // strip unused files
          if (limitTo && limitTo.indexOf(abspath) === -1)
            continue;

          let arcpath = [
            "resources",
            packageName,
            sectionName];
          // directory.path may be an empty string for files at root folder
          if (directory.path.length > 0) {
            let dirPath = makeZipPath(directory.path);
            arcpath.push(dirPath);
            // Ensure creating a zip entry for sub folders
            zip.mkdir(arcpath.join("/"));
          }
          arcpath.push(filename);
          // Always use `/` as separator in zip
          zip.addFile(arcpath.join("/"), abspath);
        }
      }
    }
  }
}

// Write locale manifest and locale files to the xpi
function writeLocales(zip, locales) {
  // We store a sorted list of locales
  let languages = Object.keys(locales).sort();
  let localesManifest = {
    locales: languages
  };
  zip.addData("locales.json", prettyPrintJSON(localesManifest) + "\n");
  zip.mkdir("locale/");
  for each(let language in languages) {
    let locale = locales[language];
    zip.addData("locale/" + language + ".json", prettyPrintJSON(locale));
  }
}

// Write `harness-options.json` manifest file at xpi root
function writeManifest(zip, harnessOptions, extraHarnessOptions) {
  // TODO: print better error message on harness-options loading error
  //       "Error: Component returned failure code: 0x80520012 (NS_ERROR_FILE_NOT_FOUND) [nsIChannel.open]"

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
  if (!("xpiPath" in options))
    throw new InternalCfxError("Missing `xpiPath` in cfxjs options");
  if (!("harnessOptions" in options))
    throw new InternalCfxError(
      "Missing `harnessOptions` in cfxjs options");
  if (!("templatePath" in options))
    throw new InternalCfxError(
      "Missing `templatePath` in cfxjs options");
  if (!("locale" in options.harnessOptions))
    throw new InternalCfxError(
      "Missing `locale` in cfxjs options harnessOptions attribute");
  let harnessOptions = options.harnessOptions;

  let zip = new ZipWriter(options.xpiPath);

  try {
    zip.addData("install.rdf", options.installRdf);

    writeIcons(zip, harnessOptions);

    writePreferences(zip, harnessOptions.jetpackID,
                     harnessOptions.preferences ? harnessOptions.preferences
                                                : null);
    delete harnessOptions.preferences;

    writeTemplate(zip, options.templatePath);

    writePackages(zip, harnessOptions.packages, options.limitTo,
                  options.xpiPath);
    delete harnessOptions.packages;

    writeLocales(zip, harnessOptions.locale);
    delete harnessOptions.locale;

    writeManifest(zip, harnessOptions, options.extraHarnessOptions);
  }
  catch(e) {
    // In case or any error, we delete the eventually created xpi file
    // in order to avoid processing it in futher steps in python code
    zip.close();
    try {
      file.remove(options.xpiPath);
    }
    catch(e) {};
    throw e;
  }
  zip.close();
}
