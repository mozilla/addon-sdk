
IGNORED_FILE_PREFIXES = ["."]
IGNORED_FILE_SUFFIXES = ["~", ".swp"]
IGNORED_DIRS = [".git", ".svn", ".hg"]

def filter_filenames(filenames, ignored_files=[".hgignore"]):
    for filename in filenames:
        if filename in ignored_files:
            continue
        if any([filename.startswith(suffix)
                for suffix in IGNORED_FILE_PREFIXES]):
            continue
        if any([filename.endswith(suffix)
                for suffix in IGNORED_FILE_SUFFIXES]):
            continue
        yield filename

def filter_dirnames(dirnames):
    return [dirname for dirname in dirnames if dirname not in IGNORED_DIRS]
