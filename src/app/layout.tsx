import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import { ThemeProvider } from '@/components/ThemeProvider'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'TravelGenieAI - AI Travel Planner',
  description:
    'Generate complete AI-powered travel itineraries with budgets, weather insights and personalized recommendations.',
  keywords: [
    'AI travel planner',
    'trip itinerary generator',
    'travel planning',
    'Gemini AI',
    'vacation planner',
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="antialiased">
        <ThemeProvider>
          <Navbar />
          <main className="min-h-screen pt-14">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  )
}
