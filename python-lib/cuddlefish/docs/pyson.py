import sys, json, re

def remove_comments(text):
    def replacer(match):
        s = match.group(0)
        if s.startswith('/'):
            return ""
        else:
            return s
    pattern = re.compile(
        r'//.*?$|/\*.*?\*/|\'(?:\\.|[^\\\'])*\'|"(?:\\.|[^\\"])*"',
        re.DOTALL | re.MULTILINE
    )
    return re.sub(pattern, replacer, text)

def read_json(path):
    js = unicode(open(path,"r").read(), 'utf8')
    js = remove_comments(js)
    js_lines = js.splitlines(True)
    metadata = ""
    reading_metadata = False
    for line in js_lines:
        if reading_metadata:
            if line.startswith("};"):
                break
            metadata += line
            continue
        if line.startswith("module.metadata"):
            reading_metadata = True
    metadata_json = json.loads("{" + metadata + "}")
    print metadata_json.get("stability", "undefined")

if __name__ == "__main__":
    read_json(sys.argv[1])
