import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppProviders } from "@/components/providers/AppProviders";
import { LOCALES, type Locale } from "@/lib/i18n/types";

export const metadata: Metadata = {
  robots: { index: false },
};

/**
 * Admin section layout.
 *
 * It deliberately renders no <html>, <head> or <body>: the root layout
 * (src/app/layout.tsx) owns the single document, and the admin shell's rtl
 * direction, background and theme bootstrap script are applied there for
 * section="admin". Nesting a second document here was what produced
 * "A tree hydrated but some attributes ... didn't match" on /admin/*.
 */
export default async function AdminLocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!LOCALES.includes(raw as Locale)) notFound();
  const locale = raw as Locale;

  return <AppProviders locale={locale}>{children}</AppProviders>;
}
