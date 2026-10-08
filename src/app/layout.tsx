import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { DEFAULT_LOCALE, LOCALES, dirOf, type Locale } from "@/lib/i18n/types";

export const metadata: Metadata = {
  title: "Rosie Atelier",
  description: "Pattern, design, creativity and lifestyle.",
};

/**
 * Runs before first paint so a saved dark theme never flashes light.
 * It lives in the single document <head> rendered below — one definition for the
 * whole app instead of one per nested layout.
 */
const themeScript = `(function(){try{var t=localStorage.getItem('ra-theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();`;

/** Preload only the fonts the active locale renders first. */
function fontPreloads(locale: Locale) {
  if (locale === "fa") {
    return (
      <>
        <link rel="preload" href="/fonts/iransanse-web/IRANSansWeb.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/lalezar/Lalezar-arabic.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </>
    );
  }
  return (
    <link
      rel="preload"
      href="/fonts/instrument-serif/instrument-serif-latin-400-normal.woff2"
      as="font"
      type="font/woff2"
      crossOrigin="anonymous"
    />
  );
}

/**
 * The one and only root layout — the only place in the app that may render
 * <html>, <head> or <body>. Nesting those tags in a child layout produces two
 * documents in one HTML stream, which browsers silently re-parse and React then
 * reports as a hydration mismatch. See tests/document-structure.test.mjs.
 *
 * A root layout sits above the [locale] dynamic segment, so Next never hands it
 * the `locale` param. Middleware forwards the resolved locale and section as
 * request headers instead (see src/middleware.ts), which keeps `lang`/`dir`
 * correct in the server-rendered HTML for both locales.
 */
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();

  const requested = requestHeaders.get("x-ra-locale");
  const locale: Locale = LOCALES.includes(requested as Locale) ? (requested as Locale) : DEFAULT_LOCALE;
  const isAdmin = requestHeaders.get("x-ra-section") === "admin";
  // The admin panel is Persian-only, exactly as before: it always renders rtl.
  const documentLocale: Locale = isAdmin ? DEFAULT_LOCALE : locale;

  return (
    <html lang={documentLocale} dir={dirOf(documentLocale)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {fontPreloads(documentLocale)}
      </head>
      <body
        className={isAdmin ? "min-h-dvh bg-[#f0f2f5]" : "min-h-dvh flex flex-col"}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
