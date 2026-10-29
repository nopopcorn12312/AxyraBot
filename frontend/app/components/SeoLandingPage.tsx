import Image from "next/image";
import dashboardImage from "../../public/AxyraBotDashboard.png";
import type { SeoLandingPage as SeoLandingPageData } from "../seo-content";

const backendUrl = (
  process.env.NEXT_PUBLIC_BACKEND_URL || "https://axyrabot.onrender.com"
).replace(/\/$/, "");
const installUrl = `${backendUrl}/auth/start?redirect=${encodeURIComponent("https://axyrabot.com")}`;

export default function SeoLandingPage({ page }: { page: SeoLandingPageData }) {
  const softwareApplicationSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "AxyraBot",
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web",
    url: `https://axyrabot.com/${page.slug}`,
    description: page.description,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  return (
    <main className="min-h-screen bg-ax-bg px-5 text-ax-body sm:px-8">
      <article className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between border-b border-ax-subtle py-5">
          <a href="/" className="inline-flex items-center gap-3" aria-label="AxyraBot home">
            <Image src="/AxyraBotPFP.png" alt="" width={36} height={36} priority />
            <span className="text-lg font-bold text-ax-heading">AxyraBot</span>
          </a>
          <span className="hidden text-xs font-medium text-ax-muted sm:inline">
            Free tools for Twitch and Discord
          </span>
        </header>

        <section className="grid items-center gap-12 border-b border-ax-subtle py-14 md:grid-cols-[1.1fr_0.9fr] md:py-20">
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-ax-accent-text">
              {page.eyebrow}
            </p>
            <h1 className="max-w-3xl text-4xl font-black leading-tight text-ax-heading sm:text-5xl">
              {page.h1}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-ax-secondary">
              {page.intro}
            </p>
            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <a
                href={installUrl}
                className="inline-flex min-h-12 items-center justify-center rounded-md bg-accent px-6 py-3 text-sm font-bold text-ax-btn-text transition hover:bg-ax-btn-hover"
              >
                Add AxyraBot
              </a>
              <a
                href="#features"
                className="inline-flex min-h-12 items-center px-2 text-sm font-semibold text-ax-secondary underline decoration-ax-border underline-offset-4 transition hover:text-ax-heading"
              >
                Explore what it does
              </a>
            </div>
            <p className="mt-3 text-xs leading-5 text-ax-muted">
              Connect Twitch to begin; add AxyraBot to Discord from your setup when you need it.
            </p>
          </div>

          <figure className="relative mx-auto w-full max-w-xl">
            <div className="absolute -inset-3 rounded-md bg-accent/10 blur-2xl" aria-hidden="true" />
            <div className="relative overflow-hidden rounded-md border border-ax-border bg-ax-section shadow-2xl ">
              <Image
                src={dashboardImage}
                alt="AxyraBot dashboard for managing community tools"
                className="h-auto w-full"
                priority
                sizes="(max-width: 768px) 100vw, 45vw"
              />
            </div>
            <figcaption className="mt-3 text-center text-xs text-ax-muted">
              Configure AxyraBot from its web dashboard.
            </figcaption>
          </figure>
        </section>

        <div id="features" className="grid gap-0 md:grid-cols-[minmax(0,1fr)_17rem] md:gap-16">
          <div>
            {page.sections.map((section, index) => (
              <section
                key={section.heading}
                className="border-b border-ax-subtle py-10 sm:py-12"
              >
                <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.08em]st text-ax-accent-text">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h2 className="text-2xl font-bold leading-snug text-ax-heading sm:text-3xl">
                  {section.heading}
                </h2>
                <div className="mt-5 max-w-3xl space-y-4 text-sm leading-7 text-ax-secondary sm:text-base">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
                {section.points && (
                  <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                    {section.points.map((point) => (
                      <li
                        key={point}
                        className="flex items-start gap-3 text-sm leading-6 text-ax-secondary"
                      >
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                        {point}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <aside className="py-10 md:py-12">
            <div className="border-y border-ax-subtle py-5 md:sticky md:top-8 md:border-t-0">
              <h2 className="text-sm font-bold uppercase tracking-wider text-ax-secondary">
                Explore related pages
              </h2>
              <ul className="mt-4 divide-y divide-ax-subtle">
                {page.related.map((link) => (
                  <li key={link.href} className="py-4">
                    <a
                      href={link.href}
                      className="font-semibold text-ax-accent-text underline decoration-accent/30 underline-offset-4 hover:text-ax-accent-text"
                    >
                      {link.label}
                    </a>
                    <p className="mt-1 text-sm leading-6 text-ax-secondary">{link.context}</p>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>

        <section className="flex flex-col items-start justify-between gap-6 border-t border-ax-subtle py-10 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-bold text-ax-heading">Bring your community tools together.</h2>
            <p className="mt-2 text-sm text-ax-secondary">AxyraBot is free to use on Twitch and Discord.</p>
          </div>
          <a
            href={installUrl}
            className="inline-flex min-h-12 items-center justify-center rounded-md border border-accent/50 bg-accent/10 px-6 py-3 text-sm font-bold text-ax-heading transition hover:bg-accent/20"
          >
            Add AxyraBot
          </a>
        </section>
      </article>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplicationSchema).replace(/</g, "\\u003c"),
        }}
      />
    </main>
  );
}