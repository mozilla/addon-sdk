# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import json
import os
import re

exports_re1 = re.compile(
	"""exports\[(?:'"\s)+?(?P<prop>\w+)(?:'"\s)\]"""  # should be short non-greedy.  WIP
	,re.X)

exports_re2 = re.compile(
	"""exports.(?P<prop>\w+)"""
	,re.X)

exports_regexen = [exports_re1, exports_re2]

apis_regex = re.compile( # TODO @glind fragile on quotes, spacing.  Re-use from doc-gen?
	'api name="(?P<prop>\w+)">'
)

def yield_exports_for_filehandle(fh):
	c = fh.read() # sorry, WIP
	for x in exports_regexen:
		for x in x.findall(c):
			yield x

def get_exports_in_dir(dir):
	out = dict()
	for (dirpath, dirnames, filenames) in os.walk(dir):
		for fn in filenames:
			#print dirpath,fn
			if not fn.endswith('.js'): continue
			full = os.path.join(dirpath,fn)
			short = full.replace(dir,'')[:-3]
			out[short] = list(yield_exports_for_filehandle(open(full)))

	return out

"""
13:23 <wbamberg> what I would do is: use the Python documentationitem.get_module_list
13:24 <wbamberg> which gets you a list of little objects, one for each module. from those you can get the Markdown source file, and use apiparser to get the documented
                 exports
13:25 <wbamberg> and you can also get the JS file, whence you can get the actual exports, and compare them
13:25 <wbamberg> ...but there might be better approaches
"""
def yield_apis_for_filehandle(fh):
	c = fh.read() # sorry, WIP
	for x in apis_regex.findall(c):
		yield x


def get_documented_apis_in_dir(dir):
	out = dict()
	for (dirpath, dirnames, filenames) in os.walk(dir):
		for fn in filenames:
			#print dirpath,fn
			if not fn.endswith('.md'): continue
			full = os.path.join(dirpath,fn)
			short = full.replace(dir,'')[:-3]
			out[short] = list(yield_apis_for_filehandle(open(full)))

	return out

def combined_report(exportsjson,docsjson):
	E = set(exportsjson.keys())
	D = set(docsjson.keys())
	print "***** Exist as libaries only"
	for k in sorted(E-D):
		print "lib-only", k

	print ""

	print "***** Exist as docs only"
	for k in sorted(D-E):
		print "doc-only", k

	print ""

	print "***** export, api mismatch"
	for k in sorted(D & E):
		d1 = set(docsjson[k])
		e1 = set(exportsjson[k])
		for a in sorted(d1 | e1):
			if a in d1  and a in e1:
				continue
			if a in d1:
				print "nocode", k, ":", a
			else:
				print "undoc", k, ":", a

if __name__ == "__main__":
	import sys
	if not len(sys.argv) > 1:
		print sys.argv[0], "lib-dirpath" "doc-dirpath"
	libdir = sys.argv[1]
	apidir = sys.argv[2]
	#print json.dumps(get_exports_in_dir(libdir),indent=2)
	#print json.dumps(get_documented_apis_in_dir(apidir),indent=2)
	combined_report(get_exports_in_dir(libdir), get_documented_apis_in_dir(apidir))