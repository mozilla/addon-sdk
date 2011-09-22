#!/usr/bin/python

import zipfile, sys, os, json
from pprint import pprint

zf = zipfile.ZipFile(sys.argv[1], "r")
manifest = json.load(zf.open("harness-options.json", "r"))["manifest"]
pprint(manifest)
# when X says require(Y), give it Z
for X in sorted(manifest):
    modinfo = manifest[X]
    for Y in sorted(modinfo["requirements"]):
        reqdata = modinfo["requirements"][Y]
        Z = reqdata.get("uri", "ok")
        print X, Y, Z

