import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "박교준 수리논술 - 수학 1등급의 비밀",
  description: "박교준 수리논술 - 대치동 최고의 수학 교육. 98% 합격률, 평균 3.7등급 상승. 수능 수학, 수리논술 전문",
  keywords: "수능수학, 수리논술, 박교준, 대치동학원, 수학1등급, 의대수학",
  openGraph: {
    title: "박교준 수리논술",
    description: "6등급도 1등급 만드는 박교준 수리논술",
    type: "website",
    locale: "ko_KR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <Header />
        <div style={{ paddingTop: '115px' }}>
          {children}
        </div>
        <Footer />
      </body>
    </html>
  );
}
