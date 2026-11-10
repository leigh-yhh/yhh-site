/**
 * Your Home Hunter - Main Interactive Engine & Dynamic Dialog Architecture
 * Features:
 * - Smart Prefetching Dialog Engine (Background idle + hover/touch prefetch)
 * - Dynamic asynchronous loading of modular dialog fragments from /dialogs/
 * - Idempotent form hydration for native wizard, booking, and consultation forms
 * - "The Rental Wrap" Blog Engine (search, filter pills, article modal reader)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Update copyright year
  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  const navbar = document.querySelector('.navbar');
  const navToggle = document.querySelector('.nav-toggle');
  const siteNav = document.getElementById('site-nav');

  const syncNavOffset = () => {
    if (!navbar) return;
    const offset = Math.ceil(navbar.getBoundingClientRect().height) + 12;
    document.documentElement.style.setProperty('--nav-offset', offset + 'px');
  };

  syncNavOffset();
  window.addEventListener('resize', syncNavOffset);
  window.addEventListener('hashchange', syncNavOffset);

  if (navToggle && navbar) {
    navToggle.addEventListener('click', () => {
      const open = navbar.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      syncNavOffset();
    });

    if (siteNav) {
      siteNav.addEventListener('click', (e) => {
        if (e.target.closest('a')) {
          navbar.classList.remove('is-open');
          navToggle.setAttribute('aria-expanded', 'false');
          navToggle.setAttribute('aria-label', 'Open menu');
        }
      });
    }
  }

  // ==========================================================================
  // Smart Prefetching Dialog Engine & Dynamic Loader
  // ==========================================================================

  const DIALOG_MAP = {
    searchDialog: 'search-wishlist.html',
    enquiryDialog: 'enquiry.html',
    fullServiceDetailsModal: 'full-service.html',
    inspectionBookingModal: 'inspection-booking.html',
    inspectionDetailsModal: 'inspection-details.html',
    consultBookingModal: 'consult-booking.html',
    consultDetailsModal: 'consult-details.html',
    inspectorNetworkModal: 'inspector-network.html',
    caseStudiesModal: 'case-studies.html',
    termsDialog: 'terms.html',
    privacyDialog: 'privacy.html',
    collectionNoticeModal: 'collection-notice.html'
  };

  const dialogCache = new Map(); // targetId -> HTMLDialogElement
  const dialogFetches = new Map(); // targetId -> Promise<HTMLDialogElement>

  /**
   * Resolve correct relative path to /dialogs/ whether called from root or subfolder
   */
  const getDialogFetchUrl = (filename) => {
    const isDialogsSubdir = window.location.pathname.includes('/dialogs/');
    return isDialogsSubdir ? filename : 'dialogs/' + filename;
  };

  /**
   * Asynchronously load and cache dialog fragment, then inject into #dialogs-container
   */
  async function loadDialog(rawTargetId) {
    if (!rawTargetId) return null;
    if (rawTargetId === 'diyDetailsModal' || rawTargetId === 'downloadDialog') return null;
    let targetId = rawTargetId;

    // 1. Check if already in the DOM
    const existing = document.getElementById(targetId);
    if (existing && existing.tagName === 'DIALOG') {
      initDialogComponents(existing);
      return existing;
    }

    // 2. Check if already fetched and cached in memory
    if (dialogCache.has(targetId)) {
      const cachedDialog = dialogCache.get(targetId);
      if (!document.body.contains(cachedDialog)) {
        const container = document.getElementById('dialogs-container') || document.body;
        container.appendChild(cachedDialog);
        initDialogComponents(cachedDialog);
      }
      return cachedDialog;
    }

    // 3. Check bundled templates (Instant local file:/// & zero-latency execution)
    if (window.YHH_DIALOG_TEMPLATES && window.YHH_DIALOG_TEMPLATES[targetId]) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(window.YHH_DIALOG_TEMPLATES[targetId], 'text/html');
      const dialog = doc.querySelector('dialog');
      if (dialog) {
        dialogCache.set(targetId, dialog);
        const container = document.getElementById('dialogs-container') || document.body;
        container.appendChild(dialog);
        initDialogComponents(dialog);
        return dialog;
      }
    }

    // 4. Return existing in-flight fetch promise if underway
    if (dialogFetches.has(targetId)) {
      return dialogFetches.get(targetId);
    }

    const filename = DIALOG_MAP[targetId];
    if (!filename) {
      console.warn(`[YHH Dialog] No modal mapping for ID: ${targetId}`);
      return null;
    }

    const fetchUrl = getDialogFetchUrl(filename);

    const fetchPromise = fetch(fetchUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} loading ${fetchUrl}`);
        return res.text();
      })
      .then((html) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const dialog = doc.querySelector('dialog');
        if (!dialog) throw new Error(`No <dialog> element found inside ${fetchUrl}`);

        dialogCache.set(targetId, dialog);
        const container = document.getElementById('dialogs-container') || document.body;
        if (!isDialogsSubdir) {
          dialog.querySelectorAll('a[href^="../"]').forEach((a) => {
            const href = a.getAttribute('href');
            if (href && href.startsWith('../')) {
              a.setAttribute('href', href.substring(3));
            }
          });
        }
        container.appendChild(dialog);
        initDialogComponents(dialog);
        dialogFetches.delete(targetId);
        return dialog;
      })
      .catch((err) => {
        console.error(`[YHH Dialog] Error loading modal ${targetId}:`, err);
        dialogFetches.delete(targetId);
        return null;
      });

    dialogFetches.set(targetId, fetchPromise);
    return fetchPromise;
  }

  // Hover & Touch Prefetching (loads dialog fragment ahead of click)
  document.addEventListener('pointerenter', (e) => {
    const trigger = e.target.closest('[data-modal-target]');
    if (trigger) {
      const targetId = trigger.getAttribute('data-modal-target');
      if (targetId) loadDialog(targetId);
    }
  }, { passive: true, capture: true });

  document.addEventListener('touchstart', (e) => {
    const trigger = e.target.closest('[data-modal-target]');
    if (trigger) {
      const targetId = trigger.getAttribute('data-modal-target');
      if (targetId) loadDialog(targetId);
    }
  }, { passive: true, capture: true });

  // Idle Background Prefetching for top service modals
  const highPriorityDialogs = [
    'fullServiceDetailsModal',
    'enquiryDialog'
  ];

  const prefetchIdleDialogs = () => {
    let index = 0;
    function prefetchNext() {
      if (index >= highPriorityDialogs.length) return;
      const target = highPriorityDialogs[index++];
      loadDialog(target);
      if ('requestIdleCallback' in window) {
        requestIdleCallback(prefetchNext, { timeout: 2000 });
      } else {
        setTimeout(prefetchNext, 350);
      }
    }

    if ('requestIdleCallback' in window) {
      requestIdleCallback(prefetchNext, { timeout: 3000 });
    } else {
      setTimeout(prefetchNext, 1200);
    }
  };

  if (document.readyState === 'complete') {
    prefetchIdleDialogs();
  } else {
    window.addEventListener('load', prefetchIdleDialogs);
  }

  // ==========================================================================
  // Unified Modal Trigger & Close System
  // ==========================================================================

  function getSitePageUrl(filename) {
    const path = window.location.pathname || '';
    return path.includes('/dialogs/') ? '../' + filename : filename;
  }

  function getWishlistPageUrl() {
    return '/request-full-service';
  }

  function getDialogPageUrl(filename) {
    const path = window.location.pathname || '';
    return path.includes('/dialogs/') ? filename : 'dialogs/' + filename;
  }

  /** Booking flows that open as their own page (new tab) instead of a modal. */
  const PAGE_BOOKING_TARGETS = {
    searchDialog: () => getWishlistPageUrl(),
    inspectionBookingModal: () => getDialogPageUrl('inspection-booking.html'),
    consultBookingModal: () => getDialogPageUrl('consult-booking.html')
  };

  document.addEventListener('click', (e) => {
    // 1. Open modal triggers (e.g. data-modal-target="searchDialog")
    const trigger = e.target.closest('[data-modal-target]');
    if (trigger) {
      e.preventDefault();
      const targetId = trigger.getAttribute('data-modal-target');

      if (targetId === 'diyDetailsModal' || targetId === 'downloadDialog') {
        window.location.assign(getSitePageUrl('diy-guide.html'));
        return;
      }

      // Search opens on its own page in this tab. Other bookings stay in a new tab.
      if (PAGE_BOOKING_TARGETS[targetId]) {
        const pageUrl = PAGE_BOOKING_TARGETS[targetId]();
        if (targetId === 'searchDialog') {
          window.location.assign(pageUrl);
        } else {
          window.open(pageUrl, '_blank', 'noopener,noreferrer');
        }
        return;
      }

      const parentDialog = trigger.closest('dialog');

      loadDialog(targetId).then((dialog) => {
        if (dialog && typeof dialog.showModal === 'function') {
          if (parentDialog && parentDialog !== dialog && parentDialog.open) {
            parentDialog.close();
          }
          if (!dialog.open) {
            dialog.showModal();
          }
          const preferredTab = trigger.getAttribute('data-tab');
          if (preferredTab) {
            const tabBtn = dialog.querySelector(`.modal-tab-btn[data-tab-target="${preferredTab}"]`);
            if (tabBtn) tabBtn.click();
          }
        }
      });
      return;
    }

    // 2. Close modal triggers (e.g. [data-modal-close] or .modal-close-btn)
    const closeBtn = e.target.closest('[data-modal-close], .modal-close-btn');
    if (closeBtn) {
      e.preventDefault();
      const dialog = closeBtn.closest('dialog');
      if (dialog && typeof dialog.close === 'function') {
        dialog.close();
      }
      return;
    }

    // 3. Click outside dialog on backdrop to close
    if (e.target.tagName === 'DIALOG' && typeof e.target.close === 'function') {
      const rect = e.target.getBoundingClientRect();
      const clickedOutside = (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      );
      if (clickedOutside) {
        e.target.close();
      }
    }
  });

  // ==========================================================================
  // Lead Form submission (On-page branded hero/contact section)
  // ==========================================================================
  const leadForm = document.getElementById('lead-form');
  const formStatus = document.getElementById('form-status');
  const moveDateInput = document.getElementById('move-date-input');
  const dateHiddenInput = document.getElementById('Date');

  if (leadForm) {
    applyClientProfilePrefill(leadForm, {
      firstName: '#Name_First',
      lastName: '#Name_Last',
      email: '#Email',
      phone: '#PhoneNumber',
      city: '#city-select'
    });

    leadForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (moveDateInput && moveDateInput.value) {
        const parts = moveDateInput.value.split('-');
        if (parts.length === 3) {
          const year = parts[0];
          const monthIndex = parseInt(parts[1], 10) - 1;
          const day = parts[2];
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          if (monthIndex >= 0 && monthIndex < 12) {
            const formattedDate = `${day}-${months[monthIndex]}-${year}`;
            if (dateHiddenInput) {
              dateHiddenInput.value = formattedDate;
            }
          }
        }
      }

      const enquiry = {
        firstName: document.getElementById('Name_First')?.value?.trim() || '',
        lastName: document.getElementById('Name_Last')?.value?.trim() || '',
        email: document.getElementById('Email')?.value?.trim() || '',
        phone: document.getElementById('PhoneNumber')?.value?.trim() || '',
        city: document.getElementById('city-select')?.value || '',
        moveDate: dateHiddenInput?.value || ''
      };

      setFormSubmitting(leadForm, true);
      try {
        await submitActivepiecesFlow('introCall', enquiry);
        saveClientProfile({
          firstName: enquiry.firstName,
          lastName: enquiry.lastName,
          email: enquiry.email,
          phone: enquiry.phone,
          city: enquiry.city
        });
        try {
          localStorage.setItem('yhh_lead_enquiry', JSON.stringify({
            ...enquiry,
            submittedAt: new Date().toISOString()
          }));
        } catch (err) { /* ignore */ }
        if (formStatus) {
          formStatus.textContent = 'Thank you! Your general enquiry has been received. Our team will contact you shortly.';
          formStatus.style.color = '#059669';
        }
        leadForm.reset();
      } catch (err) {
        console.error(err);
        if (formStatus) {
          formStatus.textContent = 'Sorry — submission failed. Please try again or email info@yourhomehunter.com.au.';
          formStatus.style.color = '#b91c1c';
        }
      } finally {
        setFormSubmitting(leadForm, false);
      }
    });
  }

  // ==========================================================================
  // Contact & Scheduling Configuration Engine (Google Calendar & WhatsApp)
  // ==========================================================================

  function getContactConfig() {
    return window.YHH_CONTACT_CONFIG || {
      googleAppointmentsIntroUrl: 'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ2_cMxdfUojr153utSiTOByBuvddRpqBLdrqxksB8MPqO4UYEFzoJAKf0pyiJb2e_fZn0DvDBsC',
      googleAppointmentsConsultUrl: 'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ2_cMxdfUojr153utSiTOByBuvddRpqBLdrqxksB8MPqO4UYEFzoJAKf0pyiJb2e_fZn0DvDBsC',
      whatsappNumber: '61400000000',
      whatsappDisplayNumber: '0400 000 000',
      whatsappMessageGeneral: "Hi Your Home Hunter, I would like to ask a question about your rental advocacy services.",
      whatsappMessageConsult: "Hi Your Home Hunter, I have booked a tenancy consultation and would like to connect.",
      phone: '1800 666 944',
      phoneRaw: '1800666944',
      email: 'info@yourhomehunter.com.au',
      submitApiUrl: ''
    };
  }

  /** Convert FormData to a plain object; repeated keys become arrays. */
  function formDataToObject(formData) {
    const obj = {};
    formData.forEach((value, key) => {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (!Array.isArray(obj[key])) obj[key] = [obj[key]];
        obj[key].push(value);
      } else {
        obj[key] = value;
      }
    });
    return obj;
  }

  /**
   * POST form data via the Cloudflare Worker submit proxy (Activepieces URLs stay server-side).
   * @param {string} flowKey - wishlist | introCall | consult | …
   * @param {object} data - form payload (appears as trigger.body.data in AP)
   * @returns {Promise<{ok: boolean, skipped?: boolean, status?: number}>}
   */
  async function submitActivepiecesFlow(flowKey, data) {
    const cfg = getContactConfig();
    const url = String(cfg.submitApiUrl || '').trim();

    if (!url) {
      console.error('[YHH] submitApiUrl not set — cannot submit:', flowKey);
      throw new Error('Submit is not configured (missing submitApiUrl).');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        flow: flowKey,
        pageUrl: window.location.href,
        data: data || {}
      }),
      mode: 'cors',
      keepalive: true
    });

    if (!response.ok) {
      throw new Error('Submit proxy returned ' + response.status);
    }

    let result = { ok: true };
    try {
      result = await response.json();
    } catch (err) { /* ignore non-JSON */ }

    // Worker returns skipped when the Activepieces webhook secret is empty —
    // never treat that as a successful CRM handoff.
    if (result && result.skipped) {
      console.error('[YHH] Submit skipped — Activepieces webhook not configured for:', flowKey);
      throw new Error('Submit is not configured for this form (webhook missing).');
    }

    if (result && result.ok === false) {
      throw new Error('Submit proxy rejected the request.');
    }

    if (window.YHHAnalytics && typeof window.YHHAnalytics.track === 'function') {
      window.YHHAnalytics.track('form_submit', {
        form_id: flowKey,
        page_path: window.location.pathname
      });
    }

    return { ok: true, status: response.status };
  }

  function setFormSubmitting(form, isSubmitting) {
    if (!form) return;
    const btn = form.querySelector('[type="submit"]');
    if (!btn) return;
    if (isSubmitting) {
      btn.dataset.prevLabel = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Submitting…';
    } else {
      btn.disabled = false;
      if (btn.dataset.prevLabel) {
        btn.textContent = btn.dataset.prevLabel;
        delete btn.dataset.prevLabel;
      }
    }
  }

  /** APP 5 / Privacy Act — required acknowledgement before any form submit. */
  function requirePrivacyConsent(formOrRoot) {
    const box = formOrRoot.querySelector('.privacy-consent-checkbox');
    if (!box) return true;
    if (!box.checked) {
      box.reportValidity();
      box.focus();
      alert('Please confirm you have read the Privacy Collection Notice and Privacy Policy before submitting.');
      return false;
    }
    return true;
  }

  function privacyConsentFields(formOrRoot) {
    const box = formOrRoot.querySelector('.privacy-consent-checkbox');
    return {
      privacyConsent: !!(box && box.checked),
      privacyConsentAt: (box && box.checked) ? new Date().toISOString() : '',
      privacyNoticeVersion: 'collection-notice-2026-09-14',
      privacyPolicyVersion: 'privacy-policy-2026-09-14'
    };
  }

  // --------------------------------------------------------------------------
  // Shared client profile — prefill later forms from earlier submissions
  // --------------------------------------------------------------------------
  const CLIENT_PROFILE_KEY = 'yhh_client_profile';

  function loadClientProfile() {
    try {
      const raw = localStorage.getItem(CLIENT_PROFILE_KEY);
      if (raw) return JSON.parse(raw) || {};
    } catch (err) { /* ignore */ }
    return {};
  }

  function saveClientProfile( partial = {}) {
    try {
      const next = { ...loadClientProfile() };
      Object.keys(partial || {}).forEach((key) => {
        const value = partial[key];
        if (value == null) return;
        if (typeof value === 'string' && !value.trim()) return;
        if (Array.isArray(value) && !value.length) return;
        next[key] = value;
      });
      next.updatedAt = new Date().toISOString();
      localStorage.setItem(CLIENT_PROFILE_KEY, JSON.stringify(next));
      return next;
    } catch (err) {
      return loadClientProfile();
    }
  }

  /** Seed profile from older per-form localStorage keys if needed. */
  function hydrateClientProfileFromLegacy() {
    const existing = loadClientProfile();
    if (existing.firstName || existing.email || existing.phone) return existing;

    const legacyKeys = [
      'yhh_service_agreement',
      'yhh_wishlist_submission',
      'yhh_discovery_request',
      'yhh_lead_enquiry',
      'yhh_consultation_booking',
      'yhh_inspection_booking',
      'yhh_inspector_application'
    ];

    const merged = {};
    legacyKeys.forEach((key) => {
      try {
        const item = JSON.parse(localStorage.getItem(key) || 'null');
        if (!item || typeof item !== 'object') return;
        if (item.firstName) merged.firstName = item.firstName;
        if (item.lastName) merged.lastName = item.lastName;
        if (item.email) merged.email = item.email;
        if (item.phone) merged.phone = item.phone;
        if (item.mobile) merged.phone = item.mobile;
        if (item.city) merged.city = item.city;
        if (item.preferredName) merged.preferredName = item.preferredName;
        if (Array.isArray(item.locations) && item.locations.length) {
          merged.searchLocations = item.locations;
          if (!merged.city) merged.city = item.locations[0];
        }
        if (item.name && typeof item.name === 'string' && !merged.firstName) {
          const parts = item.name.trim().split(/\s+/);
          merged.firstName = parts[0] || '';
          merged.lastName = parts.slice(1).join(' ') || '';
        }
      } catch (err) { /* ignore */ }
    });

    return Object.keys(merged).length ? saveClientProfile(merged) : existing;
  }

  function setFieldValue(el, value) {
    if (!el || value == null || value === '') return false;
    if (el.type === 'checkbox' || el.type === 'radio') return false;
    if (el.tagName === 'SELECT') {
      const match = Array.from(el.options).find((opt) =>
        opt.value === value || opt.value.toLowerCase() === String(value).toLowerCase()
          || opt.textContent.trim().toLowerCase().startsWith(String(value).toLowerCase())
      );
      if (match) {
        el.value = match.value;
        return true;
      }
      return false;
    }
    if (!el.value) {
      el.value = value;
      return true;
    }
    return false;
  }

  /**
   * Prefill empty fields from the shared profile.
   * mapping: { profileKey: CSS selector or Element }
   */
  function applyClientProfilePrefill(root, mapping) {
    if (!root || !mapping) return;
    const profile = hydrateClientProfileFromLegacy();
    let filled = 0;

    Object.keys(mapping).forEach((key) => {
      const value = profile[key];
      if (value == null || value === '') return;
      const target = mapping[key];
      const el = typeof target === 'string' ? root.querySelector(target) : target;
      if (el && setFieldValue(el, Array.isArray(value) ? value[0] : value)) filled += 1;
    });

    // Multi-checkbox locations (service agreement)
    if (Array.isArray(profile.searchLocations) && profile.searchLocations.length) {
      profile.searchLocations.forEach((loc) => {
        const box = root.querySelector(`input[name="searchLocations"][value="${loc}"]`);
        if (box && !box.checked) {
          box.checked = true;
          filled += 1;
        }
      });
    } else if (profile.city) {
      const box = root.querySelector(`input[name="searchLocations"][value="${profile.city}"]`);
      if (box && !box.checked) {
        box.checked = true;
        filled += 1;
      }
    }

    // Typed full name for signature fields (only if empty)
    const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
    if (fullName) {
      root.querySelectorAll('#sa_signature_name, #consult_signature, #insp_signature').forEach((el) => {
        if (setFieldValue(el, fullName)) filled += 1;
      });
    }

    if (filled > 0) {
      let banner = root.querySelector('[data-prefill-banner]');
      if (!banner) {
        const form = root.matches?.('form') ? root : root.querySelector('form');
        const host = form || root;
        const anchor = host.querySelector('.step-title-box, .modal-header, .wishlist-page-header') || host.firstElementChild;
        banner = document.createElement('p');
        banner.className = 'prefill-banner';
        banner.setAttribute('data-prefill-banner', '');
        banner.textContent = 'We filled these in from a form you already sent in this browser. Change anything that isn\u2019t right.';
        if (anchor && anchor.parentNode === host) {
          host.insertBefore(banner, anchor.nextSibling);
        } else if (host.firstChild) {
          host.insertBefore(banner, host.firstChild);
        } else {
          host.appendChild(banner);
        }
      } else {
        banner.hidden = false;
      }
    }
  }

  function buildWhatsAppUrl(customText) {
    const cfg = getContactConfig();
    const cleanNumber = (cfg.whatsappNumber || '').replace(/[^0-9]/g, '');
    const msg = encodeURIComponent(customText || cfg.whatsappMessageGeneral);
    return `https://wa.me/${cleanNumber}?text=${msg}`;
  }

  function bindContactConfigLinks(root = document) {
    const cfg = getContactConfig();

    // 1. Google Workspace Appointments links
    const gcalIntroLinks = root.querySelectorAll('.gcal-intro-link, #enquiry-gcal-btn');
    gcalIntroLinks.forEach(link => {
      if (cfg.googleAppointmentsIntroUrl) {
        link.href = cfg.googleAppointmentsIntroUrl;
      }
    });

    const gcalConsultLinks = root.querySelectorAll('.gcal-consult-link, #consult-gcal-btn');
    gcalConsultLinks.forEach(link => {
      if (cfg.googleAppointmentsConsultUrl) {
        link.href = cfg.googleAppointmentsConsultUrl;
      }
    });

    // 2. WhatsApp links
    const waGeneralLinks = root.querySelectorAll('.whatsapp-direct-link, #enquiry-wa-btn, #quick-wa-btn');
    waGeneralLinks.forEach(link => {
      link.href = buildWhatsAppUrl(cfg.whatsappMessageGeneral);
    });

    const waConsultLinks = root.querySelectorAll('.whatsapp-consult-link, #consult-wa-link');
    waConsultLinks.forEach(link => {
      link.href = buildWhatsAppUrl(cfg.whatsappMessageConsult);
    });

    // 3. Dynamic Phone Links
    const phoneLinks = root.querySelectorAll('.dynamic-phone-link');
    phoneLinks.forEach(link => {
      link.href = `tel:${cfg.phoneRaw || '1800666944'}`;
      if (link.dataset.updateText !== 'false') {
        link.textContent = cfg.phone || '1800 666 944';
      }
    });
  }

  function initModalTabs(container) {
    if (!container) return;
    const tabBtns = container.querySelectorAll('.modal-tab-btn');
    const switchBtns = container.querySelectorAll('.switch-to-tab-btn');

    tabBtns.forEach(btn => {
      if (btn.dataset.tabBound) return;
      btn.dataset.tabBound = 'true';

      btn.addEventListener('click', () => {
        const targetId = btn.dataset.tabTarget;
        if (!targetId) return;

        const parentSwitcher = btn.closest('.modal-tab-switcher') || container;
        parentSwitcher.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        container.querySelectorAll('.modal-tab-pane').forEach(pane => {
          if (pane.id === targetId) {
            pane.classList.add('active');
          } else {
            pane.classList.remove('active');
          }
        });
      });
    });

    switchBtns.forEach(sBtn => {
      if (sBtn.dataset.switchBound) return;
      sBtn.dataset.switchBound = 'true';

      sBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetTab = sBtn.dataset.switchTab;
        const matchingBtn = container.querySelector(`.modal-tab-btn[data-tab-target="${targetTab}"]`);
        if (matchingBtn) {
          matchingBtn.click();
        }
      });
    });
  }

  function initQuickConnectWidget() {
    const widget = document.querySelector('.quick-connect-widget');
    if (!widget || widget.dataset.initialized) return;
    widget.dataset.initialized = 'true';

    const trigger = widget.querySelector('.quick-connect-trigger');
    const closeBtn = widget.querySelector('.quick-connect-close');

    if (trigger) {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        widget.classList.toggle('open');
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        widget.classList.remove('open');
      });
    }

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (widget.classList.contains('open') && !widget.contains(e.target)) {
        widget.classList.remove('open');
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && widget.classList.contains('open')) {
        widget.classList.remove('open');
      }
    });

    // Close flyout when selecting any modal action
    widget.querySelectorAll('[data-modal-target]').forEach(item => {
      item.addEventListener('click', () => {
        widget.classList.remove('open');
      });
    });
  }

  // ==========================================================================
  // Address & Suburb Autocomplete Engine (Google Places + Built-in AU Suburbs)
  // ==========================================================================

  const AU_SUBURBS_DATA = [
    // Melbourne & VIC
    'Richmond, VIC 3121', 'South Yarra, VIC 3141', 'Fitzroy, VIC 3065', 'Collingwood, VIC 3066',
    'Carlton, VIC 3053', 'St Kilda, VIC 3182', 'Brunswick, VIC 3056', 'Hawthorn, VIC 3122',
    'Prahran, VIC 3181', 'South Melbourne, VIC 3205', 'Docklands, VIC 3008', 'Port Melbourne, VIC 3207',
    'Albert Park, VIC 3206', 'Toorak, VIC 3142', 'Kew, VIC 3101', 'Balwyn, VIC 3103',
    'Camberwell, VIC 3124', 'Malvern, VIC 3144', 'Glen Iris, VIC 3146', 'Armadale, VIC 3143',
    'Brighton, VIC 3186', 'Elwood, VIC 3184', 'Sandringham, VIC 3191', 'Hampton, VIC 3188',
    'Footscray, VIC 3011', 'Yarraville, VIC 3013', 'Seddon, VIC 3011', 'Williamstown, VIC 3016',
    'Northcote, VIC 3070', 'Thornbury, VIC 3071', 'Preston, VIC 3072', 'Coburg, VIC 3058',
    'Essendon, VIC 3040', 'Moonee Ponds, VIC 3039', 'Ascot Vale, VIC 3032', 'Kensington, VIC 3031',
    'North Melbourne, VIC 3051', 'East Melbourne, VIC 3002', 'Parkville, VIC 3052', 'Box Hill, VIC 3128',
    'Glen Waverley, VIC 3150', 'Mount Waverley, VIC 3149', 'Doncaster, VIC 3108', 'Ringwood, VIC 3134',
    'Geelong, VIC 3220', 'Ballarat, VIC 3350', 'Bendigo, VIC 3550', 'Mornington, VIC 3931',
    // Brisbane & QLD
    'New Farm, QLD 4005', 'Teneriffe, QLD 4005', 'Fortitude Valley, QLD 4006', 'Paddington, QLD 4064',
    'West End, QLD 4101', 'South Brisbane, QLD 4101', 'Kangaroo Point, QLD 4169', 'Hamilton, QLD 4007',
    'Ascot, QLD 4007', 'Newstead, QLD 4006', 'Bulimba, QLD 4171', 'Hawthorne, QLD 4171',
    'Milton, QLD 4064', 'Toowong, QLD 4066', 'St Lucia, QLD 4067', 'Indooroopilly, QLD 4068',
    'Ashgrove, QLD 4060', 'Red Hill, QLD 4059', 'Kelvin Grove, QLD 4059', 'Spring Hill, QLD 4004',
    'Brisbane City, QLD 4000', 'East Brisbane, QLD 4169', 'Woolloongabba, QLD 4102', 'Coorparoo, QLD 4151',
    'Camp Hill, QLD 4152', 'Norman Park, QLD 4170', 'Greenslopes, QLD 4120', 'Annerley, QLD 4103',
    'Clayfield, QLD 4011', 'Nundah, QLD 4012', 'Chermside, QLD 4032', 'Carindale, QLD 4152',
    'Broadbeach, QLD 4218', 'Burleigh Heads, QLD 4220', 'Surfers Paradise, QLD 4217', 'Southport, QLD 4215',
    'Noosa Heads, QLD 4567', 'Maroochydore, QLD 4558',
    // Canberra & ACT
    'Kingston, ACT 2604', 'Barton, ACT 2600', 'Braddon, ACT 2612', 'Turner, ACT 2612',
    'Reid, ACT 2612', 'Acton, ACT 2601', 'Dickson, ACT 2602', 'Lyneham, ACT 2602',
    'O\'Connor, ACT 2602', 'Campbell, ACT 2612', 'Ainslie, ACT 2602', 'Deakin, ACT 2600',
    'Forrest, ACT 2603', 'Griffith, ACT 2603', 'Yarralumla, ACT 2600', 'Narrabundah, ACT 2604',
    'Curtin, ACT 2605', 'Hughes, ACT 2605', 'Garran, ACT 2605', 'Belconnen, ACT 2617',
    'Bruce, ACT 2617', 'Gungahlin, ACT 2912', 'Franklin, ACT 2913', 'Harrison, ACT 2914',
    'Phillip, ACT 2606', 'Woden, ACT 2606', 'Greenway, ACT 2900', 'Denman Prospect, ACT 2611',
    // Adelaide & SA
    'North Adelaide, SA 5006', 'Adelaide, SA 5000', 'Norwood, SA 5067', 'Kent Town, SA 5067',
    'Unley, SA 5061', 'Parkside, SA 5063', 'Hyde Park, SA 5061', 'Malvern, SA 5061',
    'Dulwich, SA 5065', 'Rose Park, SA 5067', 'Burnside, SA 5066', 'Prospect, SA 5082',
    'Walkerville, SA 5081', 'Bowden, SA 5007', 'Brompton, SA 5007', 'Mile End, SA 5031',
    'Goodwood, SA 5034', 'Wayville, SA 5034', 'Glenelg, SA 5045', 'Glenelg South, SA 5045',
    'Brighton, SA 5048', 'Semaphore, SA 5019', 'Mawson Lakes, SA 5095',
    // Sydney & NSW
    'Surry Hills, NSW 2010', 'Paddington, NSW 2021', 'Darlinghurst, NSW 2010', 'Bondi, NSW 2026',
    'Bondi Beach, NSW 2026', 'Manly, NSW 2095', 'Newtown, NSW 2042', 'Redfern, NSW 2016',
    'Alexandria, NSW 2015', 'Waterloo, NSW 2017', 'Zetland, NSW 2017', 'Coogee, NSW 2034',
    'Randwick, NSW 2031', 'Balmain, NSW 2041', 'Rozelle, NSW 2039', 'Pyrmont, NSW 2009',
    'Potts Point, NSW 2011', 'Double Bay, NSW 2028', 'Woollahra, NSW 2025', 'Glebe, NSW 2037',
    'Marrickville, NSW 2204', 'North Sydney, NSW 2060', 'Crows Nest, NSW 2065', 'Mosman, NSW 2088',
    'Neutral Bay, NSW 2089', 'Chatswood, NSW 2067', 'Parramatta, NSW 2150', 'Newcastle, NSW 2300',
    'Wollongong, NSW 2500',
    // Perth & WA
    'Perth, WA 6000', 'Subiaco, WA 6008', 'Leederville, WA 6007', 'Mount Lawley, WA 6050',
    'Claremont, WA 6010', 'Cottesloe, WA 6011', 'Fremantle, WA 6160', 'South Perth, WA 6151',
    // Hobart & TAS
    'Hobart, TAS 7000', 'Battery Point, TAS 7004', 'Sandy Bay, TAS 7005', 'West Hobart, TAS 7000',
    // Darwin & NT
    'Darwin City, NT 0800', 'Fannie Bay, NT 0820', 'Parap, NT 0820', 'Nightcliff, NT 0810'
  ];

  const RELOCATION_ORIGINS_DATA = [
    // Australian Origins
    'Sydney, NSW, Australia', 'Melbourne, VIC, Australia', 'Brisbane, QLD, Australia',
    'Perth, WA, Australia', 'Adelaide, SA, Australia', 'Canberra, ACT, Australia',
    'Hobart, TAS, Australia', 'Darwin, NT, Australia', 'Gold Coast, QLD, Australia',
    'Sunshine Coast, QLD, Australia', 'Newcastle, NSW, Australia', 'Geelong, VIC, Australia',
    'Wollongong, NSW, Australia', 'Cairns, QLD, Australia', 'Townsville, QLD, Australia',
    'Ballarat, VIC, Australia', 'Bendigo, VIC, Australia',
    // International Expat Origins
    'London, United Kingdom', 'Manchester, United Kingdom', 'Edinburgh, United Kingdom',
    'Dublin, Ireland', 'Singapore', 'Hong Kong', 'Auckland, New Zealand',
    'Wellington, New Zealand', 'Christchurch, New Zealand', 'New York, NY, USA',
    'San Francisco, CA, USA', 'Los Angeles, CA, USA', 'Seattle, WA, USA',
    'Chicago, IL, USA', 'Toronto, ON, Canada', 'Vancouver, BC, Canada',
    'Dubai, United Arab Emirates', 'Abu Dhabi, United Arab Emirates',
    'Frankfurt, Germany', 'Berlin, Germany', 'Munich, Germany',
    'Paris, France', 'Amsterdam, Netherlands', 'Zurich, Switzerland',
    'Geneva, Switzerland', 'Tokyo, Japan', 'Seoul, South Korea',
    'Johannesburg, South Africa', 'Cape Town, South Africa', 'Mumbai, India',
    'Delhi, India', 'Bengaluru, India'
  ];

  let googlePlacesLoading = false;
  let googlePlacesLoaded = false;
  const pendingAutocompleteInputs = new Set();

  function ensureAddressDatalists() {
    if (!document.getElementById('yhh-au-suburbs-list')) {
      const suburbsDatalist = document.createElement('datalist');
      suburbsDatalist.id = 'yhh-au-suburbs-list';
      suburbsDatalist.innerHTML = AU_SUBURBS_DATA.map(s => `<option value="${s}"></option>`).join('');
      document.body.appendChild(suburbsDatalist);
    }

    if (!document.getElementById('yhh-relocation-origins-list')) {
      const originsDatalist = document.createElement('datalist');
      originsDatalist.id = 'yhh-relocation-origins-list';
      originsDatalist.innerHTML = RELOCATION_ORIGINS_DATA.map(o => `<option value="${o}"></option>`).join('');
      document.body.appendChild(originsDatalist);
    }
  }

  function loadGooglePlacesAPI(apiKey) {
    if (googlePlacesLoaded || googlePlacesLoading) return;
    googlePlacesLoading = true;

    window.yhhOnGooglePlacesReady = () => {
      googlePlacesLoaded = true;
      googlePlacesLoading = false;
      pendingAutocompleteInputs.forEach((input) => {
        attachGooglePlaces(input);
      });
      pendingAutocompleteInputs.clear();
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=yhhOnGooglePlacesReady`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      console.warn('Google Places API could not be loaded. Continuing with built-in Australian suburb autocomplete.');
      googlePlacesLoading = false;
    };
    document.head.appendChild(script);
  }

  function getAddressComponent(components, type, useShort) {
    if (!Array.isArray(components)) return '';
    const match = components.find((c) => Array.isArray(c.types) && c.types.includes(type));
    if (!match) return '';
    return (useShort ? match.short_name : match.long_name) || '';
  }

  function parseGoogleAddressParts(place) {
    const components = place?.address_components || [];
    const streetNumber = getAddressComponent(components, 'street_number');
    const route = getAddressComponent(components, 'route');
    const street = [streetNumber, route].filter(Boolean).join(' ').trim();
    const suburb = getAddressComponent(components, 'locality')
      || getAddressComponent(components, 'sublocality')
      || getAddressComponent(components, 'postal_town')
      || getAddressComponent(components, 'administrative_area_level_2');
    const postcode = getAddressComponent(components, 'postal_code');
    const state = getAddressComponent(components, 'administrative_area_level_1', true);
    return {
      street: street || place?.name || '',
      suburb,
      postcode,
      state,
      formatted: place?.formatted_address || ''
    };
  }

  function fillAddressGroup(input, parts) {
    const group = input.closest('[data-address-group]');
    if (!group || !parts) {
      if (parts?.formatted) input.value = parts.formatted;
      else if (parts?.street) input.value = parts.street;
      return;
    }

    const streetEl = group.querySelector('[data-address-part="street"]');
    const suburbEl = group.querySelector('[data-address-part="suburb"]');
    const postcodeEl = group.querySelector('[data-address-part="postcode"]');

    if (streetEl && parts.street) streetEl.value = parts.street;
    else if (parts.formatted) input.value = parts.formatted;

    if (suburbEl && parts.suburb) suburbEl.value = parts.suburb;
    if (postcodeEl && parts.postcode) postcodeEl.value = parts.postcode;

    [streetEl, suburbEl, postcodeEl, input].filter(Boolean).forEach((el) => {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  function attachGooglePlaces(input) {
    if (!input || input.dataset.pacAttached === 'true' || typeof google === 'undefined' || !google.maps || !google.maps.places) {
      return;
    }
    input.dataset.pacAttached = 'true';
    input.dataset.addressSuggestReady = 'true';

    const isSuburbOnly = input.getAttribute('list') === 'yhh-au-suburbs-list';
    const isRelocation = input.getAttribute('list') === 'yhh-relocation-origins-list';
    const options = {
      fields: ['formatted_address', 'name', 'address_components']
    };

    if (isRelocation) {
      options.types = ['(cities)'];
    } else if (isSuburbOnly) {
      options.componentRestrictions = { country: 'au' };
      options.types = ['(regions)'];
    } else {
      options.componentRestrictions = { country: 'au' };
      options.types = ['address'];
    }

    try {
      const autocomplete = new google.maps.places.Autocomplete(input, options);
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place) return;

        if (isSuburbOnly || isRelocation) {
          input.value = place.formatted_address || place.name || input.value;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return;
        }

        const parts = parseGoogleAddressParts(place);
        if (input.closest('[data-address-group]')) {
          fillAddressGroup(input, parts);
        } else if (parts.formatted) {
          input.value = parts.formatted;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const pacContainer = document.querySelector('.pac-container');
          if (pacContainer && pacContainer.offsetParent !== null) {
            e.preventDefault();
          }
        }
      });
    } catch (err) {
      console.warn('Could not initialize Google Places Autocomplete on element:', err);
      input.dataset.pacAttached = '';
      input.dataset.addressSuggestReady = '';
    }
  }

  function ensureAddressSuggestList(input) {
    let list = input.parentElement?.querySelector('.yhh-address-suggest');
    if (list) return list;
    list = document.createElement('ul');
    list.className = 'yhh-address-suggest';
    list.hidden = true;
    list.setAttribute('role', 'listbox');
    const wrap = input.parentElement || input;
    if (getComputedStyle(wrap).position === 'static') {
      wrap.style.position = 'relative';
    }
    wrap.appendChild(list);
    return list;
  }

  function hideAddressSuggest(input) {
    const list = input.parentElement?.querySelector('.yhh-address-suggest');
    if (list) {
      list.hidden = true;
      list.innerHTML = '';
    }
  }

  function parsePhotonParts(feature) {
    const props = feature?.properties || {};
    const street = [props.housenumber, props.street].filter(Boolean).join(' ').trim()
      || props.name
      || '';
    return {
      street,
      suburb: props.city || props.district || props.locality || props.town || props.village || '',
      postcode: props.postcode || '',
      state: props.state || '',
      formatted: props.name
        ? `${[street, props.city || props.district, props.state, props.postcode, props.country].filter(Boolean).join(', ')}`
        : [street, props.city || props.district, props.state, props.postcode].filter(Boolean).join(', ')
    };
  }

  function attachPhotonFallback(input) {
    if (!input || input.dataset.addressSuggestReady === 'true') return;
    // Suburb-only fields already use the built-in AU datalist
    if (input.getAttribute('list') === 'yhh-au-suburbs-list') return;
    if (input.getAttribute('list') === 'yhh-relocation-origins-list') return;

    input.dataset.addressSuggestReady = 'true';
    const list = ensureAddressSuggestList(input);
    let timer = null;
    let activeIndex = -1;

    const render = (features) => {
      list.innerHTML = '';
      activeIndex = -1;
      if (!features.length) {
        list.hidden = true;
        return;
      }
      features.forEach((feature, index) => {
        const parts = parsePhotonParts(feature);
        const label = parts.formatted || parts.street;
        if (!label) return;
        const item = document.createElement('li');
        item.className = 'yhh-address-suggest-item';
        item.setAttribute('role', 'option');
        item.textContent = label;
        item.addEventListener('mousedown', (e) => {
          e.preventDefault();
          if (input.closest('[data-address-group]')) {
            fillAddressGroup(input, parts);
          } else {
            input.value = parts.formatted || parts.street;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
          hideAddressSuggest(input);
        });
        item.dataset.index = String(index);
        list.appendChild(item);
      });
      list.hidden = list.children.length === 0;
    };

    const search = async (query) => {
      if (query.trim().length < 3) {
        hideAddressSuggest(input);
        return;
      }
      try {
        const url = 'https://photon.komoot.io/api/?q='
          + encodeURIComponent(query)
          + '&limit=8&lang=en&lat=-37.8136&lon=144.9631';
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const features = (data.features || []).filter((f) => {
          const country = (f.properties?.country || '').toLowerCase();
          const countrycode = (f.properties?.countrycode || '').toLowerCase();
          return !country || country.includes('australia') || countrycode === 'au';
        });
        render(features.slice(0, 6));
      } catch (err) {
        hideAddressSuggest(input);
      }
    };

    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => search(input.value), 280);
    });

    input.addEventListener('keydown', (e) => {
      const items = Array.from(list.querySelectorAll('.yhh-address-suggest-item'));
      if (!items.length || list.hidden) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % items.length;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + items.length) % items.length;
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        items[activeIndex].dispatchEvent(new Event('mousedown'));
        return;
      } else if (e.key === 'Escape') {
        hideAddressSuggest(input);
        return;
      } else {
        return;
      }
      items.forEach((item, i) => item.classList.toggle('is-active', i === activeIndex));
    });

    input.addEventListener('blur', () => {
      setTimeout(() => hideAddressSuggest(input), 150);
    });
  }

  function collectAddressInputs(scope) {
    const set = new Set();
    scope.querySelectorAll(
      'input[list="yhh-au-suburbs-list"], input[list="yhh-relocation-origins-list"], input[data-address-autocomplete="true"], input[data-address-part="street"], input[autocomplete="street-address"], input[autocomplete="address-level2"]'
    ).forEach((el) => set.add(el));
    return Array.from(set);
  }

  function initAddressAutocomplete(container) {
    const scope = container || document;
    ensureAddressDatalists();

    const apiKey = window.YHH_CONTACT_CONFIG?.googlePlacesApiKey?.trim();
    const addressInputs = collectAddressInputs(scope);

    if (apiKey) {
      if (!googlePlacesLoaded && !googlePlacesLoading) {
        loadGooglePlacesAPI(apiKey);
      }
      addressInputs.forEach((input) => {
        if (googlePlacesLoaded) {
          attachGooglePlaces(input);
        } else {
          pendingAutocompleteInputs.add(input);
        }
      });
    } else {
      // No Google key: suburb datalists still help, and street fields use Photon suggestions
      addressInputs.forEach((input) => {
        if (input.dataset.addressAutocomplete === 'true' || input.dataset.addressPart === 'street' || input.autocomplete === 'street-address') {
          attachPhotonFallback(input);
        }
      });
    }
  }

  // ==========================================================================
  // Idempotent Form Component Initializers
  // ==========================================================================

  function initDialogComponents(container) {
    if (!container) return;

    // Tabs & Contact Config Link bindings
    initModalTabs(container);
    bindContactConfigLinks(container);
    initAddressAutocomplete(container);

    // 1. Wish List Wizard (searchDialog)
    const wishlistForm = container.querySelector('#wishlist-form');
    if (wishlistForm && !wishlistForm.dataset.initialized) {
      wishlistForm.dataset.initialized = 'true';
      initWishlistWizard(container);
    }

    // 2. Discovery Call Form (enquiryDialog)
    const introCallForm = container.querySelector('#intro-call-form');
    if (introCallForm && !introCallForm.dataset.initialized) {
      introCallForm.dataset.initialized = 'true';
      initIntroCallForm(container);
    }

    // 3. Tenancy Consultation Booking Form (consultBookingModal)
    const consultForm = container.querySelector('#consult-booking-form');
    if (consultForm && !consultForm.dataset.initialized) {
      consultForm.dataset.initialized = 'true';
      initConsultForm(container);
    }

    // 4. Inspector Network Form (inspectorNetworkModal)
    const inspectorForm = container.querySelector('#inspector-application-form');
    if (inspectorForm && !inspectorForm.dataset.initialized) {
      inspectorForm.dataset.initialized = 'true';
      initInspectorForm(container);
    }

    // 5. Property Review & Inspection Booking Form (inspectionBookingModal)
    const inspBookingForm = container.querySelector('#inspection-booking-form');
    if (inspBookingForm && !inspBookingForm.dataset.initialized) {
      inspBookingForm.dataset.initialized = 'true';
      initInspectionBookingForm(container);
    }
  }

  /** Chip / tag input: type a value, press Enter, keep adding (array). */
  function initTagInputs(root) {
    root.querySelectorAll('[data-tag-input]').forEach((wrap) => {
      if (wrap.dataset.tagReady) return;
      wrap.dataset.tagReady = 'true';

      const field = wrap.querySelector('[data-tag-field]');
      const chipsEl = wrap.querySelector('[data-tag-chips]');
      const hiddenEl = wrap.querySelector('[data-tag-hidden]');
      const fieldName = wrap.getAttribute('data-tag-name') || 'mustHave';
      if (!field || !chipsEl || !hiddenEl) return;

      const values = [];

      const syncHidden = () => {
        hiddenEl.innerHTML = '';
        values.forEach((value) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = fieldName;
          input.value = value;
          hiddenEl.appendChild(input);
        });
      };

      const render = () => {
        chipsEl.innerHTML = '';
        values.forEach((value, index) => {
          const chip = document.createElement('span');
          chip.className = 'tag-chip';
          chip.innerHTML = `<span class="tag-chip-text"></span><button type="button" class="tag-chip-remove" aria-label="Remove ${value}">&times;</button>`;
          chip.querySelector('.tag-chip-text').textContent = value;
          chip.querySelector('.tag-chip-remove').addEventListener('click', () => {
            values.splice(index, 1);
            render();
          });
          chipsEl.appendChild(chip);
        });
        syncHidden();
      };

      const addValue = (raw) => {
        const value = String(raw || '').trim();
        if (!value) return;
        if (values.some((v) => v.toLowerCase() === value.toLowerCase())) {
          field.value = '';
          return;
        }
        values.push(value);
        field.value = '';
        render();
      };

      field.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          addValue(field.value.replace(/,$/, ''));
        } else if (e.key === 'Backspace' && !field.value && values.length) {
          values.pop();
          render();
        }
      });

      field.addEventListener('blur', () => {
        if (field.value.trim()) addValue(field.value);
      });

      wrap.addEventListener('click', (e) => {
        if (e.target === wrap || e.target === chipsEl) field.focus();
      });
    });
  }

  // --------------------------------------------------------------------------
  // Component: Wishlist Wizard
  // --------------------------------------------------------------------------
  function initWishlistWizard(dialog) {
    const wishlistForm = dialog.querySelector('#wishlist-form');
    const wizardSteps = dialog.querySelectorAll('.wizard-step');
    const stepIndicators = dialog.querySelectorAll('.step-indicator');
    const successView = dialog.querySelector('#wishlist-success-view');
    const stepperBar = dialog.querySelector('.wishlist-stepper');
    const directLinkRow = dialog.querySelector('#wishlist-direct-link-row');

    initTagInputs(dialog);
    applyClientProfilePrefill(dialog, {
      firstName: '#wl_first_name',
      lastName: '#wl_last_name',
      preferredName: '#wl_pref_name',
      phone: '#wl_phone',
      email: '#wl_email',
      city: '#wl_city',
      relocationFrom: '#wl_address'
    });

    const goToStep = (stepNumber) => {
      wizardSteps.forEach((step) => {
        const sNum = parseInt(step.getAttribute('data-wizard-step'), 10);
        step.classList.toggle('active', sNum === stepNumber);
      });

      stepIndicators.forEach((ind) => {
        const iNum = parseInt(ind.getAttribute('data-step-indicator'), 10);
        ind.classList.toggle('active', iNum === stepNumber);
        ind.classList.toggle('completed', iNum < stepNumber);
      });

      dialog.scrollTop = 0;
      if (document.body.classList.contains('wishlist-page')) {
        const sticky = document.querySelector('.wishlist-stepper-sticky');
        const top = sticky ? Math.max(0, sticky.getBoundingClientRect().top + window.scrollY - 72) : 0;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    };

    // Next Step Buttons
    dialog.querySelectorAll('[data-next-step]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const currentStepEl = btn.closest('.wizard-step');
        if (!currentStepEl) return;

        const requiredInputs = currentStepEl.querySelectorAll('input[required], select[required], textarea[required]');
        let isValid = true;
        for (const input of requiredInputs) {
          if (!input.checkValidity()) {
            input.reportValidity();
            isValid = false;
            break;
          }
        }

        if (isValid) {
          const nextStepNum = parseInt(btn.getAttribute('data-next-step'), 10);
          goToStep(nextStepNum);
        }
      });
    });

    // Previous Step Buttons
    dialog.querySelectorAll('[data-prev-step]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const prevStepNum = parseInt(btn.getAttribute('data-prev-step'), 10);
        goToStep(prevStepNum);
      });
    });

    const formatZohoDate = (isoDateStr) => {
      if (!isoDateStr) return '';
      const parts = isoDateStr.split('-');
      if (parts.length !== 3) return isoDateStr;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIdx = parseInt(parts[1], 10) - 1;
      if (monthIdx >= 0 && monthIdx < 12) {
        return `${parts[2]}-${months[monthIdx]}-${parts[0]}`;
      }
      return isoDateStr;
    };

    if (wishlistForm) {
      wishlistForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const moveDateEl = dialog.querySelector('#wl_move_date');
        const dateHiddenEl = dialog.querySelector('#wl_Date');
        if (moveDateEl && dateHiddenEl) {
          dateHiddenEl.value = formatZohoDate(moveDateEl.value);
        }

        const formData = new FormData(wishlistForm);
        const raw = formDataToObject(formData);
        if (!requirePrivacyConsent(wishlistForm)) return;

        const payload = {
          firstName: raw.Name_First || '',
          lastName: raw.Name_Last || '',
          preferredName: raw.SingleLine || '',
          phone: raw.PhoneNumber || '',
          email: raw.Email || '',
          contactMethods: [].concat(raw.Checkbox || []),
          relocationFrom: raw.Address || '',
          city: raw.Dropdown || '',
          suburb1: raw.SingleLine1 || '',
          suburb2: raw.SingleLine2 || '',
          suburb3: raw.SingleLine3 || '',
          locationPriorities: [].concat(raw.MultipleChoice || []),
          propertyType: raw.Dropdown3 || '',
          furnished: raw.Dropdown1 || '',
          bedrooms: raw.Number1 || '',
          bathrooms: raw.Number || '',
          parking: raw.SingleLine4 || '',
          parkingSpec: raw.SingleLine6 || '',
          pets: raw.SingleLine7 || '',
          mustHave: [].concat(raw.mustHave || []).filter(Boolean),
          budgetWeekly: raw.Number2 || '',
          moveDate: raw.Date || '',
          source: raw.Dropdown2 || '',
          referrer: raw.SingleLine8 || '',
          notes: raw.MultiLine1 || '',
          raw: raw,
          ...privacyConsentFields(wishlistForm)
        };

        setFormSubmitting(wishlistForm, true);
        try {
          await submitActivepiecesFlow('wishlist', payload);
          saveClientProfile({
            firstName: payload.firstName,
            lastName: payload.lastName,
            preferredName: payload.preferredName,
            phone: payload.phone,
            email: payload.email,
            city: payload.city,
            relocationFrom: payload.relocationFrom,
            budgetWeekly: payload.budgetWeekly,
            searchLocations: payload.city ? [payload.city] : []
          });
          try {
            localStorage.setItem('yhh_wishlist_submission', JSON.stringify({
              name: `${payload.firstName} ${payload.lastName}`.trim(),
              email: payload.email,
              city: payload.city,
              budget: payload.budgetWeekly,
              submittedAt: new Date().toISOString()
            }));
          } catch (err) { /* ignore */ }

          wishlistForm.style.display = 'none';
          if (stepperBar) stepperBar.style.display = 'none';
          if (directLinkRow) directLinkRow.style.display = 'none';
          if (successView) successView.style.display = 'block';
          if (document.body.classList.contains('wishlist-page')) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        } catch (err) {
          console.error(err);
          alert('Sorry — we could not submit your wishlist. Please try again or email info@yourhomehunter.com.au.');
        } finally {
          setFormSubmitting(wishlistForm, false);
        }
      });
    }

    dialog.addEventListener('close', () => {
      if (successView && successView.style.display === 'block') {
        successView.style.display = 'none';
        if (wishlistForm) {
          wishlistForm.reset();
          wishlistForm.style.display = 'block';
        }
        if (stepperBar) stepperBar.style.display = 'flex';
        if (directLinkRow) directLinkRow.style.display = 'flex';
        goToStep(1);
      }
    });
  }

  // --------------------------------------------------------------------------
  // Component: Discovery Call / Obligation-Free Enquiry
  // --------------------------------------------------------------------------
  function initIntroCallForm(dialog) {
    const introCallForm = dialog.querySelector('#intro-call-form');
    const introFormStatus = dialog.querySelector('#intro-form-status');
    if (!introCallForm) return;

    applyClientProfilePrefill(dialog, {
      firstName: '#intro_first_name',
      lastName: '#intro_last_name',
      email: '#intro_email',
      phone: '#intro_phone',
      city: '#intro_city'
    });

    introCallForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!requirePrivacyConsent(introCallForm)) return;
      const introData = {
        firstName: dialog.querySelector('#intro_first_name')?.value?.trim() || '',
        lastName: dialog.querySelector('#intro_last_name')?.value?.trim() || '',
        email: dialog.querySelector('#intro_email')?.value?.trim() || '',
        phone: dialog.querySelector('#intro_phone')?.value?.trim() || '',
        city: dialog.querySelector('#intro_city')?.value || '',
        service: dialog.querySelector('#intro_service')?.value || '',
        notes: dialog.querySelector('#intro_notes')?.value?.trim() || '',
        ...privacyConsentFields(introCallForm)
      };

      setFormSubmitting(introCallForm, true);
      if (introFormStatus) {
        introFormStatus.textContent = '';
      }
      try {
        await submitActivepiecesFlow('introCall', introData);
        saveClientProfile({
          firstName: introData.firstName,
          lastName: introData.lastName,
          email: introData.email,
          phone: introData.phone,
          city: introData.city
        });
        try {
          localStorage.setItem('yhh_discovery_request', JSON.stringify({
            ...introData,
            submittedAt: new Date().toISOString()
          }));
        } catch (err) { /* ignore */ }
        if (introFormStatus) {
          introFormStatus.textContent = 'Thanks. We will get back to you.';
          introFormStatus.style.color = '#059669';
        }
        introCallForm.reset();
      } catch (err) {
        console.error(err);
        if (introFormStatus) {
          introFormStatus.textContent = 'Sorry — submission failed. Please try again or email info@yourhomehunter.com.au.';
          introFormStatus.style.color = '#b91c1c';
        }
      } finally {
        setFormSubmitting(introCallForm, false);
      }
    });
  }

  // --------------------------------------------------------------------------
  // Component: Tenancy Consultation Booking ($165 AUD inc. GST)
  // --------------------------------------------------------------------------
  // --------------------------------------------------------------------------
  // Component: Tenancy Consultation Booking ($165 AUD inc. GST)
  // --------------------------------------------------------------------------
  function initConsultForm(dialog) {
    const consultForm = dialog.querySelector('#consult-booking-form');
    const consultSuccessView = dialog.querySelector('#consult-success-view');
    const consultDateInput = dialog.querySelector('#consult_date');

    if (consultDateInput) {
      const today = new Date();
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      consultDateInput.value = `${today.getDate()}-${months[today.getMonth()]}-${today.getFullYear()}`;
    }

    if (!consultForm) return;

    applyClientProfilePrefill(dialog, {
      firstName: '#consult_first_name',
      lastName: '#consult_last_name',
      email: '#consult_email',
      phone: '#consult_phone'
    });

    consultForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const termsAccepted = dialog.querySelector('#consult_terms_accept')?.checked;
      const signature = dialog.querySelector('#consult_signature')?.value?.trim();

      if (!termsAccepted) {
        alert('Please review and accept the Service Agreement terms before proceeding.');
        return;
      }
      if (!signature) {
        alert('Please provide your digital signature (full legal name).');
        return;
      }
      if (!requirePrivacyConsent(consultForm)) return;

      const topics = [];
      dialog.querySelectorAll('input[name="consult_topics"]:checked').forEach((cb) => {
        topics.push(cb.value);
      });
      const otherTopic = dialog.querySelector('#consult_other_topic')?.value?.trim();
      if (otherTopic) {
        topics.push(otherTopic);
      }

      const platformEl = dialog.querySelector('input[name="video_platform"]:checked');
      const bookingRecord = {
        firstName: dialog.querySelector('#consult_first_name')?.value?.trim() || '',
        lastName: dialog.querySelector('#consult_last_name')?.value?.trim() || '',
        email: dialog.querySelector('#consult_email')?.value?.trim() || '',
        phone: dialog.querySelector('#consult_phone')?.value?.trim() || '',
        platform: platformEl ? platformEl.value : 'Zoom',
        topics: topics,
        notes: dialog.querySelector('#consult_notes')?.value?.trim() || '',
        signature: signature,
        agreementDate: consultDateInput ? consultDateInput.value : '',
        feePayableAud: 165.00,
        calendarUrl: getContactConfig().googleAppointmentsConsultUrl || 'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ2_cMxdfUojr153utSiTOByBuvddRpqBLdrqxksB8MPqO4UYEFzoJAKf0pyiJb2e_fZn0DvDBsC',
        termsAccepted: true,
        ...privacyConsentFields(consultForm)
      };

      setFormSubmitting(consultForm, true);
      try {
        await submitActivepiecesFlow('consult', bookingRecord);
        saveClientProfile({
          firstName: bookingRecord.firstName,
          lastName: bookingRecord.lastName,
          email: bookingRecord.email,
          phone: bookingRecord.phone
        });
        try {
          localStorage.setItem('yhh_consultation_booking', JSON.stringify({
            ...bookingRecord,
            submittedAt: new Date().toISOString()
          }));
        } catch (err) { /* ignore */ }
        consultForm.style.display = 'none';
        if (consultSuccessView) {
          consultSuccessView.style.display = 'block';
        }
      } catch (err) {
        console.error(err);
        alert('Sorry — we could not submit your booking. Please try again or email info@yourhomehunter.com.au.');
      } finally {
        setFormSubmitting(consultForm, false);
      }
    });

    dialog.addEventListener('close', () => {
      if (consultSuccessView && consultSuccessView.style.display === 'block') {
        consultSuccessView.style.display = 'none';
        consultForm.reset();
        consultForm.style.display = 'block';
        if (consultDateInput) {
          const today = new Date();
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          consultDateInput.value = `${today.getDate()}-${months[today.getMonth()]}-${today.getFullYear()}`;
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // Component: Inspector Network Application Form
  // --------------------------------------------------------------------------
  function initInspectorForm(dialog) {
    const inspectorForm = dialog.querySelector('#inspector-application-form');
    const inspectorSuccessView = dialog.querySelector('#inspector-success-view');
    if (!inspectorForm) return;

    applyClientProfilePrefill(dialog, {
      firstName: '#insp_first_name',
      lastName: '#insp_last_name',
      email: '#insp_email',
      phone: '#insp_phone'
    });

    inspectorForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!requirePrivacyConsent(inspectorForm)) return;

      const appRecord = {
        firstName: dialog.querySelector('#insp_first_name')?.value?.trim() || '',
        lastName: dialog.querySelector('#insp_last_name')?.value?.trim() || '',
        email: dialog.querySelector('#insp_email')?.value?.trim() || '',
        phone: dialog.querySelector('#insp_phone')?.value?.trim() || '',
        suburbTravel: dialog.querySelector('#insp_suburb')?.value?.trim() || '',
        background: dialog.querySelector('#insp_background')?.value?.trim() || '',
        availability: dialog.querySelector('#insp_availability')?.value?.trim() || '',
        ...privacyConsentFields(inspectorForm)
      };

      setFormSubmitting(inspectorForm, true);
      try {
        await submitActivepiecesFlow('inspector', appRecord);
        saveClientProfile({
          firstName: appRecord.firstName,
          lastName: appRecord.lastName,
          email: appRecord.email,
          phone: appRecord.phone
        });
        try {
          localStorage.setItem('yhh_inspector_application', JSON.stringify({
            ...appRecord,
            submittedAt: new Date().toISOString()
          }));
        } catch (err) { /* ignore */ }
        inspectorForm.style.display = 'none';
        if (inspectorSuccessView) {
          inspectorSuccessView.style.display = 'block';
        }
      } catch (err) {
        console.error(err);
        alert('Sorry — we could not submit your application. Please try again or email info@yourhomehunter.com.au.');
      } finally {
        setFormSubmitting(inspectorForm, false);
      }
    });

    dialog.addEventListener('close', () => {
      if (inspectorSuccessView && inspectorSuccessView.style.display === 'block') {
        inspectorSuccessView.style.display = 'none';
        inspectorForm.reset();
        inspectorForm.style.display = 'block';
      }
    });
  }

  // --------------------------------------------------------------------------
  // Component: Property Review & Inspection Upfront Booking Form
  // --------------------------------------------------------------------------
  function initInspectionBookingForm(dialog) {
    const inspBookingForm = dialog.querySelector('#inspection-booking-form');
    const inspPaymentView = dialog.querySelector('#inspection-payment-view');
    const inspPaymentContainer = dialog.querySelector('#inspection-payment-embed-container');
    const inspBackBtn = dialog.querySelector('#insp-back-to-form-btn');
    const inspBookingSuccessView = dialog.querySelector('#inspection-booking-success-view');
    const inspAgreementDateInput = dialog.querySelector('#insp_agreement_date');

    const pkgCardSingle = dialog.querySelector('#pkg-card-single');
    const pkgCardExpress = dialog.querySelector('#pkg-card-express');
    const expressPropsBlock = dialog.querySelector('#express-properties-block');
    const shortlistCountBadge = dialog.querySelector('#shortlist-count-badge');
    const extraInspectionsSelect = dialog.querySelector('#extra_inspections');

    const feePackageName = dialog.querySelector('#fee-package-name');
    const feeBaseAmount = dialog.querySelector('#fee-base-amount');
    const feeExtraRow = dialog.querySelector('#fee-extra-row');
    const feeExtraAmount = dialog.querySelector('#fee-extra-amount');
    const feeGstAmount = dialog.querySelector('#fee-gst-amount');
    const feeTotalAmount = dialog.querySelector('#fee-total-amount');
    const inspSubmitBtn = dialog.querySelector('#insp-submit-btn');

    let selectedInspectionPkg = 'single';

    if (inspAgreementDateInput) {
      const today = new Date();
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      inspAgreementDateInput.value = `${today.getDate()}-${months[today.getMonth()]}-${today.getFullYear()}`;
    }

    applyClientProfilePrefill(dialog, {
      firstName: '#insp_book_first_name',
      lastName: '#insp_book_last_name',
      email: '#insp_book_email',
      phone: '#insp_book_phone',
      city: '#insp_book_city'
    });

    const updateInspectionPricing = () => {
      const extraCount = extraInspectionsSelect ? parseInt(extraInspectionsSelect.value, 10) : 0;
      const baseExGst = selectedInspectionPkg === 'single' ? 250 : 660;
      const extraExGst = extraCount * 200;
      const baseIncGst = Math.round(baseExGst * 1.1);
      const extraIncGst = Math.round(extraExGst * 1.1);
      const total = baseIncGst + extraIncGst;

      if (feePackageName) {
        feePackageName.textContent = selectedInspectionPkg === 'single'
          ? 'Property Review & (1) Inspection Package:'
          : 'Property Review & Inspection (Express 3-Pack):';
      }
      if (feeBaseAmount) {
        feeBaseAmount.textContent = `$${baseIncGst.toFixed(2)} AUD`;
      }

      if (feeExtraRow && feeExtraAmount) {
        if (extraCount > 0) {
          feeExtraRow.style.display = 'flex';
          feeExtraAmount.textContent = `$${extraIncGst.toFixed(2)} AUD`;
        } else {
          feeExtraRow.style.display = 'none';
        }
      }

      if (feeGstAmount) {
        feeGstAmount.textContent = '';
      }
      if (feeTotalAmount) {
        feeTotalAmount.textContent = `$${total.toFixed(2)} AUD`;
      }
      if (inspSubmitBtn) {
        inspSubmitBtn.textContent = `Accept Terms & Book Inspection Review ($${total.toFixed(2)} AUD inc. GST) →`;
      }
    };

    if (pkgCardSingle) {
      pkgCardSingle.addEventListener('click', () => {
        selectedInspectionPkg = 'single';
        pkgCardSingle.classList.add('active');
        if (pkgCardExpress) pkgCardExpress.classList.remove('active');
        const radio = pkgCardSingle.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;

        if (expressPropsBlock) expressPropsBlock.style.display = 'none';
        if (shortlistCountBadge) shortlistCountBadge.textContent = 'Up to 4 properties';
        updateInspectionPricing();
      });
    }

    if (pkgCardExpress) {
      pkgCardExpress.addEventListener('click', () => {
        selectedInspectionPkg = 'express';
        pkgCardExpress.classList.add('active');
        if (pkgCardSingle) pkgCardSingle.classList.remove('active');
        const radio = pkgCardExpress.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;

        if (expressPropsBlock) expressPropsBlock.style.display = 'block';
        if (shortlistCountBadge) shortlistCountBadge.textContent = 'Up to 6 properties';
        updateInspectionPricing();
      });
    }

    if (extraInspectionsSelect) {
      extraInspectionsSelect.addEventListener('change', updateInspectionPricing);
    }

    if (inspBookingForm) {
      inspBookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const termsAccepted = dialog.querySelector('#insp_terms_accept')?.checked;
        const signature = dialog.querySelector('#insp_signature')?.value?.trim();

        if (!termsAccepted) {
          alert('Please review and accept the Service Agreement terms before proceeding.');
          return;
        }
        if (!signature) {
          alert('Please provide your digital signature (full legal name).');
          return;
        }
        if (!requirePrivacyConsent(inspBookingForm)) return;

        const platformEl = dialog.querySelector('input[name="insp_video_platform"]:checked');
        const extraCount = extraInspectionsSelect ? parseInt(extraInspectionsSelect.value, 10) : 0;
        const basePrice = selectedInspectionPkg === 'single' ? 250 : 660;
        const totalAmount = Math.round((basePrice + (extraCount * 200)) * 1.10);

        const shortlistedProps = [];
        for (let i = 1; i <= (selectedInspectionPkg === 'express' ? 6 : 4); i++) {
          const addr = dialog.querySelector(`#prop_addr_${i}`)?.value?.trim();
          const url = dialog.querySelector(`#prop_url_${i}`)?.value?.trim();
          if (addr || url) {
            shortlistedProps.push({ index: i, address: addr || '', url: url || '' });
          }
        }

        const bookingData = {
          packageKey: selectedInspectionPkg,
          package: selectedInspectionPkg === 'single' ? 'Single Inspection ($275 inc. GST)' : 'Express 3-Pack ($726 inc. GST)',
          extraInspections: extraCount,
          totalPayableAud: totalAmount,
          firstName: dialog.querySelector('#insp_book_first_name')?.value?.trim() || '',
          lastName: dialog.querySelector('#insp_book_last_name')?.value?.trim() || '',
          email: dialog.querySelector('#insp_book_email')?.value?.trim() || '',
          phone: dialog.querySelector('#insp_book_phone')?.value?.trim() || '',
          platform: platformEl ? platformEl.value : 'Zoom',
          city: dialog.querySelector('#insp_book_city')?.value || '',
          suburbs: dialog.querySelector('#insp_book_suburbs')?.value?.trim() || '',
          criteria: dialog.querySelector('#insp_book_criteria')?.value?.trim() || '',
          shortlistedProperties: shortlistedProps,
          signature: signature,
          agreementDate: inspAgreementDateInput ? inspAgreementDateInput.value : '',
          termsAccepted: true,
          ...privacyConsentFields(inspBookingForm)
        };

        setFormSubmitting(inspBookingForm, true);
        try {
          await submitActivepiecesFlow('inspectionBooking', bookingData);
          saveClientProfile({
            firstName: bookingData.firstName,
            lastName: bookingData.lastName,
            email: bookingData.email,
            phone: bookingData.phone,
            city: bookingData.city
          });
          try {
            localStorage.setItem('yhh_inspection_booking', JSON.stringify({
              ...bookingData,
              submittedAt: new Date().toISOString()
            }));
          } catch (err) { /* ignore */ }
          inspBookingForm.style.display = 'none';
          if (inspBookingSuccessView) {
            inspBookingSuccessView.style.display = 'block';
          }
        } catch (err) {
          console.error(err);
          alert('Sorry — we could not submit your booking. Please try again or email info@yourhomehunter.com.au.');
        } finally {
          setFormSubmitting(inspBookingForm, false);
        }
      });
    }

    dialog.addEventListener('close', () => {
      if (inspBookingSuccessView && inspBookingSuccessView.style.display === 'block') {
        inspBookingSuccessView.style.display = 'none';
        if (inspBookingForm) {
          inspBookingForm.reset();
          inspBookingForm.style.display = 'block';
          selectedInspectionPkg = 'single';
          if (pkgCardSingle) pkgCardSingle.classList.add('active');
          if (pkgCardExpress) pkgCardExpress.classList.remove('active');
          if (expressPropsBlock) expressPropsBlock.style.display = 'none';
          if (shortlistCountBadge) shortlistCountBadge.textContent = 'Up to 4 properties';
          if (inspAgreementDateInput) {
            const today = new Date();
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            inspAgreementDateInput.value = `${today.getDate()}-${months[today.getMonth()]}-${today.getFullYear()}`;
          }
          updateInspectionPricing();
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // Component: Native Tenancy / Rental Submission (replaces Zoho form)
  // --------------------------------------------------------------------------
  const TENANCY_MAX_FILE_BYTES = 8 * 1024 * 1024;

  function sanitizeDriveFileName(name) {
    const base = String(name || 'file').trim() || 'file';
    return base
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 120);
  }

  function sanitizeDriveFolderPart(value) {
    return String(value || '')
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);
  }

  /** e.g. Smith_Jane_2026-10-09 — used by Activepieces Google Drive folder naming */
  function buildDriveFolderLabel(firstName, lastName, when = new Date()) {
    const last = sanitizeDriveFolderPart(lastName) || 'Applicant';
    const first = sanitizeDriveFolderPart(firstName) || 'Unknown';
    const yyyy = when.getFullYear();
    const mm = String(when.getMonth() + 1).padStart(2, '0');
    const dd = String(when.getDate()).padStart(2, '0');
    return `${last}_${first}_${yyyy}-${mm}-${dd}`;
  }

  function readFileAsBase64(file, docKey) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        const safeFileName = sanitizeDriveFileName(file.name);
        resolve({
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          base64,
          docKey: docKey || '',
          safeFileName,
          driveFileName: docKey ? `${docKey}__${safeFileName}` : safeFileName
        });
      };
      reader.onerror = () => reject(new Error('Could not read file: ' + file.name));
      reader.readAsDataURL(file);
    });
  }

  async function collectTenancyFiles(form) {
    const files = {};
    const inputs = form.querySelectorAll('input[type="file"][data-file-key]');
    for (const input of inputs) {
      const key = input.getAttribute('data-file-key');
      if (!key || !input.files || !input.files.length) continue;
      const list = [];
      for (const file of Array.from(input.files)) {
        if (file.size > TENANCY_MAX_FILE_BYTES) {
          throw new Error(`"${file.name}" is over 8 MB. Please upload a smaller file.`);
        }
        list.push(await readFileAsBase64(file, key));
      }
      files[key] = input.multiple ? list : list[0];
    }
    return files;
  }

  function initTenancyApplicationForm(root) {
    const form = root.querySelector('#tenancy-application-form');
    if (!form || form.dataset.initialized) return;
    form.dataset.initialized = 'true';

    const steps = root.querySelectorAll('[data-tenancy-step]');
    const indicators = root.querySelectorAll('[data-tenancy-indicator]');
    const successView = root.querySelector('#tenancy-success-view');
    const stepper = root.querySelector('.tenancy-stepper');
    const ownHome = root.querySelector('#ta_own_home');
    const currentRental = root.querySelector('#ta-current-rental-block');
    const selfEmployed = root.querySelector('#ta_self_employed');
    const employeeBlock = root.querySelector('#ta-employee-block');
    const notStudent = root.querySelector('#ta_not_student');
    const studentBlock = root.querySelector('#ta-student-block');
    const petsCountInput = root.querySelector('#ta_pets');
    const petResumeBlock = root.querySelector('#ta-pet-resume-block');

    const goToStep = (stepNumber) => {
      steps.forEach((step) => {
        const n = parseInt(step.getAttribute('data-tenancy-step'), 10);
        step.classList.toggle('active', n === stepNumber);
      });
      indicators.forEach((ind) => {
        const n = parseInt(ind.getAttribute('data-tenancy-indicator'), 10);
        ind.classList.toggle('active', n === stepNumber);
        ind.classList.toggle('completed', n < stepNumber);
      });
      const sticky = root.querySelector('.wishlist-stepper-sticky');
      const top = sticky ? Math.max(0, sticky.getBoundingClientRect().top + window.scrollY - 72) : 0;
      window.scrollTo({ top, behavior: 'smooth' });
    };

    const syncSkipBlocks = () => {
      if (currentRental) currentRental.style.display = ownHome && ownHome.checked ? 'none' : 'block';
      if (employeeBlock) employeeBlock.style.display = selfEmployed && selfEmployed.checked ? 'none' : 'block';
      if (studentBlock) studentBlock.style.display = notStudent && notStudent.checked ? 'none' : 'block';
      if (petResumeBlock && petsCountInput) {
        const hasPets = parseInt(petsCountInput.value, 10) > 0;
        petResumeBlock.hidden = !hasPets;
      }
    };
    if (ownHome) ownHome.addEventListener('change', syncSkipBlocks);
    if (selfEmployed) selfEmployed.addEventListener('change', syncSkipBlocks);
    if (notStudent) notStudent.addEventListener('change', syncSkipBlocks);
    if (petsCountInput) {
      petsCountInput.addEventListener('input', syncSkipBlocks);
      petsCountInput.addEventListener('change', syncSkipBlocks);
    }
    syncSkipBlocks();

    applyClientProfilePrefill(root, {
      firstName: '#ta_first',
      lastName: '#ta_last',
      preferredName: '#ta_pref',
      phone: '#ta_mobile',
      email: '#ta_email'
    });

    // "No" portal option is exclusive
    form.querySelectorAll('input[name="portalsUsed"]').forEach((cb) => {
      cb.addEventListener('change', () => {
        if (!cb.checked) return;
        if (cb.hasAttribute('data-exclusive-portal')) {
          form.querySelectorAll('input[name="portalsUsed"]').forEach((other) => {
            if (other !== cb) other.checked = false;
          });
        } else {
          const none = form.querySelector('input[name="portalsUsed"][data-exclusive-portal]');
          if (none) none.checked = false;
        }
      });
    });

    root.querySelectorAll('[data-tenancy-next]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const stepEl = btn.closest('[data-tenancy-step]');
        if (!stepEl) return;
        const required = stepEl.querySelectorAll('input[required], select[required], textarea[required]');
        for (const input of required) {
          if (input.offsetParent === null) continue;
          if (!input.checkValidity()) {
            input.reportValidity();
            return;
          }
        }
        goToStep(parseInt(btn.getAttribute('data-tenancy-next'), 10));
      });
    });

    root.querySelectorAll('[data-tenancy-prev]').forEach((btn) => {
      btn.addEventListener('click', () => {
        goToStep(parseInt(btn.getAttribute('data-tenancy-prev'), 10));
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const lastStep = form.querySelector('[data-tenancy-step="6"]');
      if (lastStep) {
        const required = lastStep.querySelectorAll('input[required], select[required], textarea[required]');
        for (const input of required) {
          if (!input.checkValidity()) {
            input.reportValidity();
            return;
          }
        }
      }

      if (!requirePrivacyConsent(form)) return;

      setFormSubmitting(form, true);
      try {
        const raw = formDataToObject(new FormData(form));
        // Strip file binary placeholders from FormData object (handled separately)
        Object.keys(raw).forEach((key) => {
          if (raw[key] instanceof File || (typeof raw[key] === 'string' && raw[key] === '')) {
            /* keep strings */
          }
          if (typeof File !== 'undefined' && raw[key] instanceof File) delete raw[key];
        });

        const files = await collectTenancyFiles(form);
        const driveFolderLabel = buildDriveFolderLabel(raw.firstName, raw.lastName);
        const payload = {
          ...raw,
          portalsUsed: [].concat(raw.portalsUsed || []).filter(Boolean),
          livingInOwnHome: !!(ownHome && ownHome.checked),
          isSelfEmployed: !!(selfEmployed && selfEmployed.checked),
          notStudent: !!(notStudent && notStudent.checked),
          files,
          driveFolderLabel,
          ...privacyConsentFields(form)
        };

        // Remove non-serialisable File entries if any slipped through
        ['licenceFile', 'passportFile', 'otherIdFile', 'petFile', 'ownershipFile', 'payslips', 'otherIncomeFile']
          .forEach((k) => { delete payload[k]; });

        await submitActivepiecesFlow('tenancyApplication', payload);
        saveClientProfile({
          firstName: payload.firstName,
          lastName: payload.lastName,
          preferredName: payload.preferredName,
          phone: payload.mobile || payload.phone,
          email: payload.email,
          city: payload.currentSuburb || payload.city
        });

        form.style.display = 'none';
        if (stepper) stepper.style.display = 'none';
        if (successView) successView.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        console.error(err);
        alert(err && err.message
          ? err.message
          : 'Sorry — we could not submit your application. Please try again or email info@yourhomehunter.com.au.');
      } finally {
        setFormSubmitting(form, false);
      }
    });
  }

  // --------------------------------------------------------------------------
  // Canvas signature pad (Full Service agreement)
  // --------------------------------------------------------------------------
  function initSignaturePad(canvas, options = {}) {
    if (!canvas || canvas.dataset.padReady) return null;
    canvas.dataset.padReady = 'true';

    const ctx = canvas.getContext('2d');
    const statusEl = options.statusEl || null;
    const hiddenEl = options.hiddenEl || null;
    let drawing = false;
    let hasInk = false;
    let lastX = 0;
    let lastY = 0;

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(320, Math.floor(rect.width));
      const h = Math.max(160, Math.floor(rect.height || 200));
      const snapshot = hasInk ? canvas.toDataURL('image/png') : null;
      canvas.width = w * ratio;
      canvas.height = h * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1f2a24';
      ctx.lineWidth = 2.25;
      if (snapshot) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, w, h);
        img.src = snapshot;
      }
    };

    const pointFromEvent = (e) => {
      const rect = canvas.getBoundingClientRect();
      const src = e.touches && e.touches[0] ? e.touches[0] : e;
      return {
        x: src.clientX - rect.left,
        y: src.clientY - rect.top
      };
    };

    const markSigned = () => {
      hasInk = true;
      if (statusEl) {
        statusEl.textContent = 'Signed';
        statusEl.classList.add('is-signed');
      }
      if (hiddenEl) hiddenEl.value = canvas.toDataURL('image/png');
    };

    const start = (e) => {
      e.preventDefault();
      drawing = true;
      const p = pointFromEvent(e);
      lastX = p.x;
      lastY = p.y;
    };

    const move = (e) => {
      if (!drawing) return;
      e.preventDefault();
      const p = pointFromEvent(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastX = p.x;
      lastY = p.y;
      markSigned();
    };

    const end = (e) => {
      if (!drawing) return;
      e.preventDefault();
      drawing = false;
      if (hasInk && hiddenEl) hiddenEl.value = canvas.toDataURL('image/png');
    };

    const clear = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      hasInk = false;
      if (statusEl) {
        statusEl.textContent = 'Not signed yet';
        statusEl.classList.remove('is-signed');
      }
      if (hiddenEl) hiddenEl.value = '';
    };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);
    canvas.addEventListener('touchcancel', end);
    window.addEventListener('resize', resize);
    resize();

    return {
      clear,
      hasSignature: () => hasInk,
      toDataURL: () => (hasInk ? canvas.toDataURL('image/png') : '')
    };
  }

  function initServiceAgreementForm(root) {
    const form = root.querySelector('#service-agreement-form');
    if (!form || form.dataset.initialized) return;
    form.dataset.initialized = 'true';

    const dateInput = root.querySelector('#sa_date');
    if (dateInput && !dateInput.value) {
      const today = new Date();
      dateInput.value = today.toISOString().slice(0, 10);
    }

    const canvas = root.querySelector('#sa_signature_pad');
    const clearBtn = root.querySelector('#sa_signature_clear');
    const statusEl = root.querySelector('#sa_signature_status');
    const hiddenEl = root.querySelector('#sa_signature_data');
    const successView = root.querySelector('#service-agreement-success');
    const pad = initSignaturePad(canvas, { statusEl, hiddenEl });
    if (clearBtn && pad) clearBtn.addEventListener('click', () => pad.clear());

    applyClientProfilePrefill(root, {
      firstName: '#sa_first',
      lastName: '#sa_last',
      email: '#sa_email',
      phone: '#sa_phone'
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const locations = Array.from(form.querySelectorAll('input[name="searchLocations"]:checked'))
        .map((el) => el.value);
      if (!locations.length) {
        alert('Please select at least one search location.');
        return;
      }
      if (!requirePrivacyConsent(form)) return;
      if (!pad || !pad.hasSignature()) {
        alert('Please draw your signature in the box before submitting.');
        return;
      }

      const payload = {
        agreementDate: root.querySelector('#sa_date')?.value || '',
        firstName: root.querySelector('#sa_first')?.value?.trim() || '',
        lastName: root.querySelector('#sa_last')?.value?.trim() || '',
        email: root.querySelector('#sa_email')?.value?.trim() || '',
        phone: root.querySelector('#sa_phone')?.value?.trim() || '',
        searchLocations: locations,
        feeAcknowledged: true,
        termsAccepted: true,
        signatureName: root.querySelector('#sa_signature_name')?.value?.trim() || '',
        signatureImagePngBase64: (pad.toDataURL() || '').split(',')[1] || '',
        signatureImageDataUrl: pad.toDataURL() || '',
        ...privacyConsentFields(form)
      };

      setFormSubmitting(form, true);
      try {
        await submitActivepiecesFlow('serviceAgreement', payload);
        saveClientProfile({
          firstName: payload.firstName,
          lastName: payload.lastName,
          email: payload.email,
          phone: payload.phone,
          searchLocations: payload.searchLocations,
          city: payload.searchLocations && payload.searchLocations[0]
        });
        try {
          localStorage.setItem('yhh_service_agreement', JSON.stringify({
            name: `${payload.firstName} ${payload.lastName}`.trim(),
            firstName: payload.firstName,
            lastName: payload.lastName,
            email: payload.email,
            phone: payload.phone,
            locations: payload.searchLocations,
            signedAt: new Date().toISOString()
          }));
          const fspSteps = JSON.parse(localStorage.getItem('yhh_fsp_steps_v1') || '{}');
          fspSteps['1'] = true;
          localStorage.setItem('yhh_fsp_steps_v1', JSON.stringify(fspSteps));
        } catch (err) { /* ignore */ }

        form.style.display = 'none';
        if (successView) successView.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        console.error(err);
        alert('Sorry — we could not submit your signed agreement. Please try again or email info@yourhomehunter.com.au.');
      } finally {
        setFormSubmitting(form, false);
      }
    });
  }

  // --------------------------------------------------------------------------
  // Wish List Light enquiry (aligned to Zoho WishListLight)
  // --------------------------------------------------------------------------
  function initSearchEnquiryForm(root) {
    const form = root.querySelector('#search-enquiry-form');
    if (!form || form.dataset.initialized) return;
    form.dataset.initialized = 'true';

    const lists = window.YHH_SEARCH_SUBURBS || {};
    const city = form.querySelector('#se_city');
    const suburbWrap = form.querySelector('#se_suburb_wrap');
    const suburbLabel = form.querySelector('#se_suburb_label');
    const suburbPicker = form.querySelector('#se_suburb_picker');
    const suburbFilter = form.querySelector('#se_suburb_filter');
    const success = root.querySelector('#search-enquiry-success');
    const MAX_SUBURBS = 4;
    let suburbOptions = [];
    let chosenSuburbs = [];

    const escapeHtml = (value) => String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');

    const checkedValues = (name) =>
      Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map((el) => el.value);

    const selectedSuburbs = () => chosenSuburbs.slice();

    const refreshMultiSelect = (select) => {
      const valueEl = select.querySelector('.multi-select-value');
      if (!valueEl) return;
      const names = Array.from(select.querySelectorAll('input[type="checkbox"]:checked'))
        .map((el) => el.closest('label')?.querySelector('span')?.textContent?.trim() || el.value);
      const placeholder = select.dataset.placeholder || 'Select';
      valueEl.textContent = names.length ? names.join(', ') : placeholder;
      valueEl.classList.toggle('is-placeholder', !names.length);
    };

    const closeMultiSelects = () => {
      form.querySelectorAll('.multi-select.is-open').forEach((select) => {
        select.classList.remove('is-open');
        const panel = select.querySelector('.multi-select-panel');
        const toggle = select.querySelector('.multi-select-toggle');
        if (panel) panel.hidden = true;
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      });
    };

    form.querySelectorAll('.multi-select').forEach((select) => {
      const toggle = select.querySelector('.multi-select-toggle');
      const panel = select.querySelector('.multi-select-panel');
      if (!toggle || !panel) return;
      toggle.addEventListener('click', () => {
        const willOpen = !select.classList.contains('is-open');
        closeMultiSelects();
        if (!willOpen) return;
        select.classList.add('is-open');
        panel.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
      });
      select.addEventListener('change', () => refreshMultiSelect(select));
      refreshMultiSelect(select);
    });

    document.addEventListener('click', (event) => {
      if (event.target.closest('.multi-select')) return;
      closeMultiSelects();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMultiSelects();
    });

    const syncSuburbSummary = () => {
      const select = form.querySelector('#se_suburb_select');
      if (select) refreshMultiSelect(select);
    };

    const renderSuburbPicker = () => {
      if (!suburbPicker) return;
      const query = (suburbFilter?.value || '').trim().toLowerCase();
      const chosen = new Set(chosenSuburbs);
      const visible = suburbOptions.filter((name) => !query || name.toLowerCase().includes(query));
      suburbPicker.innerHTML = visible.length
        ? visible.map((name) => {
          const safe = escapeHtml(name);
          const checked = chosen.has(name) ? ' checked' : '';
          return '<label class="suburb-option"><input type="checkbox" name="suburbs" value="' + safe + '"' + checked + '><span>' + safe + '</span></label>';
        }).join('')
        : '<p class="field-hint">No suburbs match that search.</p>';
      syncSuburbSummary();
    };

    const fillSuburbs = () => {
      suburbOptions = lists[city.value] || [];
      chosenSuburbs = [];
      const hasList = suburbOptions.length > 0;
      suburbWrap.hidden = !hasList;
      if (suburbFilter) suburbFilter.value = '';
      if (suburbLabel) {
        suburbLabel.textContent = hasList
          ? 'Preferred suburbs (' + city.value + ')'
          : 'Preferred suburbs';
      }
      if (suburbFilter) {
        suburbFilter.placeholder = city.value === 'Melbourne'
          ? 'e.g. Richmond'
          : city.value === 'Brisbane'
            ? 'e.g. New Farm'
            : city.value === 'Canberra'
              ? 'e.g. Kingston'
              : city.value === 'Adelaide'
                ? 'e.g. Norwood'
                : 'Search suburbs';
      }
      renderSuburbPicker();
    };

    const syncPropertyTypes = () => {
      const boxes = Array.from(form.querySelectorAll('input[name="propertyType"]'));
      const allBox = boxes.find((el) => el.value === 'All types');
      if (!allBox) return;
      const allOn = allBox.checked;
      boxes.forEach((el) => {
        if (el === allBox) return;
        if (allOn) el.checked = false;
        el.disabled = allOn;
        el.closest('label')?.classList.toggle('is-disabled', allOn);
      });
      const select = allBox.closest('.multi-select');
      if (select) refreshMultiSelect(select);
    };

    form.querySelectorAll('input[name="propertyType"]').forEach((el) => {
      el.addEventListener('change', () => {
        if (el.value !== 'All types' && el.checked) {
          const allBox = form.querySelector('input[name="propertyType"][value="All types"]');
          if (allBox) allBox.checked = false;
        }
        syncPropertyTypes();
      });
    });
    syncPropertyTypes();

    city.addEventListener('change', fillSuburbs);
    if (suburbFilter) {
      suburbFilter.addEventListener('input', renderSuburbPicker);
    }
    if (suburbPicker) {
      suburbPicker.addEventListener('change', (e) => {
        const box = e.target.closest('input[name="suburbs"]');
        if (!box) return;
        if (box.checked) {
          if (chosenSuburbs.includes(box.value)) return;
          if (chosenSuburbs.length >= MAX_SUBURBS) {
            box.checked = false;
            alert('Please choose up to ' + MAX_SUBURBS + ' suburbs.');
            return;
          }
          chosenSuburbs.push(box.value);
        } else {
          chosenSuburbs = chosenSuburbs.filter((name) => name !== box.value);
        }
        syncSuburbSummary();
      });
    }

    applyClientProfilePrefill(root, {
      firstName: '#se_first_name',
      lastName: '#se_last_name',
      email: '#se_email',
      phone: '#se_phone',
      city: '#se_city',
      relocationFrom: '#se_current_location'
    });
    if (city.value) fillSuburbs();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!requirePrivacyConsent(form)) return;

      const propertyTypes = checkedValues('propertyType');
      if (!propertyTypes.length) {
        alert('Please choose at least one property type.');
        return;
      }

      const suburbList = selectedSuburbs();
      const moveIso = form.querySelector('#se_move_date').value || '';
      const formatMoveByDate = (isoDateStr) => {
        if (!isoDateStr) return '';
        const parts = isoDateStr.split('-');
        if (parts.length !== 3) return isoDateStr;
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthIdx = parseInt(parts[1], 10) - 1;
        if (monthIdx < 0 || monthIdx > 11) return isoDateStr;
        return parts[2] + '-' + months[monthIdx] + '-' + parts[0];
      };

      // Shape matches the existing Zoho WishListLight form body (AP → Zoho).
      const payload = {
        firstName: form.querySelector('#se_first_name').value.trim(),
        lastName: form.querySelector('#se_last_name').value.trim(),
        email: form.querySelector('#se_email').value.trim(),
        phone: form.querySelector('#se_phone').value.trim(),
        currentLocation: form.querySelector('#se_current_location').value.trim(),
        location: city.value,
        propertyType: propertyTypes,
        bedrooms: form.querySelector('#se_bedrooms').value.trim(),
        bathrooms: form.querySelector('#se_bathrooms').value.trim(),
        suburbs: suburbList,
        rentalBudget: form.querySelector('#se_budget').value.trim(),
        moveByDate: formatMoveByDate(moveIso),
        propertyRequirements: checkedValues('propertyRequirements'),
        otherDetails: form.querySelector('#se_notes').value.trim(),
        formSource: form.querySelector('#se_source').value,
        referral: form.querySelector('#se_referrer').value.trim(),
        referer: document.referrer || '',
        // userCountry is set by the submit proxy from Cloudflare IP geo
        ...privacyConsentFields(form)
      };

      setFormSubmitting(form, true);
      try {
        await submitActivepiecesFlow('wishlist', payload);
        saveClientProfile({
          firstName: payload.firstName,
          lastName: payload.lastName,
          email: payload.email,
          phone: payload.phone,
          city: payload.location,
          relocationFrom: payload.currentLocation,
          budgetWeekly: payload.rentalBudget,
          searchLocations: payload.location ? [payload.location] : []
        });
        form.hidden = true;
        if (success) success.hidden = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        console.error(err);
        alert('Sorry — we could not send your enquiry. Please try again or email info@yourhomehunter.com.au.');
      } finally {
        setFormSubmitting(form, false);
      }
    });
  }

  // Hydrate any dialogs already present in the initial DOM (e.g. standalone view)
  document.querySelectorAll('dialog').forEach(initDialogComponents);
  const wishlistPageRoot = document.getElementById('wishlist-page-root');
  if (wishlistPageRoot) {
    initDialogComponents(wishlistPageRoot);
  }
  const searchEnquiryRoot = document.getElementById('search-enquiry-root');
  if (searchEnquiryRoot) {
    initSearchEnquiryForm(searchEnquiryRoot);
  }
  const tenancyPageRoot = document.getElementById('tenancy-page-root');
  if (tenancyPageRoot) {
    initTenancyApplicationForm(tenancyPageRoot);
  }
  const serviceAgreementRoot = document.getElementById('service-agreement-root');
  if (serviceAgreementRoot) {
    initServiceAgreementForm(serviceAgreementRoot);
  }
  initAddressAutocomplete(document);

  // ==========================================================================
  // "The Rental Wrap" Blog Engine (Search, Filter & Full Article Reader)
  // ==========================================================================
  const blogSearchInput = document.getElementById('blogSearchInput');
  const filterPills = document.querySelectorAll('.filter-pill');
  const articleCards = document.querySelectorAll('.blog-grid-card');
  const noResultsMsg = document.getElementById('noResultsMessage');
  const gridHeading = document.getElementById('gridHeading');
  const gridSubtitle = document.getElementById('gridSubtitle');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');

  let activeCategory = 'all';
  let searchQuery = '';

  const applyBlogFilters = () => {
    if (!articleCards.length) return;

    let visibleCount = 0;
    const cleanQuery = searchQuery.trim().toLowerCase();

    articleCards.forEach((card) => {
      const category = card.getAttribute('data-category') || '';
      const title = (card.getAttribute('data-title') || '').toLowerCase();
      const text = card.textContent.toLowerCase();

      const matchesCategory = (activeCategory === 'all' || category.toLowerCase() === activeCategory.toLowerCase());
      const matchesSearch = (!cleanQuery || title.includes(cleanQuery) || text.includes(cleanQuery));

      if (matchesCategory && matchesSearch) {
        card.style.display = 'flex';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });

    if (gridSubtitle) {
      gridSubtitle.textContent = `Showing ${visibleCount} ${visibleCount === 1 ? 'article' : 'articles'}`;
    }
    if (noResultsMsg) {
      noResultsMsg.style.display = visibleCount === 0 ? 'block' : 'none';
    }
  };

  // Category Filter Pills
  filterPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      filterPills.forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      activeCategory = pill.getAttribute('data-filter') || 'all';
      if (gridHeading) {
        gridHeading.textContent = activeCategory === 'all' ? 'All Articles & Insights' : `${activeCategory} Articles`;
      }
      applyBlogFilters();
    });
  });

  // Real-time Search Input
  if (blogSearchInput) {
    blogSearchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      applyBlogFilters();
    });
  }

  // Reset Filters Button
  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', () => {
      activeCategory = 'all';
      searchQuery = '';
      if (blogSearchInput) blogSearchInput.value = '';
      filterPills.forEach((p) => {
        p.classList.toggle('active', p.getAttribute('data-filter') === 'all');
      });
      if (gridHeading) gridHeading.textContent = 'All Articles & Insights';
      applyBlogFilters();
    });
  }

  // Open Full Article in Reader Modal
  const articleReaderModal = document.getElementById('articleReaderModal');
  const readerTitle = document.getElementById('readerTitle');
  const readerCategory = document.getElementById('readerCategory');
  const readerDate = document.getElementById('readerDate');
  const readerReadTime = document.getElementById('readerReadTime');
  const readerImage = document.getElementById('readerImage');
  const readerImageContainer = document.getElementById('readerImageContainer');
  const readerBody = document.getElementById('readerBody');

  /** Full filename from a path or URL. */
  const blogImageFilename = (url) => {
    if (!url) return '';
    try {
      const raw = String(url).split('?')[0].split('/').pop() || '';
      return decodeURIComponent(raw.replace(/\+/g, ' ')).toLowerCase();
    } catch (err) {
      return String(url).toLowerCase();
    }
  };

  /**
   * Compare key that ignores Squarespace/local CDN id prefixes so
   * 1789440184849-KYJYUX6BV3-unsplash-image-atN1WzTB3iM.jpg and
   * 1789439912650-3QRA2BY6Q9-unsplash-image-atN1WzTB3iM.jpg match.
   */
  const blogImageKey = (url) => {
    let file = blogImageFilename(url);
    if (!file) return '';
    file = file
      // 1789440184849-KYJYUX6BV3-unsplash-…
      .replace(/^\d{10,}-[a-z0-9]+-/i, '')
      // ffc5cde0-efd3-4b2c-9f21--4sale.jpg (partial or full uuid prefix)
      .replace(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}(?:-[0-9a-f]{12})?-+/i, '')
      .replace(/^-+/, '');
    return file;
  };

  /**
   * Modal chrome already shows post.assetUrl as the hero. Squarespace bodyHtml
   * often repeats that same featured image as the first image block (same
   * photo, different CDN / local id). Strip that duplicate only.
   */
  const stripDuplicateFeaturedImage = (html, assetUrl) => {
    if (!html || !assetUrl || typeof DOMParser === 'undefined') return html;

    const assetKey = blogImageKey(assetUrl);
    const assetFile = blogImageFilename(assetUrl);
    if (!assetKey && !assetFile) return html;

    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const block = doc.querySelector('.sqs-block-image, .image-block, [data-block-type="5"]');
      if (!block) return html;

      const candidateUrls = [];
      block.querySelectorAll('img[src], img[data-src], [data-image]').forEach((el) => {
        ['src', 'data-src', 'data-image'].forEach((attr) => {
          const value = el.getAttribute(attr);
          if (value) candidateUrls.push(value);
        });
      });

      const matchesAsset = candidateUrls.some((url) => {
        const key = blogImageKey(url);
        const file = blogImageFilename(url);
        return (assetKey && key && key === assetKey) || (assetFile && file === assetFile);
      }) || (assetKey && block.innerHTML.toLowerCase().includes(assetKey))
        || (assetFile && block.innerHTML.toLowerCase().includes(assetFile));

      if (!matchesAsset) return html;

      block.remove();
      return doc.body.innerHTML;
    } catch (err) {
      return html;
    }
  };

  const openArticleReader = (slug) => {
    if (!slug) return;

    // Look up in window.YHH_BLOG_POSTS
    const posts = window.YHH_BLOG_POSTS || [];
    const post = posts.find((p) => p.urlId === slug);

    if (post && articleReaderModal) {
      if (readerTitle) readerTitle.textContent = post.title;
      if (readerCategory) readerCategory.textContent = post.category || 'Renting Tips';
      if (readerDate) readerDate.textContent = post.displayDate || '';

      const bodyLen = post.bodyHtml ? post.bodyHtml.length : 500;
      const readMins = Math.max(3, Math.ceil(bodyLen / 1800));
      if (readerReadTime) readerReadTime.textContent = `${readMins} min read`;

      if (readerImage && readerImageContainer) {
        if (post.assetUrl) {
          const src = post.assetUrl;
          readerImage.src = /^https?:\/\//i.test(src) && src.indexOf('squarespace') !== -1
            ? src + (src.indexOf('?') === -1 ? '?format=1000w' : '')
            : src;
          readerImage.alt = post.title;
          readerImageContainer.style.display = 'block';
        } else {
          readerImageContainer.style.display = 'none';
        }
      }

      if (readerBody) {
        const rawBody = post.bodyHtml || `<p>${post.excerpt}</p>`;
        readerBody.innerHTML = post.assetUrl
          ? stripDuplicateFeaturedImage(rawBody, post.assetUrl)
          : rawBody;
      }

      if (typeof articleReaderModal.showModal === 'function') {
        articleReaderModal.showModal();
        articleReaderModal.scrollTop = 0;
      }
    } else {
      const targetCard = document.getElementById(`post-${slug}`);
      if (targetCard) {
        targetCard.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  // Article cards link to /the-rental-rap/{slug}. Older hash links still resolve.
  document.addEventListener('click', (e) => {
    const readBtn = e.target.closest('.btn-read-article, [data-article-slug]');
    if (!readBtn) return;
    const href = readBtn.getAttribute('href') || '';
    if (readBtn.tagName === 'A' && href.startsWith('/the-rental-rap/')) return;
    e.preventDefault();
    const slug = readBtn.getAttribute('data-article-slug');
    if (slug) openArticleReader(slug);
  });

  const handleHashArticle = () => {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#post-')) {
      const slug = hash.replace('#post-', '');
      window.location.replace('/the-rental-rap/' + slug);
    }
  };

  handleHashArticle();
  window.addEventListener('hashchange', handleHashArticle);

  // Initialize Quick Connect Widget & Bind Contact Links
  initQuickConnectWidget();
  bindContactConfigLinks(document);
});
