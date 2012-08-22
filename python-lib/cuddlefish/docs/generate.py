# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import os
import sys
import shutil
import hashlib
import tarfile
import StringIO
import HTMLParser
import urlparse

from cuddlefish import packaging
from cuddlefish.docs import apiparser
from cuddlefish.docs import apirenderer
from cuddlefish.docs import webdocs
import simplejson as json

DIGEST = "status.md5"
TGZ_FILENAME = "addon-sdk-docs.tgz"

def get_sdk_docs_path(env_root):
    return os.path.join(env_root, "doc")

def get_base_url(env_root):
    sdk_docs_path = get_sdk_docs_path(env_root).lstrip("/")
    return "file://"+"/"+"/".join(sdk_docs_path.split(os.sep))+"/"

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

def generate_static_docs(env_root):
    clean_generated_docs(get_sdk_docs_path(env_root))
    generate_docs(env_root, stdout=StringIO.StringIO())
    tgz = tarfile.open(TGZ_FILENAME, 'w:gz')
    tgz.add(get_sdk_docs_path(env_root), "doc")
    tgz.close()
    return TGZ_FILENAME

def generate_local_docs(env_root):
    return generate_docs(env_root, get_base_url(env_root))

def generate_named_file(env_root, filename):
    web_docs = webdocs.WebDocs(env_root, get_base_url(env_root))
    # next, generate api doc or guide doc
    abs_path = os.path.abspath(filename)
    if abs_path.startswith(os.path.join(env_root, 'packages')):
        doc_html, dest_dir, filename = generate_api_doc(env_root, abs_path, web_docs)
        write_file(env_root, doc_html, dest_dir, filename, False)
    elif abs_path.startswith(os.path.join(get_sdk_docs_path(env_root), 'dev-guide-source')):
        doc_html, dest_dir, filename = generate_guide_doc(env_root, abs_path, web_docs)
        write_file(env_root, doc_html, dest_dir, filename, False)
    else:
        raise ValueError("Not a valid path to a documentation file")

def generate_docs(env_root, base_url=None, stdout=sys.stdout):
    docs_dir = get_sdk_docs_path(env_root)
    # if the generated docs don't exist, generate everything
    if not os.path.exists(os.path.join(docs_dir, "dev-guide")):
        print >>stdout, "Generating documentation..."
        generate_docs_from_scratch(env_root, base_url)
        current_status = calculate_current_status(env_root)
        open(os.path.join(docs_dir, DIGEST), "w").write(current_status)
    else:
        current_status = calculate_current_status(env_root)
        previous_status_file = os.path.join(docs_dir, DIGEST)
        docs_are_up_to_date = False
        if os.path.exists(previous_status_file):
            docs_are_up_to_date = current_status == open(previous_status_file, "r").read()
        # if the docs are not up to date, generate everything
        if not docs_are_up_to_date:
            print >>stdout, "Regenerating documentation..."
            generate_docs_from_scratch(env_root, base_url)
            open(os.path.join(docs_dir, DIGEST), "w").write(current_status)
    return get_base_url(env_root) + "index.html"

# this function builds a hash of the name and last modification date of:
# * every file in "packages" which ends in ".md"
# * every file in "static-files" which does not start with "."
def calculate_current_status(env_root):
    docs_dir = get_sdk_docs_path(env_root)
    current_status = hashlib.md5()
    package_src_dir = os.path.join(env_root, "packages")
    for (dirpath, dirnames, filenames) in os.walk(package_src_dir):
        for filename in filenames:
            if filename.endswith(".md"):
                current_status.update(filename)
                current_status.update(str(os.path.getmtime(os.path.join(dirpath, filename))))
    guide_src_dir = os.path.join(docs_dir, "dev-guide-source")
    for (dirpath, dirnames, filenames) in os.walk(guide_src_dir):
        for filename in filenames:
            if filename.endswith(".md"):
                current_status.update(filename)
                current_status.update(str(os.path.getmtime(os.path.join(dirpath, filename))))
    base_html_file = os.path.join(docs_dir, "static-files", "base.html")
    current_status.update(base_html_file)
    current_status.update(str(os.path.getmtime(os.path.join(dirpath, base_html_file))))
    return current_status.digest()

def generate_docs_from_scratch(env_root, base_url):
    docs_dir = get_sdk_docs_path(env_root)
    web_docs = webdocs.WebDocs(env_root, base_url)
    must_rewrite_links = True
    if base_url:
        must_rewrite_links = False
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
        package_filename = os.path.join(dest_dir, "index.html")
        if not os.path.exists(package_filename):
            package_doc_html = web_docs.create_package_page(pkg_name)
            replace_file(env_root, package_filename, package_doc_html, must_rewrite_links)

        # generate all the API docs
        docs_src_dir = os.path.join(src_dir, "doc")
        if os.path.isdir(os.path.join(src_dir, "docs")):
            docs_src_dir = os.path.join(src_dir, "docs")
        generate_file_tree(env_root, docs_src_dir, web_docs, generate_api_doc, must_rewrite_links)

    # generate all the guide docs
    dev_guide_src = os.path.join(docs_dir, "dev-guide-source")
    generate_file_tree(env_root, dev_guide_src, web_docs, generate_guide_doc, must_rewrite_links)

    # make /md/dev-guide/welcome.html the top level index file
    doc_html, dest_dir, filename = generate_guide_doc(env_root, os.path.join(docs_dir, 'dev-guide-source', 'index.md'), web_docs)
    write_file(env_root, doc_html, docs_dir, 'index', False)

def generate_file_tree(env_root, src_dir, web_docs, generate_file, must_rewrite_links):
    for (dirpath, dirnames, filenames) in os.walk(src_dir):
        assert dirpath.startswith(src_dir) # what is this for??
        for filename in filenames:
            if filename.endswith("~"):
                continue
            src_path = os.path.join(dirpath, filename)
            if src_path.endswith(".md"):
                # write the standalone HTML files
                doc_html, dest_dir, filename = generate_file(env_root, src_path, web_docs)
                write_file(env_root, doc_html, dest_dir, filename, must_rewrite_links)

def generate_api_doc(env_root, src_dir, web_docs):
    doc_html = web_docs.create_module_page(src_dir)
    dest_dir, filename = get_api_doc_dest_path(env_root, src_dir)
    return doc_html, dest_dir, filename

def generate_guide_doc(env_root, src_dir, web_docs):
    doc_html = web_docs.create_guide_page(src_dir)
    dest_dir, filename = get_guide_doc_dest_path(env_root, src_dir)
    return doc_html, dest_dir, filename

def write_file(env_root, doc_html, dest_dir, filename, must_rewrite_links):
    if not os.path.exists(dest_dir):
        os.makedirs(dest_dir)
    dest_path_html = os.path.join(dest_dir, filename) + ".html"
    replace_file(env_root, dest_path_html, doc_html, must_rewrite_links)
    return dest_path_html

def replace_file(env_root, dest_path, file_contents, must_rewrite_links):
    if os.path.exists(dest_path):
        os.remove(dest_path)
    # before we copy the final version, we'll rewrite the links
    # I'll do this last, just because we know definitely what the dest_path is at this point
    if must_rewrite_links and dest_path.endswith(".html"):
        file_contents = rewrite_links(env_root, file_contents, dest_path)
    open(dest_path, "w").write(file_contents)

def rewrite_links(env_root, page, dest_path):
    dest_path_depth = len(dest_path.split(os.sep)) -1 # because dest_path includes filename
    docs_root_depth = len(get_sdk_docs_path(env_root).split(os.sep))
    relative_depth = dest_path_depth - docs_root_depth
    linkRewriter = LinkRewriter("../" * relative_depth)
    return linkRewriter.rewrite_links(page)

# Given the full path to an API source file, and the root,
# return a tuple of:
# 1) the full path to the corresponding HTML file, without the filename
# 2) the filename without the extension
def get_guide_doc_dest_path(env_root, src_dir):
    src_dir_relative = src_dir[len(os.path.join(get_sdk_docs_path(env_root), "dev-guide-source")) + 1:]
    return os.path.split(os.path.join(get_sdk_docs_path(env_root), "dev-guide", src_dir_relative)[:-3])

# Given the full path to a dev guide source file, and the root,
# return a tuple of:
# 1) the full path to the corresponding HTML file, without the filename
# 2) the filename without the extension
def get_api_doc_dest_path(env_root, src_dir):
    src_dir_relative = src_dir[len(env_root) + 1:]
    src_dir_relative_pieces = src_dir_relative.split(os.sep)
    del src_dir_relative_pieces[2]
    src_dir_relative = os.sep.join(src_dir_relative_pieces)
    return os.path.split(os.path.join(get_sdk_docs_path(env_root), src_dir_relative)[:-3])

class LinkRewriter(HTMLParser.HTMLParser):
    def __init__(self, link_prefix):
        HTMLParser.HTMLParser.__init__(self)
        self.stack = []
        self.link_prefix = link_prefix

    def rewrite_links(self, page):
        self.feed(page)
        self.close()
        page = ''.join(self.stack)
        self.stack = []
        return page

    def handle_decl(self, decl):
        self.stack.append("<!" + decl + ">")

    def handle_comment(self, decl):
        self.stack.append("<!--" + decl + "-->")

    def handle_starttag(self, tag, attrs):
        self.stack.append(self.__html_start_tag(tag, self._rewrite_link(attrs)))

    def handle_entityref(self, name):
        self.stack.append("&" + name + ";")

    def handle_endtag(self, tag):
        self.stack.append(self.__html_end_tag(tag))

    def handle_startendtag(self, tag, attrs):
        self.stack.append(self.__html_startend_tag(tag, self._rewrite_link(attrs)))

    def _rewrite_link(self, attrs):
        attrs = dict(attrs)
        href = attrs.get('href', '')
        if href:
            parsed = urlparse.urlparse(href)
            if not parsed.scheme:
                attrs['href'] = self.link_prefix + href
        src = attrs.get('src', '')
        if src:
            parsed = urlparse.urlparse(src)
            if not parsed.scheme:
                attrs['src'] = self.link_prefix + src
        return attrs

    def handle_data(self, data):
        self.stack.append(data)

    def __html_start_tag(self, tag, attrs):
        return '<%s%s>' % (tag, self.__html_attrs(attrs))

    def __html_startend_tag(self, tag, attrs):
        return '<%s%s/>' % (tag, self.__html_attrs(attrs))

    def __html_end_tag(self, tag):
        return '</%s>' % (tag)

    def __html_attrs(self, attrs):
        _attrs = ''
        if attrs:
            _attrs = ' %s' % (' '.join([('%s="%s"' % (k,v)) for k,v in dict(attrs).iteritems()]))
        return _attrs
