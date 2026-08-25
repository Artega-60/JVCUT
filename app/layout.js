const SITE_URL = "https://jvcut.com";
const SITE_NAME = "JvCut";
const SITE_TITLE = "JvCut — Toute l'actu, en un éclair";
const SITE_DESCRIPTION =
  "L'actu jeux vidéo condensée en une phrase. Sorties, patchs, rumeurs et bons plans, sans blabla.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s — JvCut",
  },
  description: SITE_DESCRIPTION,
  keywords: ["jeux vidéo", "actu jeux vidéo", "news gaming", "JvCut", "sorties jeux vidéo"],
  applicationName: SITE_NAME,
  authors: [{ name: "JvCut" }],
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "JvCut — Toute l'actu, en un éclair",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,500;0,600;0,700;0,800;1,700;1,800&family=Rajdhani:wght@600;700&display=swap"
        />
      </head>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
