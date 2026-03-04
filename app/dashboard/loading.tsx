export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-white">
      {/* Скелетон шапки — как в layout */}
      <div className="fixed top-0 left-0 right-0 bg-white shadow-sm border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="h-9 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Скелетон основного контента */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24 pb-10">
        <div className="space-y-6">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
            <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
          </div>
          <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-40 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      </main>

      {/* Скелетон нижней навигации */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 flex justify-around items-center px-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 w-12 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
    </div>
  )
}
