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
      className="w-full px-6 py-3 rounded-lg border border-gray-200 bg-white text-gray-700 font-medium hover:bg-gray-50 transition-colors"
    >
      Download as Word
    </button>
  )
}
