
import os, sys
import zipfile
import simplejson as json

REBUILD_SH = """\
#!/bin/sh -e
# you'll probably need to delete the stdlib packages from this directory
# (addon-kit and api-utils) to avoid a DuplicatePackageError

cd %(main)s
cfx --package-path=.. xpi
"""

def unpack(xpifile, outputdir, stdout=sys.stdout):
    os.makedirs(outputdir)
    zf = zipfile.ZipFile(xpifile, "r")
    data = json.load(zf.open("decompile_data.json"))
    # note: these are written in the order they appear in the zipfile, not
    # the order in which they appear in the output directory
    for name in sorted(data["filemap"]):
        outpath = data["filemap"][name]
        outfile = os.path.join(outputdir, *outpath)
        print >>stdout, " unpacking", outfile
        parentdir = os.path.dirname(outfile)
        if not os.path.isdir(parentdir):
            os.makedirs(parentdir)
        f = open(outfile, "wb")
        f.write(zf.read(name))
        f.close()
        # set +x if necessasry
        os.chmod(outfile, zf.getinfo(name).external_attr>>16)
    print >>stdout, "XPI unpacked!"
    print >>stdout, "main is: %s" % data["main"]

    # write instructions for rebuilding the XPI as a shell script
    f = open(os.path.join(outputdir, "rebuild.sh"), "w")
    f.write(REBUILD_SH % {"main": data["main"]})
    f.close()

    return data["main"]

if __name__ == '__main__':
    unpack(sys.argv[1], "unpacked")
