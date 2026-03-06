import type { Metadata } from "next"
import "./globals.css"
import Header from "@/components/layout/Header"

export const metadata: Metadata = {
  title: "박교준 수리논술",
  description: "19년간 국내 최고 합격률 - 박교준 수리논술",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body>
        <Header />
        {children}
      </body>
    </html>
  )
}
