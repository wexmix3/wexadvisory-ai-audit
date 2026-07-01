import type { Metadata } from "next";
import { Geist, Geist_Mono, DM_Serif_Display } from "next/font/google";
import AuditNav from "@/components/AuditNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const dmSerif = DM_Serif_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Free AI Readiness Audit Tool — Wex Advisory",
  description:
    "Run a free AI readiness audit in minutes. Get savings estimates, maturity scores, and a prioritized roadmap tailored to your business. No credit card needed.",
  alternates: {
    canonical: "https://audit.wexadvisory.com",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const jsonLdTool = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Wex AI Readiness Audit Tool",
  applicationCategory: "BusinessApplication",
  description:
    "A free AI readiness audit tool that analyzes your business website and delivers a quantified savings report with maturity scores, automation opportunities, and a phased implementation roadmap.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  operatingSystem: "Web",
  url: "https://audit.wexadvisory.com",
  provider: {
    "@type": "Organization",
    name: "Wex Advisory",
    url: "https://www.wexadvisory.com",
  },
};

const jsonLdFaq = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is an AI readiness audit?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "An AI readiness audit evaluates your business operations across five dimensions — AI Readiness, Automation Opportunity, Data Visibility, Revenue Acceleration, and Overall Maturity — and identifies the highest-ROI opportunities for AI adoption with specific tool recommendations and savings estimates.",
      },
    },
    {
      "@type": "Question",
      name: "How does the AI audit tool work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You submit your business website URL. The tool uses Claude AI, Firecrawl, and DataForSEO to analyze your site, job postings, and industry data, then generates a quantified savings report delivered to your inbox.",
      },
    },
    {
      "@type": "Question",
      name: "Is the AI audit tool free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. The Wex AI Snapshot is completely free with no credit card required.",
      },
    },
    {
      "@type": "Question",
      name: "What industries does the audit cover?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The tool covers Professional Services, SaaS, Real Estate, Healthcare, E-Commerce, Marketing, Legal, Finance, Construction, Hospitality, Manufacturing, and more.",
      },
    },
    {
      "@type": "Question",
      name: "What does the AI readiness report include?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Your report includes five AI maturity scores, automation opportunities ranked by estimated annual savings, labor cost math for each opportunity, specific tool recommendations with pricing, and a Phase 1/2/3 implementation roadmap.",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${dmSerif.variable} h-full antialiased`}
    >
      <head>
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://audit.wexadvisory.com" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdTool) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <AuditNav />
        <div className="pt-[52px] flex flex-col flex-1">{children}</div>
      </body>
    </html>
  );
}
