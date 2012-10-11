# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import sys, os

class DocumentationItemInfo(object):
    def __init__(self, root, md_path, filename):
        # SDK-root + "doc" + "sdk"
        self.root = root
        # full path to MD file, without filename
        self.source_path = md_path
        # MD filename
        self.source_filename = filename

    def root(self):
        return self.root

    def source_path(self):
        return self.source_path

    def source_filename(self):
        return self.source_filename

    def base_filename(self):
        return self.source_filename[:-len(".md")]

    def source_path_and_filename(self):
        return os.sep.join([self.source_path, self.source_filename])

    def source_path_relative_from_root(self):
        return self.source_path[len(self.root) + 1:]

class DevGuideItemInfo(DocumentationItemInfo):
    def __init__(self, root, md_path, filename):
        DocumentationItemInfo.__init__(self, root, md_path, filename)

    def destination_path(self):
        root_pieces = self.root.split(os.sep)
        root_pieces[-1] = "dev-guide"
        return os.sep.join([os.sep.join(root_pieces), self.source_path_relative_from_root()])

class ModuleInfo(DocumentationItemInfo):
    def __init__(self, root, md_path, filename):
        DocumentationItemInfo.__init__(self, root, md_path, filename)

    def destination_path(self):
        root_pieces = self.root.split(os.sep)
        root_pieces[-1] = "modules"
        relative_pieces = self.source_path_relative_from_root().split(os.sep)
        return os.sep.join(root_pieces + relative_pieces)

    def relative_url(self):
        relative_pieces = self.source_path_relative_from_root().split(os.sep)
        return "/".join(relative_pieces) + "/" + self.base_filename() + ".html"

    def name(self):
        if os.sep.join([self.root, "sdk"]) == self.source_path:
            return self.source_filename[:-3]
        else:
            path_from_root_pieces = self.source_path_relative_from_root().split(os.sep)
            return "/".join(["/".join(path_from_root_pieces[1:]), self.source_filename[:-len(".md")]])

    def level(self):
        if os.sep.join([self.root, "sdk"]) == self.source_path:
            return "high"
        else:
            return "low"

def get_module_list(root):
    module_list = []
    for (dirpath, dirnames, filenames) in os.walk(root):
        for filename in filenames:
            if filename.endswith(".md"):
                module_list.append(ModuleInfo(root, dirpath, filename))
    return module_list

def get_devguide_list(root):
    devguide_list = []
    for (dirpath, dirnames, filenames) in os.walk(root):
        for filename in filenames:
            if filename.endswith(".md"):
                devguide_list.append(DevGuideItemInfo(root, dirpath, filename))
    return devguide_list

if __name__ == "__main__":
    module_list = get_module_list(sys.argv[1])
    print [module_info.name for module_info in module_list]
