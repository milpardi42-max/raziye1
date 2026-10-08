import type { Metadata } from "next";
import "../globals.css";
import { notFound } from "next/navigation";
import { AppProviders } from "@/components/providers/AppProviders";
import { Fragment } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { LiveChatWidget } from "@/components/layout/LiveChatWidget";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { SearchPalette } from "@/components/layout/SearchPalette";
import { LocaleChrome } from "@/components/layout/LocaleChrome";
import { AnnouncementBarServer } from "@/components/layout/AnnouncementBarServer";
import { getNavData } from "@/lib/data/nav";
import { LOCALES, type Locale } from "@/lib/i18n/types";
import { dictionaries } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const d = dictionaries[(locale as Locale) ?? "fa"];
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  return {
    title: { default: d?.brand ?? "Rosie Atelier", template: `%s · Rosie Atelier` },
    description: d?.tagline,
    metadataBase: site ? new URL(site) : undefined,
    openGraph: {
      type: "website",
      siteName: d?.brand ?? "Rosie Atelier",
      title: d?.brand,
      description: d?.tagline,
      locale: locale === "fa" ? "fa_IR" : "en_US",
      images: [{ url: "/images/hero/hero-main.jpg", width: 1200, height: 675, alt: d?.tagline ?? "Rosie Atelier" }],
    },
    twitter: {
      card: "summary_large_image",
      title: d?.brand,
      description: d?.tagline,
      images: ["/images/hero/hero-main.jpg"],
    },
    alternates: { canonical: `/${locale}` },
  };
}


/**
 * This layout renders no <head>: the theme bootstrap script and the font
 * preloads now live in the single document head owned by src/app/layout.tsx,
 * which picks the right locale (and therefore the right fonts) from the
 * `x-ra-locale` request header set in src/middleware.ts.
 */
export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!LOCALES.includes(raw as Locale)) notFound();
  const locale = raw as Locale;
  const nav = await getNavData();

  return (
    <>
      <AppProviders locale={locale}>
        <LocaleChrome
          before={
            <Fragment key="before">
              <a key="skip-link" href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-[100] focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-background">Skip to content</a>
              <AnnouncementBarServer key="announcement" locale={locale} />
              <Header key="header" nav={nav} />
              <CartDrawer key="cart-drawer" />
              <SearchPalette key="search-palette" />
            </Fragment>
          }
          after={<Footer key="footer" />}
        >
          {children}
        </LocaleChrome>
        <LiveChatWidget />
      </AppProviders>
    </>
  );
}
