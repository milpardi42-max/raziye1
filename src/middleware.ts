import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/i18n/types";
import { readSessionToken, SESSION_COOKIE } from "@/lib/session";

function isOwnerEmail(email: string): boolean {
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!ownerEmail) return false;
  return email.toLowerCase() === ownerEmail;
}

/**
 * Hand the resolved locale/section to the one root layout.
 *
 * src/app/layout.tsx renders the document (<html lang dir>, <head>, <body>) and
 * therefore sets the direction and section styling for every route — but a root
 * layout sits above the [locale] segment and never receives its params. These
 * request headers bridge that gap (there is no other supported way to read the
 * active pathname from a root layout).
 */
function nextWithDocumentHints(
  req: NextRequest,
  hints: { locale?: string; section?: "admin" },
): NextResponse {
  const requestHeaders = new Headers(req.headers);
  if (hints.locale) requestHeaders.set("x-ra-locale", hints.locale);
  if (hints.section) requestHeaders.set("x-ra-section", hints.section);
  else requestHeaders.delete("x-ra-section");
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  /* -------- مسیرهای پنل ادمین (/admin/[locale]/) -------- */
  // این مسیرها از layout سایت جدا هستند
  const adminMatch = pathname.match(/^\/admin\/([^/]+)(\/.*)?$/);
  if (adminMatch) {
    const locale = adminMatch[1];
    const hints = { locale, section: "admin" as const };
    const rest = adminMatch[2] ?? "";

    // صفحه لاگین ادمین نیازی به بررسی نشست ندارد
    if (rest === "/login" || rest === "/login/") return nextWithDocumentHints(req, hints);

    // بقیه مسیرهای ادمین نیاز به نقش admin دارند
    const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
    const session = await readSessionToken(sessionToken);
    if (!session || session.role !== "admin") {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = `/admin/${locale}/login`;
      return NextResponse.redirect(loginUrl);
    }
    return nextWithDocumentHints(req, hints);
  }

  /* -------- i18n locale prefix (برای مسیرهای سایت اصلی) -------- */
  const hasLocale = LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  if (!hasLocale) {
    const cookie = req.cookies.get("ra-locale")?.value;
    const locale = LOCALES.includes(cookie as never) ? cookie : DEFAULT_LOCALE;
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  /* -------- Protected routes (سایت اصلی) -------- */
  const segments = pathname.split("/").filter(Boolean);
  const locale = segments[0];
  const rest = segments.slice(1).join("/");
  const hints = { locale };

  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await readSessionToken(sessionToken);

  /*
   * /[locale]/artist — the seller area.
   *
   * Signed-out visitors go to the login page. A signed-in *buyer* is let
   * through on purpose: both /artist and /artist/marketplace explain that the
   * area is for artists and point at the designer registration, which is far
   * friendlier than a login form for an account that cannot open it. The
   * artist APIs keep enforcing the role themselves.
   */
  if (rest === "artist" || rest.startsWith("artist/")) {
    if (!session) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = `/${segments[0]}/login`;
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // /[locale]/owner/* — requires owner email or admin role
  if (rest === "owner" || rest.startsWith("owner/")) {
    const isOwnerSession =
      session && (session.role === "admin" || isOwnerEmail(session.email));
    if (!isOwnerSession) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = `/${segments[0]}/login`;
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return nextWithDocumentHints(req, hints);
}

export const config = {
  matcher: ["/((?!api|_next|fonts|images|favicon.ico|.*\\..*).*)"],
};
