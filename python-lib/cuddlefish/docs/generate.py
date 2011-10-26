import os
import sys
import shutil
import hashlib
import tarfile
import StringIO

from cuddlefish import packaging
from cuddlefish import Bunch
from cuddlefish.docs import apiparser
from cuddlefish.docs import apirenderer
from cuddlefish.docs import webdocs
import simplejson as json

DOCS_DIR = "doc"
DIGEST = "status.md5"
TGZ_FILENAME = "addon-sdk-docs.tgz"

def clean_generated_docs(docs_dir):
    status_file = os.path.join(docs_dir, "status.md5")
    if os.path.exists(status_file):
        os.remove(status_file)
    index_file = os.path.join(docs_dir, "index.html")
    if os.path.exists(index_file):
        os.remove(index_file)
    dev_guide_dir = os.path.join(docs_dir, "dev-guide")
    if os.path.exists(dev_guide_dir):
        shutil.rmtree(dev_guide_dir)
    api_doc_dir = os.path.join(docs_dir, "packages")
    if os.path.exists(api_doc_dir):
        shutil.rmtree(api_doc_dir)

def generate_static_docs(env_root, base_url=None):
    docs_dir = os.path.join(env_root, DOCS_DIR)
    clean_generated_docs(docs_dir)
    generate_docs(env_root, base_url=base_url, stdout=StringIO.StringIO())
    tgz = tarfile.open(TGZ_FILENAME, 'w:gz')
    tgz.add(docs_dir, DOCS_DIR)
    tgz.close()
    return TGZ_FILENAME

def generate_docs(env_root, base_url=None, filename=None, stdout=sys.stdout):
    docs_dir = os.path.join(env_root, DOCS_DIR)
    base_url = calculate_base_url(base_url, docs_dir)
    # if we were given a filename, just generate the named file
    # and return its URL
    if filename:
        return generate_named_file(env_root, base_url, filename)
    # if the generated docs don't exist, generate everything
    if not os.path.exists(os.path.join(docs_dir, "index.html")):
        print >>stdout, "Generating documentation..."
        generate_docs_from_scratch(env_root, base_url, docs_dir)
        current_status = calculate_current_status(env_root)
        open(os.path.join(env_root, DOCS_DIR, DIGEST), "w").write(current_status)
    else:
        current_status = calculate_current_status(env_root)
        previous_status_file = os.path.join(env_root, DOCS_DIR, DIGEST)
        docs_are_up_to_date = False
        if os.path.exists(previous_status_file):
            docs_are_up_to_date = current_status == open(previous_status_file, "r").read()
        # if the docs are not up to date, generate everything
        if not docs_are_up_to_date:
            print >>stdout, "Regenerating documentation..."
            generate_docs_from_scratch(env_root, base_url, docs_dir)
            open(os.path.join(env_root, DOCS_DIR, DIGEST), "w").write(current_status)
    return base_url + "index.html"

def calculate_base_url(base_url, docs_dir):
    if base_url == None:
        base_url_path = docs_dir
        # this is to ensure the path starts with "/"
        # whether or not it's on Windows
        # there might be a better way
        if not docs_dir.startswith("/"):
            base_url_path = "/" + base_url_path
        base_url_path_pieces = base_url_path.split(os.sep)
        base_url = "file://" + "/".join(base_url_path_pieces) + "/"
    return base_url

def generate_named_file(env_root, base_url, filename):
    docs_dir = os.path.join(env_root, DOCS_DIR)
    web_docs = webdocs.WebDocs(env_root, base_url)

    # next, generate api doc or guide doc
    abs_path = os.path.abspath(filename)
    if abs_path.startswith(os.path.join(env_root, 'packages')):
        return generate_api_doc(env_root, abs_path, web_docs)
    elif abs_path.startswith(os.path.join(env_root, DOCS_DIR, 'dev-guide-source')):
        return generate_guide_doc(env_root, abs_path, web_docs)
    else:
        raise ValueError("Not a valid path to a documentation file")

# this function builds a hash of the name and last modification date of:
# * every file in "packages" which ends in ".md"
# * every file in "static-files" which does not start with "."
def calculate_current_status(env_root):
    current_status = hashlib.md5()
    package_src_dir = os.path.join(env_root, "packages")
    for (dirpath, dirnames, filenames) in os.walk(package_src_dir):
        for filename in filenames:
            if filename.endswith(".md"):
                current_status.update(filename)
                current_status.update(str(os.path.getmtime(os.path.join(dirpath, filename))))
    guide_src_dir = os.path.join(env_root, DOCS_DIR, "dev-guide-source")
    for (dirpath, dirnames, filenames) in os.walk(guide_src_dir):
        for filename in filenames:
            if filename.endswith(".md"):
                current_status.update(filename)
                current_status.update(str(os.path.getmtime(os.path.join(dirpath, filename))))
    return current_status.digest()

def generate_docs_from_scratch(env_root, base_url, docs_dir):
    web_docs = webdocs.WebDocs(env_root, base_url)
    clean_generated_docs(docs_dir)

    # py2.5 doesn't have ignore=, so we delete tempfiles afterwards. If we
    # required >=py2.6, we could use ignore=shutil.ignore_patterns("*~")
    for (dirpath, dirnames, filenames) in os.walk(docs_dir):
        for n in filenames:
            if n.endswith("~"):
                os.unlink(os.path.join(dirpath, n))

    # generate api docs from all packages
    os.mkdir(os.path.join(docs_dir, "packages"))
    # create the index file and save that
    pkg_cfg = packaging.build_pkg_cfg(env_root)
    index = json.dumps(packaging.build_pkg_index(pkg_cfg))
    index_path = os.path.join(docs_dir, "packages", 'index.json')
    open(index_path, 'w').write(index)

    # for each package, generate its docs
    for pkg_name, pkg in pkg_cfg['packages'].items():
        src_dir = pkg.root_dir
        package_dirname = os.path.basename(src_dir)
        dest_dir = os.path.join(docs_dir, "packages", package_dirname)
        os.mkdir(dest_dir)

        src_readme = os.path.join(src_dir, "README.md")
        if os.path.exists(src_readme):
            shutil.copyfile(src_readme,
                            os.path.join(dest_dir, "README.md"))

        # create the package page
        package_filename = os.path.join(dest_dir, pkg_name + ".html")
        if not os.path.exists(package_filename):
            package_doc_html = web_docs.create_package_page(pkg_name)
            open(package_filename, "w").write(package_doc_html)

        # generate all the API docs
        docs_src_dir = os.path.join(src_dir, "doc")
        if os.path.isdir(os.path.join(src_dir, "docs")):
            docs_src_dir = os.path.join(src_dir, "docs")
        generate_file_tree(env_root, docs_src_dir, web_docs, generate_api_doc)

    # generate all the guide docs
    dev_guide_src = os.path.join(env_root, DOCS_DIR, "dev-guide-source")
    generate_file_tree(env_root, dev_guide_src, web_docs, generate_guide_doc)

    # make /md/dev-guide/welcome.html the top level index file
    shutil.copy(os.path.join(env_root, DOCS_DIR, 'dev-guide', 'welcome.html'), \
                 os.path.join(docs_dir, 'index.html'))

def generate_file_tree(env_root, src_dir, web_docs, generate_file):
    for (dirpath, dirnames, filenames) in os.walk(src_dir):
        assert dirpath.startswith(src_dir) # what is this for??
        for filename in filenames:
            if filename.endswith("~"):
                continue
            src_path = os.path.join(dirpath, filename)
            generate_file(env_root, src_path, web_docs)

def generate_api_doc(env_root, src_dir, web_docs):
    if src_dir.endswith(".md"):
        dest_dir, filename = get_api_doc_dest_path(env_root, src_dir)
        if not os.path.exists(dest_dir):
            os.makedirs(dest_dir)

        # parse and JSONify the API docs
        docs_md = open(src_dir, 'r').read()
        docs_parsed = list(apiparser.parse_hunks(docs_md))
        docs_json = json.dumps(docs_parsed)
        dest_path_json = os.path.join(dest_dir, filename) + ".json"
        replace_file(dest_path_json, docs_json)

        # write the HTML div files
        docs_div = apirenderer.json_to_div(docs_parsed, src_dir)
        dest_path_div = os.path.join(dest_dir, filename) + ".div"
        replace_file(dest_path_div, docs_div)

        # write the standalone HTML files
        docs_html = web_docs.create_module_page(src_dir)
        dest_path_html = os.path.join(dest_dir, filename) + ".html"
        replace_file(dest_path_html, docs_html)

        return dest_path_html

def generate_guide_doc(env_root, src_dir, web_docs):
    if src_dir.endswith(".md"):
        dest_dir, filename = get_guide_doc_dest_path(env_root, src_dir)
        if not os.path.exists(dest_dir):
            os.makedirs(dest_dir)
        # write the standalone HTML files
        docs_html = web_docs.create_guide_page(src_dir)
        dest_path_html = os.path.join(dest_dir, filename) + ".html"
        replace_file(dest_path_html, docs_html)
        return dest_path_html

def replace_file(dest_path, file_contents):
    if os.path.exists(dest_path):
        os.remove(dest_path)
    open(dest_path, "w").write(file_contents)

# Given the full path to an API source file, and the root,
# return a tuple of:
# 1) the full path to the corresponding HTML file, without the filename
# 2) the filename without the extension
def get_guide_doc_dest_path(env_root, src_dir):
    src_dir_relative = src_dir[len(os.path.join(env_root, DOCS_DIR, "dev-guide-source")) + 1:]
    return os.path.split(os.path.join(env_root, DOCS_DIR, "dev-guide", src_dir_relative)[:-3])

# Given the full path to a dev guide source file, and the root,
# return a tuple of:
# 1) the full path to the corresponding HTML file, without the filename
# 2) the filename without the extension
def get_api_doc_dest_path(env_root, src_dir):
    src_dir_relative = src_dir[len(env_root) + 1:]
    return os.path.split(os.path.join(env_root, DOCS_DIR, src_dir_relative)[:-3])