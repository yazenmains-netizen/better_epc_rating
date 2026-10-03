(function () {
  'use strict';
  var endpoint = 'https://yazenmains--better-epc-lead-handler-lead-handler.modal.run';
  var query = new URLSearchParams(window.location.search);
  var attributionKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'campaign_id', 'adset_id', 'ad_id', 'adset_name', 'ad_name', 'placement'];
  var leadId = null;
  var busy = false;
  function read(key) { try { return sessionStorage.getItem(key); } catch (_) { return null; } }
  function save(key, value) { try { sessionStorage.setItem(key, value); } catch (_) {} }
  // 3 Oct 2026: the opt-in checkbox was removed on Yazen's instruction (form friction),
  // so the pixel loads for every visitor. Privacy page discloses it.
  function enablePixel() {
    if (window.fbq) return;
    var f = window.fbq = function () { f.callMethod ? f.callMethod.apply(f, arguments) : f.queue.push(arguments); };
    f.queue = []; f.loaded = true; f.version = '2.0';
    var s = document.createElement('script'); s.async = true; s.src = 'https://connect.facebook.net/en_US/fbevents.js'; document.head.appendChild(s);
    f('init', '808613045653651'); f('track', 'PageView');
  }
  enablePixel();

  // Postcode search: Vercel function api/lookup-postcode.js proxies Ideal Postcodes.
  // Address is optional, so a failed or empty lookup never blocks the enquiry.
  var postcodeInput = document.getElementById('q_postcode');
  var findButton = document.getElementById('find-address');
  var addressNote = document.getElementById('addr-error');
  var pick = document.getElementById('address-pick');
  var select = document.getElementById('q_address_select');
  var manual = document.getElementById('address-manual');
  var addressInput = document.getElementById('q_address');
  var lastLookup = '';
  var POSTCODE = /^(GIR ?0AA|[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2})$/;
  function showManual(message) {
    if (pick) pick.hidden = true;
    if (manual) manual.hidden = false;
    if (addressNote) addressNote.textContent = message || '';
  }
  function findAddress() {
    var postcode = postcodeInput.value.trim().toUpperCase();
    if (!POSTCODE.test(postcode)) { addressNote.textContent = 'Enter a full UK postcode, for example SW1A 1AA.'; return; }
    // Each lookup costs an Ideal Postcodes credit, so never repeat the same postcode.
    if (postcode.replace(/\s/g, '') === lastLookup) return;
    lastLookup = postcode.replace(/\s/g, '');
    findButton.disabled = true; findButton.textContent = 'Searching...'; addressNote.textContent = '';
    fetch('/api/lookup-postcode?postcode=' + encodeURIComponent(lastLookup))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!(data.code === 2000 && data.result && data.result.length)) return showManual('No addresses found. Type the address below, or just send your postcode.');
        select.innerHTML = '';
        select.appendChild(new Option('Select your address', ''));
        data.result.forEach(function (a) {
          select.appendChild(new Option([a.line_1, a.line_2, a.line_3].filter(Boolean).join(', ') + ', ' + a.post_town, [a.line_1, a.line_2, a.line_3, a.post_town].filter(Boolean).join(', ')));
        });
        select.appendChild(new Option('My address is not listed', 'manual'));
        manual.hidden = true; pick.hidden = false; addressInput.value = '';
        select.focus();
      })
      .catch(function () { lastLookup = ''; showManual('Address search is unavailable. Type the address below, or just send your postcode.'); })
      .then(function () { findButton.disabled = false; findButton.textContent = 'Find address'; });
  }
  if (findButton && postcodeInput) {
    findButton.addEventListener('click', findAddress);
    postcodeInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); findAddress(); } });
    // Auto-search once a complete postcode is typed, so most people never press the button.
    postcodeInput.addEventListener('input', function () {
      var typed = postcodeInput.value.trim().toUpperCase();
      if (typed.replace(/\s/g, '') !== lastLookup && manual.hidden) {
        // Postcode changed after a search: drop the picked address so it cannot be sent.
        // A hand-typed address is kept; the visitor can see and edit it.
        pick.hidden = true; addressInput.value = ''; addressNote.textContent = '';
      }
      if (POSTCODE.test(typed)) findAddress();
    });
    select.addEventListener('change', function () {
      if (select.value === 'manual') { showManual(''); addressInput.focus(); return; }
      addressInput.value = select.value;
    });
  }

  var form = document.getElementById('qualifyForm');
  if (form) {
    leadId = read('ber_pending_lead') || crypto.randomUUID();
    save('ber_pending_lead', leadId);
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (busy || !form.reportValidity()) return;
      busy = true;
      var button = form.querySelector('button[type="submit"]');
      var error = document.getElementById('form-error');
      button.disabled = true; button.textContent = 'Saving your enquiry...'; error.hidden = true;
      var payload = {lead_id: leadId, source: 'qualification', landing_page: location.origin + location.pathname, tracking_consent: 'notice only'};
      ['name','email','phone','postcode','address','website'].forEach(function (key) {
        var input = form.elements.namedItem(key); payload[key] = input ? input.value.trim() : '';
      });
      attributionKeys.forEach(function (key) { payload[key] = (query.get(key) || '').slice(0, 250); });
      try { payload.referrer = document.referrer ? new URL(document.referrer).origin : ''; } catch (_) {}
      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, 90000);
      try {
        var response = await fetch(endpoint, {method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(payload),signal:controller.signal});
        var result = await response.json();
        if (!response.ok || result.status !== 'ok' || result.lead_id !== leadId) throw new Error(typeof result.detail === 'string' ? result.detail : 'We could not confirm your enquiry was saved. Please try again.');
        // This receipt is stored only after durable server success.
        save('ber_receipt', JSON.stringify({id:result.lead_id,acknowledgement:result.acknowledgement,at:Date.now()}));
        // A retry can be the first successful response seen by this browser.
        // Deduplicate locally rather than suppressing all server-side duplicates.
        if (window.fbq && !read('ber_tracked_' + leadId)) {
          window.fbq('track','Lead',{}, {eventID:leadId});
          save('ber_tracked_' + leadId, '1');
        }
        try { sessionStorage.removeItem('ber_pending_lead'); } catch (_) {}
        window.location.assign('/thank-you');
      } catch (err) {
        error.textContent = err.name === 'AbortError' ? 'This is taking longer than expected. Please retry. We will use the same reference to avoid a duplicate enquiry.' : err.message;
        error.hidden = false; error.focus();
        button.disabled = false; button.textContent = 'Request my EPC callback';
      } finally { clearTimeout(timer); busy = false; }
    });
  }
  var confirmation = document.getElementById('receipt-message');
  if (confirmation) {
    var receipt;
    try { receipt = JSON.parse(read('ber_receipt')); } catch (_) {}
    if (receipt && receipt.id && Date.now() - receipt.at < 86400000) {
      document.getElementById('receipt-title').textContent = 'Thanks, your enquiry is saved';
      confirmation.textContent = receipt.acknowledgement === 'Sent to mail server'
        ? 'Your enquiry is saved and your confirmation email has been sent. Yazen will call to discuss your property and EPC options. Reply to the email with a convenient time to call.'
        : receipt.acknowledgement === 'Pending'
          ? 'Your enquiry is saved. Yazen will call to discuss your property and EPC options. Your confirmation message is being processed; you do not need to submit the form again.'
          : 'Your enquiry is saved. We could not confirm the acknowledgement email, but Yazen will call to discuss your property and EPC options. You do not need to submit the form again.';
    }
  }
}());
