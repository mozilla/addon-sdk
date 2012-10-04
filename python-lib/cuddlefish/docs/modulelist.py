import sys, os

class ModuleInfo(object):
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

    def destination_path(self):
        root_pieces = self.root.split(os.sep)
        root_pieces[-1] = "modules"
        return os.sep.join([os.sep.join(root_pieces), self.source_path_relative_from_root()])

    def name(self):
        if self.root == self.source_path:
            return self.source_filename[:-3]
        else:
            path_from_root_pieces = self.source_path_relative_from_root().split(os.sep)
            return "/".join(["/".join(path_from_root_pieces), self.source_filename[:-len(".md")]])

    def level(self):
        if self.root == self.source_path:
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

if __name__ == "__main__":
    module_list = get_module_list(sys.argv[1])
    print [module_info.name for module_info in module_list]
