#!/usr/bin/env node
/**
 * Runtime guard for the document structure of the server-rendered pages.
 *
 * A nested layout that renders its own <html>/<head>/<body> produces two
 * documents in one HTML stream. Browsers silently re-parse that, and React then
 * fails hydration with "A tree hydrated but some attributes of the server
 * rendered HTML didn't match the client properties" — a failure no typecheck,
 * lint or production build reports. This script re-reads the served HTML the way
 * a browser parser does and fails loudly instead.
 *
 * Usage:
 *   npm run check:document                    # against http://localhost:3000
 *   SMOKE_ORIGIN=https://example.com npm run check:document
 *   CHECK_ROUTES=/fa,/en,/admin/fa/login npm run check:document
 *
 * No new files, build step or running browser are required.
 */

const origin = process.env.SMOKE_ORIGIN ?? "http://localhost:3000";
const routes = (process.env.CHECK_ROUTES ?? "/fa,/en,/admin/fa/login,/fa/shop,/fa/portfolio,/fa/login,/fa/artists")
  .split(",")
  .map((route) => route.trim())
  .filter(Boolean);

/** Counts the tags a browser treats as the document skeleton. */
function countDocumentTags(markup) {
  const count = (tag) => (markup.match(new RegExp(`<${tag}(?=[\\s>])`, "gi")) ?? []).length;
  return { html: count("html"), head: count("head"), body: count("body") };
}

function inspect(pathname, html) {
  const problems = [];

  // Inline <script> payloads (the RSC flight data) are not markup; ignore their
  // contents so serialized strings can never be mistaken for real elements.
  const markup = html.replace(/<script\b[\s\S]*?<\/script>/gi, "<script></script>");

  const tags = countDocumentTags(markup);
  if (tags.html !== 1) problems.push(`${tags.html} <html> elements`);
  if (tags.head !== 1) problems.push(`${tags.head} <head> elements`);
  if (tags.body !== 1) problems.push(`${tags.body} <body> elements`);

  const bodyAt = markup.search(/<body(?=[\s>])/i);
  const headEndsAt = markup.search(/<\/head>/i);
  if (bodyAt === -1) {
    problems.push("no <body>");
  } else {
    if (headEndsAt === -1 || headEndsAt > bodyAt) problems.push("<head> does not close before <body>");
    if (/<(html|head|body)(?=[\s>])/i.test(markup.slice(bodyAt + 1))) {
      problems.push("a document tag is nested inside <body>");
    }
  }

  const htmlOpen = markup.match(/<html[^>]*>/i)?.[0] ?? "<html> missing";
  const bodyOpen = markup.match(/<body[^>]*>/i)?.[0] ?? "<body> missing";
  if (!/lang="[a-z]{2}"/i.test(htmlOpen)) problems.push("no lang attribute on <html>");
  if (!/dir="(rtl|ltr)"/i.test(htmlOpen)) problems.push("no dir attribute on <html>");

  // The theme bootstrap lives inside an inline <script>, so it is only present
  // in the raw HTML — and its offsets differ from the stripped markup. Measure
  // the head boundary in the raw HTML for this check.
  const rawHeadEndsAt = html.search(/<\/head>/i);
  const themeScriptInHead = rawHeadEndsAt !== -1 && /ra-theme/.test(html.slice(0, rawHeadEndsAt));

  return { problems, htmlOpen, bodyOpen, themeScriptInHead };
}

let failed = false;
for (const route of routes) {
  try {
    const response = await fetch(new URL(route, origin), { signal: AbortSignal.timeout(120_000) });
    const html = await response.text();
    const { problems, htmlOpen, bodyOpen, themeScriptInHead } = inspect(route, html);
    if (!themeScriptInHead) problems.push("theme bootstrap script missing from <head>");
    if (problems.length) failed = true;
    console.log(
      `${problems.length ? "FAIL" : "PASS"} ${route}: HTTP ${response.status} · ${htmlOpen} · ${bodyOpen}` +
        (problems.length ? `\n      ${problems.join("; ")}` : ""),
    );
  } catch (error) {
    failed = true;
    console.error(`FAIL ${route}: ${error.message}`);
  }
}

if (failed) {
  console.error(
    "\nDocument structure check failed. The root layout (src/app/layout.tsx) must be the only place " +
      "rendering <html>/<head>/<body>; nested layouts get the locale/section from request headers.",
  );
  process.exitCode = 1;
} else {
  console.log("\nEvery checked route serves exactly one <html>, <head> and <body> — hydration-safe structure.");
}
