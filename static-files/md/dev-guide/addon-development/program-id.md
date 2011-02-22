# The Program ID #

The Program ID is a unique identifier for your add-on and is used for a variety
of purposes. For example: [addons.mozilla.org](http://addons.mozilla.org) uses
it to distinguish between new add-ons and updates to existing add-ons, and the
[`simple-storage`](packages/addon-kit/docs/simple-storage.html) module uses it
to figure out which stored data belongs to which add-on.

The program ID is the public part of a cryptographic key pair. When `cfx`
generates a program ID it actually generates a pair of related keys: one key
(the public key) is made public, while the other (the private key) is kept
secret.

Both keys are stored in a file called `keys` in the your home directory,
under a subdirectory `.jetpack`. The location of the home directory varies
according to the OS and your local settings, but default locations for the
`keys` file on various platforms are shown in the following table:

<table>
	<tr>
		<th>Platform</th>
		<th>Default Location</th>
	</tr>
	<tr>
		<td>Linux</td>
		<td><code>/home/&lt;username&gt;/.jetpack/keys</code></td>
	</tr>
	<tr>
		<td>OS X</td>
		<td><code>/Users/&lt;username&gt;/.jetpack/keys</code></td>
	</tr>
	<tr>
		<td>Windows Vista/7</td>
		<td><code>C:\Users\&lt;username&gt;\.jetpack\keys</code></td>
	</tr>
</table>


The public key is embedded in `package.json` as the program ID, and when the
XPI file is generated it is signed with the private key. Then the browser,
or some other tool, can use the public key to verify that the XPI file
was actually signed by the author.

The private key is very important! If you lose it, you will not be able to
upgrade your add-on: you'll have to create a new add-on ID, and your users will
have to manually uninstall the old one and install the new one. If somebody
else gets a copy of your private key, they will be able to write add-ons that
could impersonate and displace your own.

The add-on's private key needs to be included in `.jetpack/keys/` on any
computer that you use to build that add-on. When you copy the add-on source
code to a new machine, you also need to copy the private key (`cfx xpi` will
remind you of this). The best idea is to just copy the whole `.jetpack`
directory to a USB flash drive that you can carry with you. It is not stored
in your package source tree, so that you can show your code to somebody else
without also giving them the ability to create forged upgrades for your add-on.

If you start your add-on work by copying somebody else's source code, you'll
need to remove their Program ID from the `package.json` file before you can
build your own XPIs. Again, `cfx xpi` will remind you of this, and your
options, when you attempt to build an XPI from a `package.json` that
references a private key that you don't have in `.jetpack/keys/`.