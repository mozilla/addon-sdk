#!/usr/bin/python

import sys, os, json, zipfile

zf = zipfile.ZipFile(sys.argv[1], "r")
manifest = json.load(zf.open("harness-options.json", "r"))["manifest"]

#pprint(manifest)
# when X says require(Y), give it Z
in_manifest = set()
for X in sorted(manifest):
    modinfo = manifest[X]
    for Y in sorted(modinfo["requirements"]):
        reqdata = modinfo["requirements"][Y]
        Z = reqdata.get("uri", "ok")
        #print X, Y, Z
        in_manifest.add( (X,Y) )

searches = set()

for line in open(sys.argv[2],"r").readlines():
    line.strip()
    if not line.startswith("SEARCH"):
        continue
    bits = line.split()
    Y = bits[2].rstrip(",")
    assert bits[3] == "from"
    X = bits[4]
    searches.add( (X,Y) )

print len(searches), "unique searches were done"
print len(searches - in_manifest), "were not in the manifest"
print "searches that should have worked because they're in the manifest"
for (X,Y) in sorted(searches & in_manifest):
    print "1:", X,Y
print "searches that should have failed because they're not in the manifest"
for (X,Y) in sorted(searches - in_manifest):
    print "2:", X,Y

