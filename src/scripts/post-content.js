// Fetches a built post article and splits it into reading checkpoints by <h2>.
// The article at /posts/<slug>/ is the canonical source of truth; the journey
// re-presents its already-rendered HTML (prose, code, images) section by section.

const cache = new Map();

const sectionsFromDoc = (doc, fallbackTitle) => {
  const body = doc.querySelector(".post-content");
  if (!body) return null;

  const sections = [];
  let current = { heading: fallbackTitle, kicker: "Transmission Start", html: "" };

  const pushCurrent = () => {
    if (current.html.trim().length) {
      sections.push({ heading: current.heading, kicker: current.kicker, html: current.html });
    }
  };

  for (const node of Array.from(body.childNodes)) {
    if (node.nodeType === 1 && node.tagName === "H2") {
      pushCurrent();
      current = { heading: (node.textContent || "Section").trim() || "Section", kicker: "Checkpoint", html: "" };
      continue;
    }
    current.html += node.nodeType === 1 ? node.outerHTML : (node.textContent || "");
  }
  pushCurrent();

  if (!sections.length) {
    sections.push({ heading: fallbackTitle, kicker: "Transmission", html: body.innerHTML });
  }
  return sections;
};

export const fetchPostSections = async (slug) => {
  if (cache.has(slug)) return cache.get(slug);
  try {
    const res = await fetch(`/posts/${slug}/`, { credentials: "same-origin" });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const title = (doc.querySelector(".post-page h1") || doc.querySelector("h1"))?.textContent?.trim() || slug;
    const meta = doc.querySelector(".entry-meta")?.textContent?.trim() || "";
    const sections = sectionsFromDoc(doc, title);
    if (!sections) return { ok: false, error: "no .post-content" };
    const result = { ok: true, title, meta, sections };
    cache.set(slug, result); // cache only successful results so failures can retry
    return result;
  } catch (error) {
    return { ok: false, error: String((error && error.message) || error) };
  }
};
