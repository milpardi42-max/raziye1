import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Regression guard for the "A tree hydrated but some attributes of the server
 * rendered HTML didn't match the client properties" error that /admin/* used to
 * throw: a nested layout rendered its own <html>/<head>/<body> inside the root
 * layout's document. Browsers silently re-parse such a stream, so the DOM React
 * hydrates into no longer matches the tree it rendered on the server.
 *
 * Next.js documents exactly one root layout (src/app/layout.tsx) that owns the
 * document; app/global-error.tsx is the single sanctioned exception, because it
 * replaces the root layout when the root itself throws.
 */

const root = process.cwd();
const ROOT_LAYOUT = path.join("src", "app", "layout.tsx");
const DOCUMENT_TAG = /<(html|head|body)(?=[\s>])/;

/** Comments in these files legitimately talk about <head>/<body>. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

test("only the root layout renders the document tags", () => {
  const layouts = walk(path.join(root, "src", "app")).filter((file) => /(^|\/)layout\.tsx$/.test(file));
  assert.ok(layouts.includes(path.join(root, ROOT_LAYOUT)), "src/app/layout.tsx must exist");

  for (const file of layouts) {
    const source = stripComments(fs.readFileSync(file, "utf8"));
    const relative = path.relative(root, file).split(path.sep).join("/");

    if (relative === "src/app/layout.tsx") {
      assert.match(source, /<html[\s>]/, "the root layout must render <html>");
      assert.match(source, /<head[\s>]/, "the root layout must render the single <head>");
      assert.match(source, /<body[\s>]/, "the root layout must render <body>");
      continue;
    }

    const nested = source.match(DOCUMENT_TAG);
    assert.equal(
      nested,
      null,
      `${relative} renders <${nested?.[1]}> — nesting a document inside the root layout breaks hydration; ` +
        `pass the locale/section through request headers instead (see src/middleware.ts)`,
    );
  }
});

test("the root layout derives lang/dir from the request and owns the head", () => {
  const source = stripComments(fs.readFileSync(path.join(root, ROOT_LAYOUT), "utf8"));
  assert.match(source, /await headers\(\)/, "the root layout must read the request headers");
  assert.match(source, /x-ra-locale/, "the root layout must read the locale hint");
  assert.match(source, /x-ra-section/, "the root layout must read the section hint");
  assert.match(source, /lang=\{documentLocale\}/, "lang must follow the resolved locale");
  assert.match(source, /dir=\{dirOf\(documentLocale\)\}/, "dir must follow the resolved locale");
  assert.match(source, /ra-theme/, "the theme bootstrap script belongs in the single head");
  assert.match(source, /IRANSansWeb\.woff2/, "the head preloads the fa font");
  assert.match(source, /instrument-serif-latin-400-normal\.woff2/, "the head preloads the en font");
  assert.equal(
    source.match(/dangerouslySetInnerHTML/g)?.length,
    1,
    "the theme bootstrap script must be defined once, in the root layout",
  );
});

test("middleware forwards locale and admin section to the root layout", () => {
  const source = stripComments(fs.readFileSync(path.join(root, "src", "middleware.ts"), "utf8"));
  assert.match(source, /requestHeaders\.set\("x-ra-locale"/);
  assert.match(source, /requestHeaders\.set\("x-ra-section"/);
  assert.match(source, /NextResponse\.next\(\{ request: \{ headers: requestHeaders \} \}\)/);
  assert.equal(
    source.match(/NextResponse\.next\(\)/g),
    null,
    "every rendered response must carry the document hints — return nextWithDocumentHints() instead of NextResponse.next()",
  );
});
