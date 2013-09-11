# Proposal

There should be a easy way to develop Jetpacks within the browser.  There should not be a need for external
tools to develop Jetpack based add-ons.  All that one should need in order to build a Jetpack should be
available to them with Firefox, in this way a developer can hack Firefox with Firefox.

A fundamental step towards the goal above will be to have Firefox understand Jetpack code natively,
without the need to convert the jetpack code base to an old school extension code base.

# Use Cases

* Running tests for a Jetpack via Command Line (using Firefox binary) and via the AOM user interface.
* Test run an addon with a blank profile (or existing profile)
*

# Case for separating Jetpacks from old school extensions

* Jetpacks have permissions which old school extensions do not
* Jetpacks have a test framework which will be usable through the user interface whcih old school extensions do not have.
*
