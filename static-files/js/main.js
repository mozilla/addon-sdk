function run(jQuery) {
  var IDLE_PING_DELAY = 5000;

  function highlightCode() {
    $("code").parent("pre").addClass("brush: js");
    //remove the inner <code> tags
    $('pre>code').each(function() {
      var inner = $(this).contents();
      $(this).replaceWith(inner);
    })
    SyntaxHighlighter.highlight();
  }

  function highlightCurrentPage() {
    var base_url = $("base").attr("href");
    $(".current-page").removeClass('current-page');
    $(".current-section").removeClass('current-section');

    if (base_url == '/')
      currentPage = window.location.pathname;
    else
      currentPage = window.location.toString();

    currentPage = currentPage.slice(base_url.length);
    $('a[href="' + currentPage + '"]').parent().addClass('current-page');

    currentSideBarSection = null;
    if ( $('.current-page').hasClass('sidebar-subsection-header') ) {
      currentSideBarSection = $('.current-page').next();
    }
    else {
      currentSideBarSection =
        $('.current-page').closest('.sidebar-subsection-contents');
    }
    if ($(currentSideBarSection).length == 0)
      currentSideBarSection = $('#default-section-contents');

    $('.sidebar-subsection-contents').hide();
    $('.always-show').show();
    $(currentSideBarSection).parent().addClass('current-section');
    $(currentSideBarSection).show();
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

  var serverNeedsKeepalive = true;

  function sendIdlePing() {
    jQuery.ajax({url:"/api/idle",
               cache: false,
               error: function(req) {
                 if (req.status == 501 || req.status == 404) {
                   // The server either isn't implementing idle, or
                   // we're being served from static files; just bail
                   // and stop pinging this API endpoint.
                   serverNeedsKeepalive = false;
                 }
               }});
    scheduleNextIdlePing();
  }

  function scheduleNextIdlePing() {
    if (serverNeedsKeepalive)
      window.setTimeout(sendIdlePing, IDLE_PING_DELAY);
  }

  if (window.location.protocol != "file:")
    scheduleNextIdlePing();
  highlightCurrentPage();
  highlightCode();
  $(".syntaxhighlighter").width("auto");
  generateToC();
}

$(window).ready(function() {
  run(jQuery);
});
