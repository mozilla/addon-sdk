import os
import zipfile

import simplejson as json

def build_xpi(template_root_dir, manifest, xpi_name,
              harness_options):
    zf = zipfile.ZipFile(xpi_name, "w", zipfile.ZIP_DEFLATED)

    open('.install.rdf', 'w').write(str(manifest))
    zf.write('.install.rdf', 'install.rdf')
    os.remove('.install.rdf')

    if 'icon' in harness_options:
        zf.write(str(harness_options['icon']), 'icon.png')
        del harness_options['icon']

    if 'icon64' in harness_options:
        zf.write(str(harness_options['icon64']), 'icon64.png')
        del harness_options['icon64']

    IGNORED_FILES = [".hgignore", "install.rdf", 
                     "application.ini", xpi_name]
    IGNORED_FILE_SUFFIXES = ["~"]
    IGNORED_DIRS = [".svn", ".hg", ".git"]

    def filter_filenames(filenames):
        for filename in filenames:
            if filename in IGNORED_FILES:
                continue
            if any([filename.endswith(suffix)
                    for suffix in IGNORED_FILE_SUFFIXES]):
                continue
            yield filename

    for dirpath, dirnames, filenames in os.walk(template_root_dir):
        filenames = list(filter_filenames(filenames))
        dirnames[:] = [dirname for dirname in dirnames
                       if dirname not in IGNORED_DIRS]
        for filename in filenames:
            abspath = os.path.join(dirpath, filename)
            arcpath = abspath[len(template_root_dir)+1:]
            zf.write(abspath, arcpath)

    new_resources = {}
    for resource in harness_options['resources']:
        base_arcpath = os.path.join('resources', resource)
        new_resources[resource] = ['resources', resource]
        abs_dirname = harness_options['resources'][resource]
        # Always write the directory, even if it contains no files,
        # since the harness will try to access it.
        dirinfo = zipfile.ZipInfo(base_arcpath + "/")
        dirinfo.external_attr = 0755 << 16L
        zf.writestr(dirinfo, "")
        for dirpath, dirnames, filenames in os.walk(abs_dirname):
            goodfiles = list(filter_filenames(filenames))
            for filename in goodfiles:
                abspath = os.path.join(dirpath, filename)
                arcpath = abspath[len(abs_dirname)+1:]
                arcpath = os.path.join(base_arcpath, arcpath)
                zf.write(str(abspath), str(arcpath))
            dirnames[:] = [dirname for dirname in dirnames
                           if dirname not in IGNORED_DIRS]
    harness_options['resources'] = new_resources

    open('.options.json', 'w').write(json.dumps(harness_options, indent=1,
                                                sort_keys=True))
    zf.write('.options.json', 'harness-options.json')
    os.remove('.options.json')

    zf.close()
