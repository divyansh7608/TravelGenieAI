import Link from 'next/link'

interface HomePageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams
  const hasError = params.error === 'auth'

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="w-full max-w-sm px-6 text-center space-y-8">
        {/* Logo / Heading */}
        <div className="space-y-3">
          <h1 className="text-5xl font-extrabold tracking-tight text-gray-900">
            TravelGenieAI
          </h1>
          <p className="text-lg text-gray-500">Plan your perfect trip with AI</p>
        </div>

        {/* Error message */}
        {hasError && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            Authentication failed. Please try again.
          </p>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <Link
            href="/auth"
            className="block w-full px-6 py-3 rounded-lg border border-transparent bg-gray-900 text-white font-medium hover:bg-gray-800 transition-colors duration-200"
          >
            Get Started
          </Link>

          <Link
            href="/plan"
            className="block w-full px-6 py-3 rounded-lg border border-gray-200 bg-gray-50 text-gray-600 font-medium hover:bg-gray-100 hover:border-gray-300 transition-colors duration-200"
          >
            Continue as guest
          </Link>
        </div>

        <p className="text-xs text-gray-400">
          By continuing you agree to our Terms of Service.
        </p>
      </div>
    </div>
  )
}
