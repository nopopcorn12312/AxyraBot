import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SeoLandingPage from "../components/SeoLandingPage";
import { seoLandingPages, siteUrl } from "../seo-content";

type PageProps = {
  params: Promise<{ seoPage: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(seoLandingPages).map((seoPage) => ({ seoPage }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { seoPage } = await params;
  const page = seoLandingPages[seoPage];
  if (!page) return {};

  const canonical = `${siteUrl}/${page.slug}`;
  const image = `${siteUrl}/AxyraBotDashboard.png`;

  return {
    title: page.title,
    description: page.description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: "AxyraBot",
      title: page.title,
      description: page.description,
      images: [{ url: image, alt: "AxyraBot moderation dashboard" }],
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
      images: [image],
    },
  };
}

export default async function SeoPage({ params }: PageProps) {
  const { seoPage } = await params;
  const page = seoLandingPages[seoPage];
  if (!page) notFound();

  return <SeoLandingPage page={page} />;
}