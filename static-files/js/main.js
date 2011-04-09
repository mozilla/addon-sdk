function run(jQuery) {
  const IDLE_PING_DELAY = 5000;

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

  var serverNeedsKeepalive = true;

  function sendIdlePing() {
    jQuery.ajax({url:"/api/idle",
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
}

$(window).ready(function() {
  run(jQuery);
});
