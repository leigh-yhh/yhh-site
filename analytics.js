/**
 * Google Analytics 4 (gtag)
 * Set window.YHH_CONTACT_CONFIG.googleAnalyticsId to your Measurement ID (G-XXXXXXXX).
 * Leave empty to disable.
 */
(function () {
  'use strict';

  const cfg = window.YHH_CONTACT_CONFIG || {};
  const id = (cfg.googleAnalyticsId || '').trim();
  if (!id || !/^G-[A-Z0-9]+$/i.test(id)) return;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;

  gtag('js', new Date());
  gtag('config', id, {
    send_page_view: true,
    anonymize_ip: true
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
  document.head.appendChild(script);

  const track = (name, params) => {
    try { gtag('event', name, params || {}); } catch (e) {}
  };

  window.YHHAnalytics = { track: track, measurementId: id };

  // Engagement: section visibility (homepage / long pages)
  if ('IntersectionObserver' in window) {
    const seen = new Set();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const idAttr = entry.target.id || entry.target.getAttribute('data-analytics-section');
        if (!idAttr || seen.has(idAttr)) return;
        seen.add(idAttr);
        track('section_view', { section_id: idAttr, page_path: location.pathname });
      });
    }, { threshold: 0.35 });

    const watch = document.querySelectorAll(
      'section[id], [data-analytics-section], #services, #coverage, #about, #testimonials, #faq, #articlesGrid'
    );
    watch.forEach((el) => observer.observe(el));
  }

  // Modal opens (services, booking, legal)
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-modal-target]');
    if (trigger) {
      track('modal_open', {
        modal_id: trigger.getAttribute('data-modal-target'),
        page_path: location.pathname
      });
    }

    const articleBtn = e.target.closest('[data-article-slug], .btn-read-article');
    if (articleBtn) {
      track('blog_article_open', {
        article_slug: articleBtn.getAttribute('data-article-slug') || '',
        page_path: location.pathname
      });
    }

    const tel = e.target.closest('a[href^="tel:"]');
    if (tel) {
      track('click_phone', { link_url: tel.getAttribute('href'), page_path: location.pathname });
    }

    const mail = e.target.closest('a[href^="mailto:"]');
    if (mail) {
      track('click_email', { link_url: mail.getAttribute('href'), page_path: location.pathname });
    }

    const wa = e.target.closest('a.whatsapp-direct-link, a[href*="wa.me"]');
    if (wa) {
      track('click_whatsapp', { page_path: location.pathname });
    }
  }, true);

  // Scroll depth milestones
  const depths = [25, 50, 75, 90];
  const hit = new Set();
  const onScroll = () => {
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - window.innerHeight;
    if (scrollable <= 0) return;
    const pct = Math.round((window.scrollY / scrollable) * 100);
    depths.forEach((d) => {
      if (pct >= d && !hit.has(d)) {
        hit.add(d);
        track('scroll_depth', { percent: d, page_path: location.pathname });
      }
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
})();
