import sys, os

class ModuleInfo(object):
    def __init__(self, root, md_path, filename):
        self.root = root
        self.md_path = md_path
        self.filename = filename
        if self.root == self.md_path:
            self.name = filename[:-3]
        else:
            print self.md_path[len(self.root):]
            self.name = "/".join([self.md_path[len(self.root) + 1:], filename[:-3]])

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
