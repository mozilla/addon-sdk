# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import os
import zipfile
import simplejson as json
from util import filter_filenames, filter_dirnames
from options_defaults import parse_options_defaults

from xpi import make_zipfile_path, mkzipdir

ZIPSEP = "/" # always use "/" in zipfiles

def build_xpi(template_root_dir="", manifest="", xpi_path="",
              harness_options={}, limit_to=None, extra_harness_options={},
              bundle_sdk=True, pkgdir=""):
    print "Native Build"
    IGNORED_FILES = [".hgignore", ".DS_Store", "install.rdf",
                     "application.ini", xpi_path]

    files_to_copy = {} # maps zipfile path to local-disk abspath
    dirs_to_create = set() # zipfile paths, no trailing slash

    zf = zipfile.ZipFile(xpi_path, "w", zipfile.ZIP_DEFLATED)

    for dirpath, dirnames, filenames in os.walk(pkgdir):
        filenames = list(filter_filenames(filenames, IGNORED_FILES))
        dirnames[:] = filter_dirnames(dirnames)

        for dirname in dirnames:
            arcpath = make_zipfile_path(pkgdir, os.path.join(dirpath, dirname))
            dirs_to_create.add(arcpath)

        for filename in filenames:
            abspath = os.path.join(dirpath, filename)
            arcpath = make_zipfile_path(pkgdir, abspath)
            files_to_copy[arcpath] = abspath

    # now figure out which directories we need: all retained files parents
    for arcpath in files_to_copy:
        bits = arcpath.split("/")
        for i in range(1,len(bits)):
            parentpath = ZIPSEP.join(bits[0:i])
            dirs_to_create.add(parentpath)

    # Create zipfile in alphabetical order, with each directory before its
    # files
    for name in sorted(dirs_to_create.union(set(files_to_copy))):
        if name in dirs_to_create:
            mkzipdir(zf, name+"/")
        if name in files_to_copy:
            zf.write(files_to_copy[name], name)

    zf.close()
