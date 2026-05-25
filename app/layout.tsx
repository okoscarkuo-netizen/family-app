import type { Metadata, Viewport } from "next";
import { Noto_Sans_TC } from "next/font/google";
import { PwaRegister } from "@/app/pwa-register";
import "./globals.css";

const appFont = Noto_Sans_TC({
  variable: "--font-app-sans",
  display: "swap",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  applicationName: "家庭中控",
  title: {
    default: "家庭中控",
    template: "%s | 家庭中控",
  },
  description: "Oscar 與 Livia 的家庭個人管理、記帳、待辦、帳單提醒與保養提醒 PWA。",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "家庭中控",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#faf7f0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-Hant"
      className={`${appFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
