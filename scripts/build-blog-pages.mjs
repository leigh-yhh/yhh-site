/**
 * Builds one HTML page per Rental Wrap article at the Squarespace paths
 * (/the-rental-rap/{slug}) and writes sitemap.xml.
 *
 * The first run also moves blog.html to the-rental-rap/index.html so the
 * blog index keeps the URL Google already has. Later runs only refresh
 * the article pages and the sitemap.
 */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origin = "https://www.yourhomehunter.com.au";
const blogDir = path.join(root, "the-rental-rap");
const posts = loadPosts();

fs.mkdirSync(blogDir, { recursive: true });
moveBlogIndex();
for (const post of posts) {
  fs.writeFileSync(path.join(blogDir, `${post.urlId}.html`), renderPost(post), "utf8");
}
fs.writeFileSync(path.join(root, "sitemap.xml"), renderSitemap(posts), "utf8");
patchDialogs();
console.log(`Wrote ${posts.length} article pages and sitemap.xml`);

function patchDialogs() {
  const dir = path.join(root, "dialogs");
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".html")) continue;
    const file = path.join(dir, name);
    let html = fs.readFileSync(file, "utf8");
    const next = html
      .replaceAll('href="../blog.html"', 'href="/the-rental-rap"')
      .replaceAll("https://www.yourhomehunter.com.au/diy-guide.html", "https://www.yourhomehunter.com.au/diy-guide")
      .replaceAll("https://www.yourhomehunter.com.au/request-full-service.html", "https://www.yourhomehunter.com.au/request-full-service");
    const withRobots = /name=["']robots["']/i.test(next)
      ? next
      : next.replace(/<head>/i, '<head>\n  <meta name="robots" content="noindex, nofollow">');
    if (withRobots !== html) fs.writeFileSync(file, withRobots, "utf8");
  }
}

function loadPosts() {
  const source = fs.readFileSync(path.join(root, "blog-data.js"), "utf8");
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.YHH_BLOG_POSTS;
}

function moveBlogIndex() {
  const sourcePath = path.join(root, "blog.html");
  const targetPath = path.join(blogDir, "index.html");
  if (!fs.existsSync(sourcePath)) return;
  let html = fs.readFileSync(sourcePath, "utf8");
  html = html.replace("<html lang=\"en\">", "<html lang=\"en-AU\">");
  html = html.replace(
    "<title>The Rental Wrap | Renting Tips, Market Insights &amp; Tenant Guides  -  Your Home Hunter</title>",
    "<title>The Rental Wrap | Renting Tips and Market Guides</title>"
  );
  html = html.replace(
    /<meta name="description" content="[^"]*">/,
    '<meta name="description" content="Renting tips, market updates, and tenant advice for Melbourne, Brisbane, Canberra, and Adelaide.">'
  );
  html = html.replace(
    'href="https://www.yourhomehunter.com.au/blog.html"',
    'href="https://www.yourhomehunter.com.au/the-rental-rap"'
  );
  html = html.replaceAll(
    "https://www.yourhomehunter.com.au/blog.html#post-",
    "https://www.yourhomehunter.com.au/the-rental-rap/"
  );
  html = html.replaceAll(
    "https://www.yourhomehunter.com.au/blog.html",
    "https://www.yourhomehunter.com.au/the-rental-rap"
  );
  html = html.replace(
    'content="The Rental Wrap | Renting Tips &amp; Market Insights  -  Your Home Hunter"',
    'content="The Rental Wrap | Renting Tips and Market Guides"'
  );
  html = html.replace(
    'content="The Rental Wrap | Renting Tips &amp; Insights  -  Your Home Hunter"',
    'content="The Rental Wrap | Renting Tips and Market Guides"'
  );
  html = html.replace(
    'content="Actionable guides, market reports, and tenant advocacy strategies to help you navigate Australia\'s competitive rental market."',
    'content="Renting tips, market updates, and tenant advice for Melbourne, Brisbane, Canberra, and Adelaide."'
  );
  html = html.replace(
    'content="Actionable guides and market advice from Australia\'s premier tenant advocates."',
    'content="Renting tips, market updates, and tenant advice for Melbourne, Brisbane, Canberra, and Adelaide."'
  );
  html = html.replace(
    '<link rel="canonical" href="https://www.yourhomehunter.com.au/the-rental-rap">',
    `<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n  <link rel="canonical" href="https://www.yourhomehunter.com.au/the-rental-rap">`
  );
  html = html.replace(
    /<meta property="og:image" content="[^"]*">/,
    `<meta property="og:image" content="${origin}/images/blog/1789440184849-KYJYUX6BV3-unsplash-image-atN1WzTB3iM.jpg">\n  <meta property="og:image:width" content="1000">\n  <meta property="og:image:height" content="665">\n  <meta property="og:image:alt" content="Why renting feels like a lottery">`
  );
  html = html.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    `<script type="application/ld+json">\n${JSON.stringify(blogIndexSchema(), null, 2).replace(/</g, "\\u003c")}\n  </script>`
  );
  html = html.replace(
    /<button type="button" class="btn btn-primary btn-read-article" data-article-slug="([^"]+)">Read Full Guide<\/button>/g,
    '<a href="/the-rental-rap/$1" class="btn btn-primary">Read full guide</a>'
  );
  html = html.replace(
    /<h3>([^<]+)<\/h3>(\s*<p>[\s\S]*?<\/p>\s*)<button type="button" class="btn btn-outline btn-sm btn-read-article" data-article-slug="([^"]+)" style="margin-top: auto; align-self: flex-start;">Read Full Article<\/button>/g,
    '<h3><a href="/the-rental-rap/$3">$1</a></h3>$2<a href="/the-rental-rap/$3" class="btn btn-outline btn-sm" style="margin-top: auto; align-self: flex-start;">Read full article</a>'
  );
  html = rootify(html);
  html = html.replaceAll('href="/blog.html"', 'href="/the-rental-rap"');
  html = html.replaceAll('href="/index.html"', 'href="/"');
  html = html.replaceAll('href="/diy-guide.html"', 'href="/diy-guide"');
  html = html.replaceAll('href="/request-full-service.html"', 'href="/request-full-service"');
  html = nonBlockingFonts(html);
  fs.writeFileSync(targetPath, html, "utf8");
  fs.unlinkSync(sourcePath);
  const leftover = (html.match(/<button[^>]*btn-read-article/g) || []).length;
  if (leftover) {
    throw new Error(`Blog index still has ${leftover} modal-only article buttons`);
  }
}

function blogIndexSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "The Rental Wrap",
    description: "Renting tips, market updates, and tenant advice from Your Home Hunter.",
    url: `${origin}/the-rental-rap`,
    publisher: {
      "@type": "Organization",
      name: "Your Home Hunter",
      logo: `${origin}/favicon.svg`,
    },
    blogPost: posts.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      description: clip(post.excerpt, 200),
      datePublished: post.publishDate,
      articleSection: post.category,
      url: postUrl(post),
      author: { "@type": "Organization", name: "Your Home Hunter" },
    })),
  };
}

function renderPost(post) {
  const canonical = postUrl(post);
  const image = absoluteAsset(post.assetUrl);
  const description = clip(post.excerpt, 155);
  const body = rewriteBody(post.bodyHtml || `<p>${escapeHtml(post.excerpt)}</p>`, post);
  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description,
    datePublished: post.publishDate,
    articleSection: post.category,
    mainEntityOfPage: canonical,
    url: canonical,
    image,
    author: { "@type": "Organization", name: "Your Home Hunter", url: `${origin}/` },
    publisher: {
      "@type": "Organization",
      name: "Your Home Hunter",
      logo: { "@type": "ImageObject", url: `${origin}/favicon.svg` },
    },
  };
  const title = post.title.length > 48 ? post.title : `${post.title} | The Rental Wrap`;
  return `<!DOCTYPE html>
<html lang="en-AU">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeAttr(description)}">
  <meta name="author" content="Your Home Hunter (YHH Pty Ltd)">
  <meta name="robots" content="index, follow">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="canonical" href="${canonical}">
  <meta property="og:locale" content="en_AU">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeAttr(post.title)}">
  <meta property="og:description" content="${escapeAttr(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:site_name" content="Your Home Hunter">
  <meta property="og:image" content="${image}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeAttr(post.title)}">
  <meta name="twitter:description" content="${escapeAttr(description)}">
  <meta name="twitter:image" content="${image}">
  <script type="application/ld+json">
${JSON.stringify(schema, null, 2).replace(/</g, "\\u003c")}
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&amp;display=swap" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&amp;display=swap"></noscript>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header class="navbar">
    <div class="container nav-container">
      <a href="/" class="brand-lockup" aria-label="Your Home Hunter">
        <svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
          <g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3.2 14.7 15.2 3.8 27.4 14.7"/>
            <path d="M5.5 12.7v13.3h5.6"/>
            <circle class="brand-lens-glass" cx="17.9" cy="19.85" r="6.15"/>
            <path d="m22.01 24.42 2.4 2.65"/>
          </g>
        </svg>
        <span class="brand-text">Your Home Hunter</span>
      </a>
      <nav class="nav-links" id="site-nav">
        <a href="/#services">Services</a>
        <a href="/#coverage">Locations</a>
        <a href="/#about">About</a>
        <a href="/#testimonials">Reviews</a>
        <a href="/#faq">FAQ</a>
        <a href="/the-rental-rap" class="active">Blog</a>
      </nav>
      <div class="nav-actions">
        <a href="tel:1800666944" class="phone-link">1800 666 944</a>
        <button type="button" class="nav-toggle" aria-controls="site-nav" aria-expanded="false" aria-label="Open menu">
          <span class="nav-toggle-bar"></span>
          <span class="nav-toggle-bar"></span>
          <span class="nav-toggle-bar"></span>
        </button>
      </div>
    </div>
  </header>
  <main class="article-page">
    <article class="container">
      <p class="article-kicker"><a href="/the-rental-rap">The Rental Wrap</a></p>
      <p><span class="blog-category-tag" style="position: static;">${escapeHtml(post.category || "Renting Tips")}</span></p>
      <h1>${escapeHtml(post.title)}</h1>
      <p class="blog-meta-date">${escapeHtml(post.displayDate || post.publishDate)}</p>
      ${image ? `<img class="article-hero-img" src="${escapeAttr(rootPath(post.assetUrl))}" alt="${escapeAttr(post.title)}">` : ""}
      <div class="article-reader-body">
        ${body}
      </div>
      <p class="article-back"><a href="/the-rental-rap">All articles</a></p>
    </article>
  </main>
  <script src="/contact-config.js"></script>
  <script defer src="/analytics.js"></script>
  <script src="/dialogs-bundle.js"></script>
  <script src="/script.js"></script>
</body>
</html>
`;
}

function imageKey(url) {
  const file = String(url || "").split("?")[0].split("/").pop().toLowerCase();
  return file
    .replace(/^\d{10,}-[a-z0-9]+-/i, "")
    .replace(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}(?:-[0-9a-f]{12})?-+/i, "")
    .replace(/^-+/, "");
}

function rewriteBody(html, post) {
  const heroKey = imageKey(post.assetUrl);
  let removedHero = false;
  const rewritten = html.replace(/<img\b[^>]*>/gi, (tag) => {
    const chosen = attr(tag, "data-src") || attr(tag, "src");
    if (!removedHero && heroKey && imageKey(chosen) === heroKey) {
      removedHero = true;
      return "";
    }
    let alt = attr(tag, "alt");
    if (!alt || /pretty caucasian woman|scenic shot of the beach/i.test(alt)) alt = post.title;
    const dims = tag.match(/data-image-dimensions="(\d+)x(\d+)"/);
    const size = dims ? ` width="${dims[1]}" height="${dims[2]}"` : "";
    return `<img src="${escapeAttr(rootPath(chosen))}" alt="${escapeAttr(alt)}"${size} loading="lazy" decoding="async">`;
  });
  return stripEmptyImageBlock(rewritten);
}

function stripEmptyImageBlock(html) {
  const marker = html.indexOf("sqs-block-image");
  if (marker < 0) return html;
  const open = html.lastIndexOf("<div", marker);
  if (open < 0) return html;
  const re = /<\/?div\b[^>]*>/gi;
  re.lastIndex = open;
  let depth = 0;
  let match;
  while ((match = re.exec(html))) {
    if (match[0].startsWith("</")) depth -= 1;
    else depth += 1;
    if (depth === 0) {
      const block = html.slice(open, match.index + match[0].length);
      if (!/<img\b/i.test(block)) {
        return html.slice(0, open) + html.slice(match.index + match[0].length);
      }
      return html;
    }
  }
  return html;
}

function renderSitemap(items) {
  const urls = [
    { loc: `${origin}/`, changefreq: "weekly", priority: "1.0" },
    { loc: `${origin}/the-rental-rap`, changefreq: "weekly", priority: "0.9" },
    { loc: `${origin}/diy-guide`, changefreq: "monthly", priority: "0.8" },
    { loc: `${origin}/request-full-service`, changefreq: "monthly", priority: "0.5" },
    ...items.map((post) => ({
      loc: postUrl(post),
      changefreq: "monthly",
      priority: "0.6",
      lastmod: post.publishDate,
    })),
  ];
  const body = urls.map((url) => `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>${url.lastmod ? `\n    <lastmod>${url.lastmod}</lastmod>` : ""}
  </url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function postUrl(post) {
  return `${origin}/the-rental-rap/${post.urlId}`;
}

function absoluteAsset(assetUrl) {
  if (!assetUrl) return `${origin}/images/cities/melbourne.jpg`;
  if (/^https?:/i.test(assetUrl)) return assetUrl;
  return origin + rootPath(assetUrl);
}

function rootPath(url) {
  if (!url) return "";
  if (/^(https?:|data:|\/)/i.test(url)) return url;
  return `/${url.replace(/^\.\//, "")}`;
}

function rootify(html) {
  return html.replace(/(href|src)="(?!https?:|\/|#|mailto:|tel:)([^"]+)"/g, '$1="/$2"');
}

function nonBlockingFonts(html) {
  return html.replace(/<link href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)" rel="stylesheet">/g,
    '<link rel="preload" as="style" href="$1" onload="this.onload=null;this.rel=\'stylesheet\'">\n  <noscript><link rel="stylesheet" href="$1"></noscript>');
}

function clip(text, max) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > 60 ? cut.slice(0, space) : cut).replace(/[.,;:\s]+$/, "")}...`;
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"));
  return match ? match[2] : "";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function escapeXml(value) {
  return escapeHtml(value);
}
