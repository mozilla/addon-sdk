import os
import datetime
import zipfile
import simplejson as json
from cuddlefish.util import filter_filenames, filter_dirnames

class HarnessOptionAlreadyDefinedError(Exception):
    """You cannot use --harness-option on keys that already exist in
    harness-options.json"""

ZIPSEP = "/" # always use "/" in zipfiles

def make_zipfile_path(localroot, localpath):
    return ZIPSEP.join(localpath[len(localroot)+1:].split(os.sep))

def create_template_map(template_root_dir, IGNORED_FILES):
    template_map = {} # zipfile pathname to local disk filename
    for dirpath, dirnames, filenames in os.walk(template_root_dir):
        dirnames[:] = filter_dirnames(dirnames)
        for filename in filter_filenames(filenames, IGNORED_FILES):
            abspath = os.path.join(dirpath, filename)
            arcpath = make_zipfile_path(template_root_dir, abspath)
            template_map[arcpath] = abspath
    return template_map

def mkzipdir(zf, path):
    now = datetime.datetime.now()
    t = (now.year, now.month, now.day, now.hour, now.minute, now.second)
    dirinfo = zipfile.ZipInfo(path, date_time=t)
    dirinfo.external_attr = int("040755", 8) << 16L
    zf.writestr(dirinfo, "")

def mkzipfile(zf, path, data):
    now = datetime.datetime.now()
    t = (now.year, now.month, now.day, now.hour, now.minute, now.second)
    fileinfo = zipfile.ZipInfo(path, date_time=t)
    fileinfo.external_attr = int("100644", 8) << 16L
    zf.writestr(fileinfo, data)

def build_xpi(template_root_dir, manifest_rdf, xpi_path,
              harness_options, build, extra_harness_options={}):
    harness_options = harness_options.copy()
    IGNORED_FILES = [".hgignore", ".DS_Store", "install.rdf",
                     "application.ini", xpi_path]
    # these map zipfile path to local-disk abspath
    template_map = create_template_map(template_root_dir, IGNORED_FILES)
    compile_map = build.compile_map
    # this maps zipfile path to a bytestring
    pseudofile_map = build.pseudofile_map.copy()
    decompile_data = build.decompile_data

    pseudofile_map['install.rdf'] = str(manifest_rdf)

    pseudofile_map['defaults/preferences/prefs.js'] = ""
    if 'preferences' in build:
        from options_xul import parse_options, validate_prefs
        from options_defaults import parse_options_defaults

        validate_prefs(build["preferences"])
        options_xul = parse_options(build["preferences"],
                                    harness_options["jetpackID"])
        pseudofile_map['options.xul'] = options_xul

        prefs_js = parse_options_defaults(build["preferences"],
                                          harness_options["jetpackID"])
        pseudofile_map['defaults/preferences/prefs.js'] = prefs_js

    for key,value in extra_harness_options.items():
        if key in harness_options:
            msg = "Can't use --harness-option for existing key '%s'" % key
            raise HarnessOptionAlreadyDefinedError(msg)
        harness_options[key] = value

    harness_options_json = json.dumps(harness_options, indent=1, sort_keys=True)
    pseudofile_map['harness-options.json'] = harness_options_json

    decompile = json.dumps(decompile_data, indent=1, sort_keys=True)
    pseudofile_map["decompile_data.json"] = decompile

    files = set(list(compile_map) + list(template_map) + list(pseudofile_map))

    # now figure out which directories we need: all parents of all files
    dirs_to_create = set() # zipfile paths, no trailing slash
    for arcpath in files:
        bits = arcpath.split(ZIPSEP)
        for i in range(1,len(bits)):
            parentpath = ZIPSEP.join(bits[0:i])
            dirs_to_create.add(parentpath)

    # now create zipfile in alphabetical order, with each directory before
    # its files. We want a directory named "foo" to sort *after* a file named
    # "foo.data" and before a file named "foo/bar", so we sort on a tuple of
    # zip-path components
    zf = zipfile.ZipFile(xpi_path, "w", zipfile.ZIP_DEFLATED)
    for name in sorted(files.union(dirs_to_create),
                       key=lambda path: path.split(ZIPSEP)):
        if name in dirs_to_create:
            mkzipdir(zf, name+"/")
        if name in template_map:
            zf.write(template_map[name], name)
        if name in compile_map:
            zf.write(compile_map[name], name)
        if name in pseudofile_map:
            mkzipfile(zf, name, pseudofile_map[name])
    zf.close()
