import sys
import os
import subprocess
import time
import tempfile
import atexit
import shutil
import glob
import optparse
import cStringIO as StringIO
import __main__

import simplejson as json
import mozrunner

mydir = os.path.dirname(os.path.abspath(__file__))

# Maximum time we'll wait for tests to finish, in seconds.
MAX_WAIT_TIMEOUT = 5 * 60

# When launching a temporary new Firefox profile, use these preferences.
DEFAULT_FIREFOX_PREFS = {
    'browser.startup.homepage' : 'about:blank',
    'startup.homepage_welcome_url' : 'about:blank',
    }

# When launching a temporary new Thunderbird profile, use these preferences.
# Note that these were taken from:
# http://mxr.mozilla.org/comm-central/source/mail/test/mozmill/runtest.py
DEFAULT_THUNDERBIRD_PREFS = {
    # say yes to debug output via dump
    'browser.dom.window.dump.enabled': True,
    # say no to slow script warnings
    'dom.max_chrome_script_run_time': 200,
    'dom.max_script_run_time': 0,
    # disable extension stuffs
    'extensions.update.enabled'    : False,
    'extensions.update.notifyUser' : False,
    # do not ask about being the default mail client
    'mail.shell.checkDefaultClient': False,
    # disable non-gloda indexing daemons
    'mail.winsearch.enable': False,
    'mail.winsearch.firstRunDone': True,
    'mail.spotlight.enable': False,
    'mail.spotlight.firstRunDone': True,
    # disable address books for undisclosed reasons
    'ldap_2.servers.osx.position': 0,
    'ldap_2.servers.oe.position': 0,
    # disable the first use junk dialog
    'mailnews.ui.junk.firstuse': False,
    # other unknown voodoo
    # -- dummied up local accounts to stop the account wizard
    'mail.account.account1.server' :  "server1",
    'mail.account.account2.identities' :  "id1",
    'mail.account.account2.server' :  "server2",
    'mail.accountmanager.accounts' :  "account1,account2",
    'mail.accountmanager.defaultaccount' :  "account2",
    'mail.accountmanager.localfoldersserver' :  "server1",
    'mail.identity.id1.fullName' :  "Tinderbox",
    'mail.identity.id1.smtpServer' :  "smtp1",
    'mail.identity.id1.useremail' :  "tinderbox@invalid.com",
    'mail.identity.id1.valid' :  True,
    'mail.root.none-rel' :  "[ProfD]Mail",
    'mail.root.pop3-rel' :  "[ProfD]Mail",
    'mail.server.server1.directory-rel' :  "[ProfD]Mail/Local Folders",
    'mail.server.server1.hostname' :  "Local Folders",
    'mail.server.server1.name' :  "Local Folders",
    'mail.server.server1.type' :  "none",
    'mail.server.server1.userName' :  "nobody",
    'mail.server.server2.check_new_mail' :  False,
    'mail.server.server2.directory-rel' :  "[ProfD]Mail/tinderbox",
    'mail.server.server2.download_on_biff' :  True,
    'mail.server.server2.hostname' :  "tinderbox",
    'mail.server.server2.login_at_startup' :  False,
    'mail.server.server2.name' :  "tinderbox@invalid.com",
    'mail.server.server2.type' :  "pop3",
    'mail.server.server2.userName' :  "tinderbox",
    'mail.smtp.defaultserver' :  "smtp1",
    'mail.smtpserver.smtp1.hostname' :  "tinderbox",
    'mail.smtpserver.smtp1.username' :  "tinderbox",
    'mail.smtpservers' :  "smtp1",
    'mail.startup.enabledMailCheckOnce' :  True,
    'mailnews.start_page_override.mstone' :  "ignore",
    }

def find_firefox_binary():
    dummy_profile = {}
    runner = mozrunner.FirefoxRunner(profile=dummy_profile)
    return runner.find_binary()

def install_xpts(mydir, component_dirs):
    """
    Temporarily 'installs' all XPCOM typelib files in given
    component directories into the harness components directory.

    This is needed because there doesn't seem to be any way to
    temporarily install typelibs during the runtime of a
    XULRunner app.
    """

    my_components_dir = os.path.join(mydir, 'components')
    installed_xpts = []
    for dirname in component_dirs:
        files = [os.path.basename(name)
                 for name in glob.glob(os.path.join(dirname, '*.xpt'))]
        for filename in files:
            target = os.path.join(my_components_dir, filename)
            shutil.copyfile(os.path.join(dirname, filename),
                            target)
            installed_xpts.append(target)

    @atexit.register
    def cleanup_installed_xpts():
        for path in installed_xpts:
            os.remove(path)

def get_config_in_dir(path):
    package_json = os.path.join(path, 'package.json')
    return json.loads(open(package_json, 'r').read())

def build_config(root_dir, extra_paths=None):
    local_json = os.path.join(root_dir, 'local.json')
    if os.path.exists(local_json):
        config = json.loads(open(local_json, 'r').read())
    else:
        config = {'paths': []}

    config['paths'] = [os.path.join(root_dir, path)
                       for path in config['paths']]

    if not extra_paths:
        extra_paths = []
    extra_paths.append(root_dir)
    config['paths'].extend(extra_paths)

    paths = [os.path.abspath(path)
             for path in config['paths']]
    paths = list(set(paths))

    config['paths'] = paths
    config['packages'] = {}
    for path in paths:
        pkgconfig = get_config_in_dir(path)
        pkgconfig['root_dir'] = path
        config['packages'][pkgconfig['name']] = pkgconfig
    return config

def get_deps_for_target(pkg_cfg, target):
    visited = []
    deps_left = [target]

    while deps_left:
        dep = deps_left.pop()
        if dep not in visited:
            visited.append(dep)
            dep_cfg = pkg_cfg['packages'][dep]
            deps_left.extend(dep_cfg.get('dependencies', []))

    return visited

def generate_build_for_target(pkg_cfg, target, deps, prefix=''):
    build = {'resources': {},
             'rootPaths': []}

    def add_section_to_build(cfg, section):
        if section in cfg:
            for dirname in cfg[section]:
                name = "-".join([prefix + cfg['name'], dirname])
                build['resources'][name] = os.path.join(cfg['root_dir'], dirname)
                build['rootPaths'].insert(0, 'resource://%s/' % name)

    def add_dep_to_build(dep):
        dep_cfg = pkg_cfg['packages'][dep]
        add_section_to_build(dep_cfg, "lib")
        if "loader" in dep_cfg:
            build['loader'] = "resource://%s-%s" % (prefix + dep,
                                                    dep_cfg["loader"])

    target_cfg = pkg_cfg['packages'][target]
    add_section_to_build(target_cfg, "tests")

    for dep in deps:
        add_dep_to_build(dep)

    return build

def call_plugins(pkg_cfg, deps, options):
    for dep in deps:
        dep_cfg = pkg_cfg['packages'][dep]
        dirnames = dep_cfg.get('python-lib', [])
        dirnames = [os.path.join(dep_cfg['root_dir'], dirname)
                    for dirname in dirnames]
        for dirname in dirnames:
            sys.path.append(dirname)
        module_names = dep_cfg.get('python-plugins', [])
        for module_name in module_names:
            module = __import__(module_name)
            module.init(dep_cfg['root_dir'], options)

def run(**kwargs):
    parser_options = {
        ("-x", "--times",): dict(dest="iterations",
                                 help="number of times to run tests",
                                 default=1),
        ("-c", "--components",): dict(dest="components",
                                      help=("extra XPCOM component "
                                            "dir(s), comma-separated"),
                                      default=None),
        ("-b", "--binary",): dict(dest="binary",
                                  help="path to app binary", 
                                  metavar=None,
                                  default=None),
        ("-v", "--verbose",): dict(dest="verbose",
                                   help="enable lots of output",
                                   action="store_true",
                                   default=False),
        ("-a", "--app",): dict(dest="app",
                               help=("app to run: xulrunner (default), "
                                     "firefox, or thunderbird"),
                               metavar=None,
                               default="xulrunner"),
        ("-m", "--main",): dict(dest="main",
                                help=("run a module with a main() "
                                      "export instead of tests"),
                                action="store_true",
                                default=False),
        ("-e", "--export",): dict(dest="export",
                                  help="export as extension",
                                  metavar=None,
                                  default=None),
        }

    parser = optparse.OptionParser()
    for names, opts in parser_options.items():
        parser.add_option(*names, **opts)
    (options, args) = parser.parse_args()

    pkg_cfg = build_config(os.environ['CUDDLEFISH_ROOT'], [os.getcwd()])
    target_cfg = get_config_in_dir(os.getcwd())

    target = target_cfg['name']
    deps = get_deps_for_target(pkg_cfg, target)
    build = generate_build_for_target(pkg_cfg, target, deps)

    kwargs.update(build)

    if options.export:
        options.main = True

    if not options.main and 'tests' not in target_cfg:
        print "No test suite found, using 'main' instead."
        options.main = True

    if options.main:
        if 'main' in target_cfg:
            options.main = target_cfg['main']
        else:
            print "package.json does not have a 'main' entry."
            sys.exit(1)

    if options.app == "xulrunner":
        if not options.binary:
            options.binary = find_firefox_binary()
    else:
        if options.app == "firefox":
            profile_class = mozrunner.FirefoxProfile
            preferences = DEFAULT_FIREFOX_PREFS
            runner_class = mozrunner.FirefoxRunner
        elif options.app == "thunderbird":
            profile_class = mozrunner.ThunderbirdProfile
            preferences = DEFAULT_THUNDERBIRD_PREFS
            runner_class = mozrunner.ThunderbirdRunner
        else:
            print "Unknown app: %s" % options.app
            sys.exit(1)

    if 'setup' in kwargs:
        kwargs['setup']()
        del kwargs['setup']

    options.iterations = int(options.iterations)

    if not options.components:
        options.components = []
    else:
        options.components = options.components.split(",")

    if 'components' in kwargs:
        options.components.extend(kwargs['components'])
        del kwargs['components']

    options.components = [os.path.abspath(path)
                          for path in options.components]

    if 'resources' in kwargs:
        resources = kwargs['resources']
        for name in resources:
            resources[name] = os.path.abspath(resources[name])

    resultfile = os.path.join(tempfile.gettempdir(), 'harness_result')
    if os.path.exists(resultfile):
        os.remove(resultfile)

    mydir = os.path.dirname(os.path.abspath(__file__))

    install_xpts(mydir, options.components)

    harness_options = {
        'resultFile': resultfile,
        'bootstrap': {
            'contractID': '@mozilla.org/harness/service;1',
            'classID': '{74b89fb1-f200-4ae8-a3ec-dd164117f6df}'
            }
        }

    harness_options.update(kwargs)
    for option in parser.option_list[1:]:
        harness_options[option.dest] = getattr(options, option.dest)

    if options.main:
        del harness_options['iterations']
    else:
        harness_options['runTests'] = True

    if options.export:
        del harness_options['resultFile']
        del harness_options['export']

    del harness_options['app']
    del harness_options['binary']

    options.cuddlefish_root = os.environ['CUDDLEFISH_ROOT']
    options.harness_options = harness_options

    call_plugins(pkg_cfg, deps, options)

    if options.export:
        install_rdf = os.path.abspath("install.rdf")
        if not os.path.exists(install_rdf):
            print "install.rdf not found (%s)." % install_rdf
            sys.exit(1)
        print "Exporting extension to %s." % options.export

        import zipfile
        import uuid

        bootstrap = harness_options['bootstrap']
        newguid = '{%s}' % str(uuid.uuid4())
        bootstrap['classID'] = newguid
        bootstrap['contractID'] += ";" + newguid

        zfname = options.export
        zf = zipfile.ZipFile(zfname, "w", zipfile.ZIP_DEFLATED)
        zf.write(install_rdf, "install.rdf")
        harness_component = os.path.join(mydir, 'components',
                                         'harness.js')
        zf.write(harness_component, os.path.join('components',
                                                 'harness.js'))

        IGNORED_FILES = [".hgignore", "install.rdf", zfname]
        IGNORED_DIRS = [".svn", ".hg"]
        new_resources = {}
        for resource in harness_options['resources']:
            base_arcpath = os.path.join('resources', resource)
            new_resources[resource] = ['resources', resource]
            abs_dirname = harness_options['resources'][resource]
            for dirpath, dirnames, filenames in os.walk(abs_dirname):
                goodfiles = [filename for filename in filenames
                             if filename not in IGNORED_FILES]
                for filename in goodfiles:
                    abspath = os.path.join(dirpath, filename)
                    arcpath = abspath[len(abs_dirname)+1:]
                    arcpath = os.path.join(base_arcpath, arcpath)
                    zf.write(abspath, arcpath)
                dirnames[:] = [dirname for dirname in dirnames
                               if dirname not in IGNORED_DIRS]
        harness_options['resources'] = new_resources
        open('.options.json', 'w').write(json.dumps(harness_options))
        zf.write('.options.json', 'harness-options.json')
        os.remove('.options.json')
        zf.close()
        sys.exit(0)

    env = {}
    env.update(os.environ)
    env['MOZ_NO_REMOTE'] = '1'
    env['HARNESS_OPTIONS'] = json.dumps(harness_options)

    if options.verbose:
        print "Configuration: %s" % json.dumps(harness_options)

    starttime = time.time()

    popen_kwargs = {}

    if options.app == "xulrunner":
        # TODO: We're reduplicating a lot of mozrunner logic here,
        # we should probably just get mozrunner to support this
        # use case.

        xulrunner_profile = tempfile.mkdtemp(suffix='.harness')
        cmdline = [options.binary,
                   '-app',
                   os.path.join(mydir, 'application.ini'),
                   '-profile', xulrunner_profile]

        @atexit.register
        def remove_xulrunner_profile():
            try:
                shutil.rmtree(xulrunner_profile)
            except OSError:
                pass

        if "xulrunner-bin" in options.binary:
            cmdline.remove("-app")

        if sys.platform == 'linux2' and not env.get('LD_LIBRARY_PATH'):
            env['LD_LIBRARY_PATH'] = os.path.dirname(options.binary)

        popen = subprocess.Popen(cmdline, env=env, **popen_kwargs)
    else:
        plugins = [mydir]
        profile = profile_class(plugins=plugins,
                                preferences=preferences)
        runner = runner_class(profile=profile,
                              binary=options.binary,
                              env=env,
                              kp_kwargs=popen_kwargs)
        runner.start()
        popen = runner.process_handler

    done = False
    output = None
    while not done:
        time.sleep(0.05)
        if popen.poll() is not None:
            # Sometimes the child process will spawn yet another
            # child and terminate the parent, so look for the
            # result file.
            if popen.returncode != 0:
                done = True
            elif os.path.exists(resultfile):
                output = open(resultfile).read()
                if output in ['OK', 'FAIL']:
                    done = True
        if time.time() - starttime > MAX_WAIT_TIMEOUT:
            # TODO: Kill the child process.
            raise Exception("Wait timeout exceeded (%ds)" %
                            MAX_WAIT_TIMEOUT)

    print "Total time: %f seconds" % (time.time() - starttime)

    if popen.returncode == 0 and output == 'OK':
        if options.main:
            print "Program terminated successfully."
        else:
            print "All tests succeeded."
        retval = 0
    else:
        if options.main:
            print "Program terminated unsuccessfully."
        else:
            print "Some tests failed."
        retval = -1
    sys.exit(retval)
