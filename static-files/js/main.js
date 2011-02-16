
const IDLE_PING_DELAY = 500;

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
  if ( $('.current-page').hasClass('sidebar-section-header') ) {
    currentSideBarSection = $('.current-page').next();
  }
  else {
    currentSideBarSection =
      $('.current-page').closest('.sidebar-section-contents');
  }
  if ($(currentSideBarSection).length == 0)
    currentSideBarSection = $('#default-section-contents');

  $('.sidebar-section-contents').hide();
  $(currentSideBarSection).parent().addClass('current-section');
  $(currentSideBarSection).show();
}

var isPingWorking = true;

function sendIdlePing() {
  jQuery.ajax({url:"/api/idle",
               // This success function won't actually get called
               // for a really long time because it's a long poll.
               success: scheduleNextIdlePing,
               error: function(req) {
                 if (req.status == 501 || req.status == 404)
                   // The server either isn't implementing idle, or
                   // we're being served from static files; just bail
                   // and stop pinging this API endpoint.
                   return;
                 scheduleNextIdlePing();
               }});
  }

function scheduleNextIdlePing() {
  window.setTimeout(sendIdlePing, IDLE_PING_DELAY);
}

$(window).ready(function() {
  if (window.location.protocol != "file:")
    scheduleNextIdlePing();
  highlightCurrentPage();
  highlightCode();
})
