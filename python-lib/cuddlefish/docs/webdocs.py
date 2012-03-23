# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import os, re, errno
import markdown
import cgi

from cuddlefish import packaging
from cuddlefish.docs import apirenderer
from cuddlefish._version import get_versions

INDEX_PAGE = '/doc/static-files/base.html'
BASE_URL_INSERTION_POINT = '<base '
VERSION_INSERTION_POINT = '<div id="version">'
THIRD_PARTY_PACKAGE_SUMMARIES = '<ul id="third-party-package-summaries">'
HIGH_LEVEL_PACKAGE_SUMMARIES = '<ul id="high-level-package-summaries">'
LOW_LEVEL_PACKAGE_SUMMARIES = '<ul id="low-level-package-summaries">'
CONTENT_ID = '<div id="main-content">'
TITLE_ID = '<title>'
DEFAULT_TITLE = 'Add-on SDK Documentation'

def get_documentation(package_name, modules_json, doc_path):
    documented_modules = []
    for root, dirs, files in os.walk(doc_path):
        subdir_path = root.split(os.sep)[len(doc_path.split(os.sep)):]
        for filename in files:
            if filename.endswith(".md"):
                modname = filename[:-len(".md")]
                modpath = subdir_path + [modname]
                documented_modules.append(modpath)
    return documented_modules

def tag_wrap(text, tag, attributes={}):
    result = '\n<' + tag
    for name in attributes.keys():
        result += ' ' + name + '=' + '"' + attributes[name] + '"'
    result +='>' + text + '</'+ tag + '>\n'
    return result

def is_third_party(package_json):
    return (not is_high_level(package_json)) and \
           (not(is_low_level(package_json)))

def is_high_level(package_json):
    return 'jetpack-high-level' in package_json.get('keywords', [])

def is_low_level(package_json):
    return 'jetpack-low-level' in package_json.get('keywords', [])

def insert_after(target, insertion_point_id, text_to_insert):
    insertion_point = target.find(insertion_point_id) + len(insertion_point_id)
    return target[:insertion_point] + text_to_insert + target[insertion_point:]

class WebDocs(object):
    def __init__(self, root, base_url = None):
        self.root = root
        self.pkg_cfg = packaging.build_pkg_cfg(root)
        self.packages_json = packaging.build_pkg_index(self.pkg_cfg)
        self.base_page = self._create_base_page(root, base_url)

    def create_guide_page(self, path):
        path, ext = os.path.splitext(path)
        md_path = path + '.md'
        md_content = unicode(open(md_path, 'r').read(), 'utf8')
        guide_content = markdown.markdown(md_content)
        return self._create_page(guide_content)

    def create_module_page(self, path):
        path, ext = os.path.splitext(path)
        md_path = path + '.md'
        module_content = apirenderer.md_to_div(md_path)
        return self._create_page(module_content)

    def create_package_page(self, package_name):
        package_content = self._create_package_detail(package_name)
        return self._create_page(package_content)

    def _create_page(self, page_content):
        page = self._insert_title(self.base_page, page_content)
        page = insert_after(page, CONTENT_ID, page_content)
        return page.encode('utf8')

    def _create_module_list(self, package_json):
        package_name = package_json['name']
        libs = package_json['files'][1]['lib'][1]
        doc_path = package_json.get('doc', None)
        if not doc_path:
            return ''
        modules = get_documentation(package_name, libs, doc_path)
        modules.sort()
        module_items = ''
        relative_doc_path = doc_path[len(self.root) + 1:]
        relative_doc_path_pieces = relative_doc_path.split(os.sep)
        del relative_doc_path_pieces[-1]
        relative_doc_URL = "/".join(relative_doc_path_pieces)
        for module in modules:
            module_link = tag_wrap('/'.join(module), 'a', \
                {'href': relative_doc_URL + '/' + '/'.join(module) + '.html'})
            module_items += module_link
        return module_items

    def _create_package_summaries(self, packages_json, include):
        packages = ''
        for package_name in packages_json.keys():
            package_json = packages_json[package_name]
            if not include(package_json):
                continue
            package_path = self.pkg_cfg["packages"][package_name]["root_dir"]
            package_directory = package_path[len(self.root) + 1:]
            package_directory = "/".join(package_directory.split(os.sep))
            package_link = tag_wrap(package_name, 'a', {'href': \
                                    package_directory + "/" \
                                    + 'index.html'})
            text = tag_wrap(package_link, 'h4')
            text += self._create_module_list(package_json)
            packages += tag_wrap(text, 'li', {'class':'package-summary', \
              'style':'display: block;'})
        return packages

    def _create_base_page(self, root, base_url):
        base_page = unicode(open(root + INDEX_PAGE, 'r').read(), 'utf8')
        if base_url:
            base_tag = 'href="' + base_url + '"'
            base_page = insert_after(base_page, BASE_URL_INSERTION_POINT, base_tag)
        sdk_version = get_versions()["version"]
        base_page = insert_after(base_page, VERSION_INSERTION_POINT, "Version " + sdk_version)
        third_party_summaries = \
            self._create_package_summaries(self.packages_json, is_third_party)
        base_page = insert_after(base_page, \
            THIRD_PARTY_PACKAGE_SUMMARIES, third_party_summaries)
        high_level_summaries = \
            self._create_package_summaries(self.packages_json, is_high_level)
        base_page = insert_after(base_page, \
            HIGH_LEVEL_PACKAGE_SUMMARIES, high_level_summaries)
        low_level_summaries = \
            self._create_package_summaries(self.packages_json, is_low_level)
        base_page = insert_after(base_page, \
            LOW_LEVEL_PACKAGE_SUMMARIES, low_level_summaries)
        return base_page

    def _create_package_detail_row(self, field_value, \
                                   field_descriptor, field_name):
        meta = tag_wrap(tag_wrap(field_descriptor, 'span', \
                                 {'class':'meta-header'}), 'td')
        value = tag_wrap(tag_wrap(field_value, 'span', \
                                 {'class':field_name}), 'td')
        return tag_wrap(meta + value, 'tr')

    def _create_package_detail_table(self, package_json):
        table_contents = ''
        if package_json.get('author', None):
            table_contents += self._create_package_detail_row(\
                cgi.escape(package_json['author']), 'Author', 'author')
        if package_json.get('version', None):
            table_contents += self._create_package_detail_row(\
                package_json['version'], 'Version', 'version')
        if package_json.get('license', None):
            table_contents += self._create_package_detail_row(\
                package_json['license'], 'License', 'license')
        if package_json.get('dependencies', None):
            table_contents += self._create_package_detail_row(\
                ', '.join(package_json['dependencies']), \
                'Dependencies', 'dependencies')
        table_contents += self._create_package_detail_row(\
            self._create_module_list(package_json), 'Modules', 'modules')
        return tag_wrap(tag_wrap(table_contents, 'tbody'), 'table', \
            {'class':'meta-table'})

    def _create_package_detail(self, package_name):
        package_json = self.packages_json.get(package_name, None)
        if not package_json:
            raise IOError(errno.ENOENT, 'Package not found')
        # pieces of the package detail: 1) title, 2) table, 3) description
        package_title = tag_wrap(package_name, 'h1')
        table = self._create_package_detail_table(package_json)
        description = ''
        if package_json.get('readme', None):
            description += tag_wrap(tag_wrap(\
                markdown.markdown(\
                    package_json['readme']), 'p'), 'div', {'class':'docs'})
        return tag_wrap(package_title + table + description, 'div', \
                        {'class':'package-detail'})

    def _insert_title(self, target, content):
        match = re.search('<h1>.*</h1>', content)
        if match:
            title = match.group(0)[len('<h1>'):-len('</h1>')] + ' - ' + \
                DEFAULT_TITLE
        else:
            title = DEFAULT_TITLE
        target = insert_after(target, TITLE_ID, title)
        return target
