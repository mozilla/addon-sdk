#!/usr/bin/python

import zipfile, sys, os, json
from pprint import pprint

zf = zipfile.ZipFile(sys.argv[1], "r")
options = json.load(zf.open("harness-options.json", "r"))
pprint(options)
