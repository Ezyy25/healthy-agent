import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { MealScheduleProvider } from "@/context/MealScheduleContext";
import { MealToasts } from "@/components/MealToasts";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Healthy Agent",
  description: "Asisten kesehatan pribadi bertenaga AI",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${spaceGrotesk.variable} ${inter.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink font-sans antialiased app-shell">
        <AuthProvider>
          <MealScheduleProvider>
            {children}
            <MealToasts />
          </MealScheduleProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
