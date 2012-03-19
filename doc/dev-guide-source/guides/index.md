<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

# Guides #

This page lists more theoretical in-depth articles about the SDK.

<hr>

<h2><a name="sdk-infrastructure">SDK Infrastructure</a></h2>

<table class="catalog">
<colgroup>
<col width="50%">
<col width="50%">
</colgroup>
  <tr>
    <td>
      <h4><a href="dev-guide/guides/commonjs.html">CommonJS, packages, and the SDK</a></h4>
      <a href="http://www.commonjs.org/">CommonJS</a> includes a specification
      for JavaScript modules: reusable pieces of JavaScript code. This guide
      provides an introduction to the CommonJS module specification and
      explains its relationship to the SDK.
    </td>

    <td>
      <h4><a href="dev-guide/guides/program-id.html">Program ID</a></h4>
      The Program ID is a unique identifier for your add-on. This guide
      explains how it's created, what it's used for and how to define your
      own.
    </td>

  </tr>
  <tr>

    <td>
      <h4><a href="dev-guide/guides/module-search.html">Module search</a></h4>
      The algorithm used to find and load modules imported using the
      <code>require()</code> statement.
    </td>

    <td>
      <h4><a href="dev-guide/guides/firefox-compatibility.html">Firefox compatibility</a></h4>
      Working out which Firefox releases a given SDK release is
      compatible with, and dealing with compatibility problems.
    </td>

  </tr>

</table>

<hr>

<h2><a name="sdk-idioms">SDK Idioms</a></h2>

<table class="catalog">
<colgroup>
<col width="50%">
<col width="50%">
</colgroup>
  <tr>
    <td>
      <h4><a href="dev-guide/guides/events.html">Working With Events</a></h4>
      Write event-driven code using the the SDK's event emitting framework.
    </td>

    <td>
      <h4><a href="dev-guide/guides/two-types-of-scripts.html">Two Types of Scripts</a></h4>
      This article explains the differences between the APIs
      available to your main add-on code and those available
      to content scripts.
    </td>

  </tr>

</table>

<hr>

<h2><a name="content-scripts">Content Scripts</a></h2>

<table class="catalog">
<colgroup>
<col width="50%">
<col width="50%">
</colgroup>
  <tr>
    <td>
      <h4><a href="dev-guide/guides/content-scripts/index.html">Introducing content scripts</a></h4>
      An overview of content scripts.
    </td>

    <td>
      <h4><a href="dev-guide/guides/content-scripts/loading.html">Loading content scripts</a></h4>
      Load content scripts into web pages, specified either as strings
      or in separate files, and how to control the point at which they are
      executed.
    </td>

  </tr>

  <tr>
    <td>
      <h4><a href="dev-guide/guides/content-scripts/access.html">Content script access</a></h4>
      Detailed information on the objects available to content scripts,
      the differences between content scripts and normal page scripts,
      and how to communicate between content scripts and page scripts.
    </td>

    <td>
      <h4><a href="dev-guide/guides/content-scripts/using-port.html">Using "port"</a></h4>
      Communicating between a content script and the rest of your add-on
      using the <code>port</code> object.
    </td>

  </tr>

  <tr>
    <td>
      <h4><a href="dev-guide/guides/content-scripts/using-postmessage.html">Using "postMessage()"</a></h4>
      Communicating between a content script and the rest of your add-on
      using the <code>postMessage()</code> API, and a comparison between
      this technique and the <code>port</code> object.
    </td>

    <td>
      <h4><a href="dev-guide/guides/content-scripts/reddit-example.html">Reddit example</a></h4>
      A simple add-on which uses content scripts.
    </td>

  </tr>

</table>

<hr>

<h2><a name="xul-migration">XUL Migration</a></h2>

<table class="catalog">
<colgroup>
<col width="50%">
<col width="50%">
</colgroup>
  <tr>
    <td>
      <h4><a href="dev-guide/guides/xul-migration.html">XUL Migration Guide</a></h4>
      Techniques to help port a XUL add-on to the SDK.
    </td>

    <td>
      <h4><a href="dev-guide/guides/sdk-vs-xul.html">XUL versus the SDK</a></h4>
      A comparison of the strengths and weaknesses of the SDK,
      compared to traditional XUL-based add-ons.
    </td>

  </tr>
  <tr>

    <td>
      <h4><a href="dev-guide/guides/library-detector.html">Porting Example</a></h4>
      A walkthrough of porting a relatively simple XUL-based
      add-on to the SDK.
    </td>

    <td>
    </td>

  </tr>

</table>
