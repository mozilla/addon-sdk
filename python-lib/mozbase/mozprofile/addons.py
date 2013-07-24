# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.

import os
import shutil
import tempfile
import urllib2
import zipfile
from distutils import dir_util
from manifestparser import ManifestParser
from xml.dom import minidom

# Needed for the AMO's rest API - https://developer.mozilla.org/en/addons.mozilla.org_%28AMO%29_API_Developers%27_Guide/The_generic_AMO_API
AMO_API_VERSION = "1.5"

class AddonManager(object):
    """
    Handles all operations regarding addons in a profile including: installing and cleaning addons
    """

    def __init__(self, profile):
        """
        :param profile: the path to the profile for which we install addons
        """
        self.profile = profile

        # information needed for profile reset:
        # https://github.com/mozilla/mozbase/blob/270a857328b130860d1b1b512e23899557a3c8f7/mozprofile/mozprofile/profile.py#L93
        self.installed_addons = []
        self.installed_manifests = []

        # addons that we've installed; needed for cleanup
        self._addon_dirs = []

        # backup dir for already existing addons
        self.backup_dir = None

    def install_addons(self, addons=None, manifests=None):
        """
        Installs all types of addons

        :param addons: a list of addon paths to install
        :param manifest: a list of addon manifests to install
        """
        # install addon paths
        if addons:
            if isinstance(addons, basestring):
                addons = [addons]
            self.installed_addons.extend(addons)
            for addon in addons:
                self.install_from_path(addon)
        # install addon manifests
        if manifests:
            if isinstance(manifests, basestring):
                manifests = [manifests]
            for manifest in manifests:
                self.install_from_manifest(manifest)
            self.installed_manifests.extend(manifests)

    def install_from_manifest(self, filepath):
        """
        Installs addons from a manifest
        :param filepath: path to the manifest of addons to install
        """
        manifest = ManifestParser()
        manifest.read(filepath)
        addons = manifest.get()

        for addon in addons:
            if '://' in addon['path'] or os.path.exists(addon['path']):
                self.install_from_path(addon['path'])
                continue

            # No path specified, try to grab it off AMO
            locale = addon.get('amo_locale', 'en_US')

            query = 'https://services.addons.mozilla.org/' + locale + '/firefox/api/' + AMO_API_VERSION + '/'
            if 'amo_id' in addon:
                query += 'addon/' + addon['amo_id']                 # this query grabs information on the addon base on its id
            else:
                query += 'search/' + addon['name'] + '/default/1'   # this query grabs information on the first addon returned from a search
            install_path = AddonManager.get_amo_install_path(query)
            self.install_from_path(install_path)

    @classmethod
    def get_amo_install_path(self, query):
        """
        Get the addon xpi install path for the specified AMO query.

        :param query: query-documentation_

        .. _query-documentation: https://developer.mozilla.org/en/addons.mozilla.org_%28AMO%29_API_Developers%27_Guide/The_generic_AMO_API
        """
        response = urllib2.urlopen(query)
        dom = minidom.parseString(response.read())
        for node in dom.getElementsByTagName('install')[0].childNodes:
            if node.nodeType == node.TEXT_NODE:
                return node.data

    @classmethod
    def addon_details(cls, addon_path):
        """
        Returns a dictionary of details about the addon.

        :param addon_path: path to the add-on directory or XPI

        Returns::

            {'id':      u'rainbow@colors.org', # id of the addon
             'version': u'1.4',                # version of the addon
             'name':    u'Rainbow',            # name of the addon
             'unpack':  False }                # whether to unpack the addon
        """

        # TODO: We don't use the unpack variable yet, but we should: bug 662683
        details = {
            'id': None,
            'unpack': False,
            'name': None,
            'version': None
        }

        def get_namespace_id(doc, url):
            attributes = doc.documentElement.attributes
            namespace = ""
            for i in range(attributes.length):
                if attributes.item(i).value == url:
                    if ":" in attributes.item(i).name:
                        # If the namespace is not the default one remove 'xlmns:'
                        namespace = attributes.item(i).name.split(':')[1] + ":"
                        break
            return namespace

        def get_text(element):
            """Retrieve the text value of a given node"""
            rc = []
            for node in element.childNodes:
                if node.nodeType == node.TEXT_NODE:
                    rc.append(node.data)
            return ''.join(rc).strip()

        if zipfile.is_zipfile(addon_path):
            compressed_file = zipfile.ZipFile(addon_path, 'r')
            try:
                parseable = compressed_file.read('install.rdf')
                doc = minidom.parseString(parseable)
            finally:
                compressed_file.close()
        else:
            doc = minidom.parse(os.path.join(addon_path, 'install.rdf'))

        # Get the namespaces abbreviations
        em = get_namespace_id(doc, "http://www.mozilla.org/2004/em-rdf#")
        rdf = get_namespace_id(doc, "http://www.w3.org/1999/02/22-rdf-syntax-ns#")

        description = doc.getElementsByTagName(rdf + "Description").item(0)
        for node in description.childNodes:
            # Remove the namespace prefix from the tag for comparison
            entry = node.nodeName.replace(em, "")
            if entry in details.keys():
                details.update({ entry: get_text(node) })

        # turn unpack into a true/false value
        if isinstance(details['unpack'], basestring):
            details['unpack'] = details['unpack'].lower() == 'true'

        return details

    def install_from_path(self, path, unpack=False):
        """
        Installs addon from a filepath, url or directory of addons in the profile.

        :param path: url, path to .xpi, or directory of addons
        :param unpack: whether to unpack unless specified otherwise in the install.rdf
        """

        # if the addon is a url, download it
        # note that this won't work with protocols urllib2 doesn't support
        if '://' in path:
            response = urllib2.urlopen(path)
            fd, path = tempfile.mkstemp(suffix='.xpi')
            os.write(fd, response.read())
            os.close(fd)
            tmpfile = path
        else:
            tmpfile = None

        # if the addon is a directory, install all addons in it
        addons = [path]
        if not path.endswith('.xpi') and not os.path.exists(os.path.join(path, 'install.rdf')):
            # If the path doesn't exist, then we don't really care, just return
            if not os.path.isdir(path):
                return
            addons = [os.path.join(path, x) for x in os.listdir(path) if
                    os.path.isdir(os.path.join(path, x))]

        # install each addon
        for addon in addons:
            tmpdir = None
            xpifile = None
            if addon.endswith('.xpi'):
                tmpdir = tempfile.mkdtemp(suffix = '.' + os.path.split(addon)[-1])
                compressed_file = zipfile.ZipFile(addon, 'r')
                for name in compressed_file.namelist():
                    if name.endswith('/'):
                        os.makedirs(os.path.join(tmpdir, name))
                    else:
                        if not os.path.isdir(os.path.dirname(os.path.join(tmpdir, name))):
                            os.makedirs(os.path.dirname(os.path.join(tmpdir, name)))
                        data = compressed_file.read(name)
                        f = open(os.path.join(tmpdir, name), 'wb')
                        f.write(data)
                        f.close()
                xpifile = addon
                addon = tmpdir

            # determine the addon id
            addon_details = AddonManager.addon_details(addon)
            addon_id = addon_details.get('id')
            assert addon_id, 'The addon id could not be found: %s' % addon

            # copy the addon to the profile
            extensions_path = os.path.join(self.profile, 'extensions', 'staged')
            addon_path = os.path.join(extensions_path, addon_id)
            if not unpack and not addon_details['unpack'] and xpifile:
                if not os.path.exists(extensions_path):
                    os.makedirs(extensions_path)
                # save existing xpi file to restore later
                if os.path.exists(addon_path + '.xpi'):
                    self.backup_dir = self.backup_dir or tempfile.mkdtemp()
                    shutil.copy(addon_path + '.xpi', self.backup_dir)
                shutil.copy(xpifile, addon_path + '.xpi')
            else:
                # save existing dir to restore later
                if os.path.exists(addon_path):
                    self.backup_dir = self.backup_dir or tempfile.mkdtemp()
                    dir_util.copy_tree(addon_path, self.backup_dir, preserve_symlinks=1)
                dir_util.copy_tree(addon, addon_path, preserve_symlinks=1)
                self._addon_dirs.append(addon_path)

            # remove the temporary directory, if any
            if tmpdir:
                dir_util.remove_tree(tmpdir)

        # remove temporary file, if any
        if tmpfile:
            os.remove(tmpfile)

    def clean_addons(self):
        """Cleans up addons in the profile."""
        for addon in self._addon_dirs:
            if os.path.isdir(addon):
                dir_util.remove_tree(addon)
        # restore backups
        if self.backup_dir and os.path.isdir(self.backup_dir):
            extensions_path = os.path.join(self.profile, 'extensions', 'staged')
            for backup in os.listdir(self.backup_dir):
                backup_path = os.path.join(self.backup_dir, backup)
                addon_path = os.path.join(extensions_path, backup)
                shutil.move(backup_path, addon_path)
            if not os.listdir(self.backup_dir):
                shutil.rmtree(self.backup_dir, ignore_errors=True)

    __del__ = clean_addons
