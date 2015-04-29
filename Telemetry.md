## Proposal

At the moment do not measure performance in the Add-on SDK.  However,
there are
options for us to use which would allow us to measure performance
regresssions and jank (long running functions on the main thread)
in the wild.

If we do not measure thesse things then we will not discover performance
regressions (or gains), nor will we be able to discover jank in the wild
and react to it, either by contacting the add-on developer, updating the
docs with better advice, or fixing issues in the sdk modules.

## Definitions

* Telemetry: This allows us to store json blobs in a database with any json data
we want to use.  We can then write a python script to map-reduce the json blobs
anyway we want, and make graphs to display the data any way that we want.

* Talos: we make a page that runs a test, and the amount of time the test takes
is recorded each time in order to spot performance regressions.

## Use Cases

### Use Case: Timers

In many cases an add-on developer will use a timeout to "async" their code
when really they're just wrapping the code in a timeout and janking whenever
the callback function is executed.

If we measured the time each `setTimeout`, `setInterval`, and `setImmediate`
callback took to execute, and assoicated this with add-on ids, then we
could identify janky add-on code in the wild.

This would be a Telemetry measurement.

#### Use Case: Observer Service

Often an add-on will subscribe to system events, using the system/events
module, and use a halting callback (like that described for timers) which
cause jank.

For example, an add-on could have thousands of reg expressions to test against
every network request that is made.

This would be a Telemetry measurement.

### Use Case: Simple-Storage

There are three measurements I'd like to take here:

1. how much data is used

If an add-on is constantly causing the simple-storage `OverQuota` event
to be raised in the wild, then it's likely that the add-on developer
could make a change to his add-on to reduce this, and therefore they should
be notified about the issue.  This would be a Telemetry measurement.

2. how long do read/write tasks take

If a change is made to the codebase here and causes a performance regression
when reading or writing simple-storage data then we should know about it.

If reading/writing is taking a large amout of time in the wild, then that may be due
to some issue that should be resolved in the add-on or sdk, and we should be
able to detect these issues.  This would be a Telemetry measurement.

3. how often do changes happen (ie the frequency of changes)

If an add-on is too frequently saving changes to simple-storage, then
this can likely cause performance issues and the add-on developer should be
notifed so that they can address the issue.  This would be a Telemetry measurement.

### Use Case: Localization

Measuring how long translations take for simple-prefs and content pages.

This could be a Talos test and measured with telemetry.  The talos test for
caching performance regressions and telemetry recordings for finding
add-ons that are slow in the wild at localizing their content.

### Use Case: Simple Prefs

1. measure how long it takes to setup the preference defaults

The defaults values for add-on preferences have to be loaded before the add-on
is started, therefore it would be good to measure how long this is taking in the wild.

2. measure how long it takes to setup the simple-prefs page (from page open to post localization)

Since there are a number of things being done to display the inline prefs for Jetpacks,
like dynamically injecting xul for each simple-pref, and localizing this injected content,
we should measure how long these things take in the wild.

3. measure how often there are errors setting default prefs

Because of cases like [bug 837023](https://bugzilla.mozilla.org/show_bug.cgi?id=837023) we should
measure errors setting default values for prefs in the wild so that we can detect add-ons with issues
and contact the add-on author so that they can find a resolution.

## Implementation

For the telemetry measurements, we can store any json blob, so I think we should
make an api that reflects this,


## API



## Example


