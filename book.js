(function () {
  'use strict';
  // Booking page for the video ad (3 Oct 2026). The ad sends people here rather than straight to
  // calendly.com because the ad set optimises on the Pixel Lead event: Calendly's own page has no
  // pixel, so a direct link would give Meta no conversion signal and drop the UTMs.
  var query = new URLSearchParams(window.location.search);

  function enablePixel() {
    if (window.fbq) return;
    var f = window.fbq = function () { f.callMethod ? f.callMethod.apply(f, arguments) : f.queue.push(arguments); };
    f.queue = []; f.loaded = true; f.version = '2.0';
    var s = document.createElement('script'); s.async = true; s.src = 'https://connect.facebook.net/en_US/fbevents.js'; document.head.appendChild(s);
    f('init', '808613045653651'); f('track', 'PageView');
  }
  enablePixel();

  // Calendly's embed reads utm_* from its own URL and stores them on the booking,
  // so pass the advert's tags through (they then appear on each Calendly event).
  var cal = document.getElementById('cal');
  var url = new URL(cal.getAttribute('data-base'));
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) {
    if (query.get(k)) url.searchParams.set(k, query.get(k));
  });
  url.searchParams.set('hide_gdpr_banner', '1');
  url.searchParams.set('primary_color', '16512a');
  cal.setAttribute('data-url', url.toString());
  var w = document.createElement('script'); w.async = true; w.src = 'https://assets.calendly.com/assets/external/widget.js'; document.body.appendChild(w);

  // Fallback (added 3 Oct 2026 during a Calendly outage that returned 504s for every booking page):
  // if the widget sends no message within 12 s, offer the callback form with the same UTMs,
  // so paid clicks are not lost. Any calendly.* message means the calendar loaded.
  var calendlyAlive = false;
  var fb = document.getElementById('fallback-link');
  fb.href = '/qualification' + (window.location.search || '');
  setTimeout(function () { if (!calendlyAlive) document.getElementById('fallback').style.display = 'block'; }, 12000);

  // The widget posts calendly.event_scheduled to this window when a booking completes.
  // That is the moment that counts as a Lead for the ad set. The invitee URI makes a stable
  // eventID so a reload cannot double-count.
  window.addEventListener('message', function (e) {
    if (e.origin !== 'https://calendly.com' || !e.data || typeof e.data.event !== 'string') return;
    if (e.data.event.indexOf('calendly.') === 0) { calendlyAlive = true; document.getElementById('fallback').style.display = 'none'; }
    if (e.data.event !== 'calendly.event_scheduled') return;
    var invitee = (e.data.payload && e.data.payload.invitee && e.data.payload.invitee.uri) || '';
    var id = 'cal_' + (invitee.split('/').pop() || Date.now());
    try { if (sessionStorage.getItem(id)) return; sessionStorage.setItem(id, '1'); } catch (_) {}
    if (window.fbq) {
      window.fbq('track', 'Lead', { content_name: 'Free EPC call booked' }, { eventID: id });
      window.fbq('track', 'Schedule', {}, { eventID: id + '_s' });
    }
    var done = document.getElementById('booked');
    done.style.display = 'block';
    done.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
})();
