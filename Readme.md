# Introduction

JEP stands for Jetpack Enhancement Proposal. A JEP is a proposal for an
enhancement to the Jetpack add-ons development platform. JEPs are a
mechanism for collecting ideas and influencing Jetpack development.

JEPs are not the only mechanism for influencing Jetpack development,
and they're often not the best one. Consider proposing and discussing
new APIs and enhancements to existing ones in the [Jetpack discussion group][]
without writing a JEP, since most changes can be proposed, discussed, agreed
upon, and implemented without the heavyweight formal process of a JEP.
Other options include:

- File [bug reports][Submit a bug]
- Go ahead and implement APIs that don't need to be in the core Jetpack library (or
  for which it's not clear whether or not they belong in the core), then distribute
  them to add-on developers via your own website (or, once available, via FlightDeck).

# Process


- [Submit a bug][] for a given enhancement.
- Write a file in markdown file proposing enhancements you have in mind.
- Send a [pull request][] to [JEP branch][] of the [canonical repository][].
- Request a feedback on the submitted bug pointing to a pull request.

Once pull request is merged, enhancement proposal is solid at pull request
implemneting that API will be accepted as long as it passes code quality
review.


[Jetpack discussion group]:http://groups.google.com/group/mozilla-labs-jetpack
[Submit a bug]:https://bugzilla.mozilla.org/enter_bug.cgi?product=Add-on%20SDK
[pull request]:https://github.com/Gozala/addon-sdk/compare/mozilla:JEP...JEP?expand=1
[canonical repository]:https://github.com/mozilla/addon-sdk
[JEP branch]:https://github.com/mozilla/addon-sdk/tree/JEP
