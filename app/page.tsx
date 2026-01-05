import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-teal-700">
            Elite Advantage Tax Group
          </h1>
          <span className="text-sm text-gray-500">
            Secure Client Portal
          </span>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 py-16 text-center">
        <h2 className="text-4xl font-bold mb-4">
          Welcome to Your Client Portal
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto mb-8">
          Upload documents securely, track your tax preparation progress,
          and communicate with your tax professional — all in one place.
        </p>

        {/* Action Buttons */}
        <div className="flex justify-center gap-6">
          <Link
            href="/login"
            className="px-8 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition"
          >
            Client Login
          </Link>

          <Link
            href="/intake"
            className="px-8 py-3 bg-white border border-teal-600 text-teal-700 rounded-lg hover:bg-teal-50 transition"
          >
            New Client Intake
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-6 grid gap-8 md:grid-cols-3">
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">
              Secure Document Upload
            </h3>
            <p className="text-gray-600">
              Safely upload W-2s, 1099s, receipts, and other tax documents
              through encrypted channels.
            </p>
          </div>

          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">
              Real-Time Status Updates
            </h3>
            <p className="text-gray-600">
              Track the progress of your return and know exactly what
              stage your filing is in.
            </p>
          </div>

          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">
              Direct Communication
            </h3>
            <p className="text-gray-600">
              Message your assigned tax professional without emails
              or phone tag.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-100 py-6 mt-16">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} Elite Advantage Tax Group. All rights reserved.
        </div>
      </footer>
    </main>
  );
}
