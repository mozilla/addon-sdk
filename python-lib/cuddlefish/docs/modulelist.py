import sys, os

class ModuleInfo(object):
    def __init__(self, root, md_path, filename):
        # SDK-root + "doc" + "sdk"
        self.root = root
        # full path to MD file, without filename
        self.source_path = md_path
        # MD filename
        self.source_filename = filename
        self.source_path_and_filename = os.sep.join([self.source_path, self.filename])
        # relative path from root, without filename
        self.source_path_relative_from_root = self.source_path[len(self.root) + 1:]

        root_pieces = root.split(os.sep)
        root_pieces[-1] = "modules"
        # full path to HTML file, without filename
        self.destination_path = os.sep.join([os.sep.join(root_pieces), self.source_path_relative_from_root])

        if self.root == md_path:
            self.name = filename[:-3]
        else:
            path_from_root_pieces = self.source_path_relative_from_root.split(os.sep)
            self.name = "/".join(["/".join(path_from_root_pieces), self.filename[:-len(".md")]])

def get_module_list(root):
    high_level = []
    low_level = []
    for (dirpath, dirnames, filenames) in os.walk(root):
        for filename in filenames:
            if filename.endswith(".md"):
                moduleinfo = ModuleInfo(root, dirpath, filename)
                if root == dirpath:
                    high_level.append(moduleinfo)
                else:
                    low_level.append(moduleinfo)
    return high_level, low_level

def get_combined_module_list(root):
    hl, ll = get_module_list(root)
    return hl + ll

if __name__ == "__main__":
    high_level_list, low_level_list = get_module_list(sys.argv[1])
    print "high level: "
    print [high_level.name for high_level in high_level_list]
    print "low level: "
    print [low_level.name for low_level in low_level_list]
