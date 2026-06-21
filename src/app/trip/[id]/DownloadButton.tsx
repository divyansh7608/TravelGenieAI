'use client'

import type { ItineraryShape } from '@/lib/agent/orchestrator'
import { downloadItineraryAsDocx } from '@/lib/export/docx'

interface Props {
  itinerary: ItineraryShape
  destination: string
}

export default function DownloadButton({ itinerary, destination }: Props) {
  const handleClick = async () => {
    await downloadItineraryAsDocx(itinerary, destination)
  }

  return (
    <button
      onClick={handleClick}
      className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--bg-secondary)] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      ⬇️ Download Word
    </button>
  )
}
