import os
import zipfile
import simplejson as json
from cuddlefish.util import filter_filenames, filter_dirnames

ZIPSEP = "/" # always use "/" in zipfiles

def make_zipfile_path(localroot, localpath):
    return ZIPSEP.join(localpath[len(localroot)+1:].split(os.sep))

def mkzipdir(zf, path):
    dirinfo = zipfile.ZipInfo(path)
    dirinfo.external_attr = int("040755", 8) << 16L
    zf.writestr(dirinfo, "")

def build_xpi(template_root_dir, manifest, xpi_path,
              harness_options, limit_to=None):
    zf = zipfile.ZipFile(xpi_path, "w", zipfile.ZIP_DEFLATED)

    open('.install.rdf', 'w').write(str(manifest))
    zf.write('.install.rdf', 'install.rdf')
    os.remove('.install.rdf')

    if 'icon' in harness_options:
        zf.write(str(harness_options['icon']), 'icon.png')
        del harness_options['icon']

    if 'icon64' in harness_options:
        zf.write(str(harness_options['icon64']), 'icon64.png')
        del harness_options['icon64']

    IGNORED_FILES = [".hgignore", ".DS_Store", "install.rdf",
                     "application.ini", xpi_path]

    files_to_copy = {} # maps zipfile path to local-disk abspath
    dirs_to_create = set() # zipfile paths, no trailing slash

    for dirpath, dirnames, filenames in os.walk(template_root_dir):
        filenames = list(filter_filenames(filenames, IGNORED_FILES))
        dirnames[:] = filter_dirnames(dirnames)
        for dirname in dirnames:
            arcpath = make_zipfile_path(template_root_dir,
                                        os.path.join(dirpath, dirname))
            dirs_to_create.add(arcpath)
        for filename in filenames:
            abspath = os.path.join(dirpath, filename)
            arcpath = make_zipfile_path(template_root_dir, abspath)
            files_to_copy[arcpath] = abspath

    new_resources = {}
    for resource in harness_options['resources']:
        new_resources[resource] = ['resources', resource]
        base_arcpath = ZIPSEP.join(['resources', resource])
        # Always write the top directory, even if it contains no files, since
        # the harness will try to access it.
        dirs_to_create.add(base_arcpath)
        abs_dirname = harness_options['resources'][resource]
        # cp -r stuff from abs_dirname/ into ZIP/resources/RESOURCEBASE/
        for dirpath, dirnames, filenames in os.walk(abs_dirname):
            goodfiles = list(filter_filenames(filenames, IGNORED_FILES))
            dirnames[:] = filter_dirnames(dirnames)
            for filename in goodfiles:
                abspath = os.path.join(dirpath, filename)
                if limit_to is not None and abspath not in limit_to:
                    continue  # strip unused files
                arcpath = ZIPSEP.join(
                    ['resources',
                     resource,
                     make_zipfile_path(abs_dirname,
                                       os.path.join(dirpath, filename)),
                     ])
                files_to_copy[str(arcpath)] = str(abspath)
    harness_options['resources'] = new_resources

    # now figure out which directories we need: all retained files parents
    for arcpath in files_to_copy:
        bits = arcpath.split("/")
        for i in range(1,len(bits)):
            parentpath = ZIPSEP.join(bits[0:i])
            dirs_to_create.add(parentpath)

    # create zipfile in alphabetical order, with each directory before its
    # files
    for name in sorted(dirs_to_create.union(set(files_to_copy))):
        if name in dirs_to_create:
            mkzipdir(zf, name+"/")
        if name in files_to_copy:
            zf.write(files_to_copy[name], name)

    open('.options.json', 'w').write(json.dumps(harness_options, indent=1,
                                                sort_keys=True))
    zf.write('.options.json', 'harness-options.json')
    os.remove('.options.json')

    zf.close()
