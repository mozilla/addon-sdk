/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function run(jQuery) {

  function showThirdPartyModules() {
    if ($("#third-party-package-summaries").html() != "") {
      $("#third-party-packages-subsection").show();
    }
  }

  function highlightCode() {
    $("code").parent("pre").addClass("brush: js");
    //remove the inner <code> tags
    $('pre>code').each(function() {
      var inner = $(this).contents();
      $(this).replaceWith(inner);
    })
    SyntaxHighlighter.highlight();
  }

  function generateToC() {
    var headings = '.api_reference h2, .api_reference h3, ' +
                   '.api_reference h4, .api_reference h5, ' +
                   '.api_reference h6';

    if ($(headings).length == 0) {
      $("#toc").hide();
      return;
    }

    var suffix = 1;
    var headingIDs = new Array();
    var pageURL = document.location.protocol + "//" +
                  document.location.host +
                  document.location.pathname +
                  document.location.search;

    $(headings).each(function(i) {
      var baseName = $(this).html();
      // Remove the datatype portion of properties
      var dataTypeStart = baseName.indexOf(" : ");
      if (dataTypeStart != -1)
        baseName = baseName.slice(0, dataTypeStart);
      // Uniqueify the name of the heading
      var suffixedName = baseName;
      var headingIDExists = headingIDs.indexOf(suffixedName) != -1;
      while (headingIDExists) {
        suffix++;
        suffixedName = baseName + "_" + suffix;
        headingIDExists = headingIDs.indexOf(suffixedName) != -1;
      }
      headingIDs.push(suffixedName);
      var encodedName = encodeURIComponent(suffixedName);
      // Now add the ID attribute and ToC entry
      $(this).attr("id", suffixedName);
      var url = pageURL + "#" + encodedName;
      var tocEntry = $("<a></a>").attr({
        href: url,
        "class": $(this).attr("tagName"),
        title: baseName
      });
      tocEntry.text(baseName);
      $("#toc").append(tocEntry);
    });

    // Make Firefox jump to the anchor even though we created it after it
    // parsed the page.
    if (document.location.hash) {
      var hash = document.location.hash;
      document.location.replace(pageURL + "#");
      document.location.replace(pageURL + hash);
    }
  }

  showThirdPartyModules();
  highlightCode();
  $(".syntaxhighlighter").width("auto");
  generateToC();
}

$(window).ready(function() {
  run(jQuery);
});
