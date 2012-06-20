# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import tempfile
import sys, os, time
import subprocess
import simplejson as json

from cuddlefish.runner import XulrunnerAppRunner

# Execute a command in cfx.js
# @command {String} Name of the command to execute in cfx.js
# @options {Object} Set of option needed to execute the given command
# @binary {String} Absolute path to a xulrunner binary (can be
# xulrunner, firefox, thunderbird, ... executable)
# @catch_stdio {Boolean} If set to True, catch stdio and return them. Otherwise,
# cfx.js will print directly in stdios
def execute(command, options, binary=None, catch_stdio=False):
    stdout = None
    stderr = None

    # Search for cfxjs folder and its `application.ini` file
    cuddlefish_path = os.path.dirname(os.path.abspath(__file__))
    cfx_path = os.path.join(cuddlefish_path, "..", "..", "cfx")
    app_ini_path = os.path.join(cfx_path, "xulrunner-app", "application.ini")

    # Create options file that will be read by this addon
    options_file, options_file_name = tempfile.mkstemp(prefix="cfx-js-options-")
    os.write(options_file, json.dumps({
      'command': command,
      'options': options
    }))
    os.close(options_file)

    popen_args = {}
    if catch_stdio:# or sys.platform == "win32":
        # This allows to retrieve stdio when calling popen.communicate()
        # later in code
        popen_args['stdout'] = subprocess.PIPE
        popen_args['stderr'] = subprocess.PIPE

    env = {}
    # We have to inject current environnement variable
    # for linux, in order to pass `DISPLAY`
    env.update(os.environ)
    # Register an environnement variable with an absolute path to this file
    env['CFX_OPTIONS_FILE'] = options_file_name

    cfxjs_runner = XulrunnerAppRunner(
        binary=binary,
        env=env,
        kp_kwargs = popen_args,
        cmdargs=[app_ini_path])
    cfxjs_runner.start()

    # Wait for firefox quit in a thread in order to be able to interupt cfx
    # via CTRL^C (Direct call to cfxjs_runner.wait() block the main thread
    # and prevent from receiving KeyboardInterupt)
    from threading import Thread
    t = Thread(target=cfxjs_runner.wait)
    t.start()
    try:
        # Use an infinite loop instead of an infinite call to `join()`
        # In order to be able to receive KeyboardInterupt
        while t.isAlive():
            t.join(500)
    except:
        # Kill firefox in any error case
        cfxjs_runner.stop()
        raise
    finally:
        stdout, stderr = cfxjs_runner.process_handler.communicate()
        # On Windows, until bug 673383 ship in FF15,
        # stdio aren't working as expected. They are not visible on Windows.
        # Fortunately, we can retrieve them through pipes!
        if sys.platform == 'win32' and not catch_stdio:
            if stdout:
                print stdout
            if stderr:
                print stderr

        # Cleanup temporary files in any cases
        # We need to delay file removal as firefox keep some locks on profile
        time.sleep(0.5)
        os.remove(options_file_name)
        cfxjs_runner.profile.cleanup()

    return stdout, stderr
