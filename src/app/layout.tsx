import type { Metadata } from "next";
import { Montserrat, Raleway } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

const raleway = Raleway({
  variable: "--font-raleway",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Challenge host",
  description: "A single-shot qualifier for agent challenges.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${raleway.variable} dark h-full antialiased`}
    >
      <body className={`${raleway.className} flex h-full flex-col overflow-hidden`}>{children}</body>
    </html>
  );
}
