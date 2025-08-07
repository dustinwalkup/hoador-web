import { Skeleton } from "@/components/ui/skeleton";

export function MailboxSkeleton() {
  return (
    <div className="flex h-screen bg-white">
      {/* Desktop Layout */}
      <div className="hidden w-full md:flex">
        {/* Left Sidebar - Conversations */}
        <div className="flex w-80 flex-col border-r border-gray-200">
          {/* Search */}
          <div className="p-4">
            <Skeleton className="h-10 w-full" />
          </div>

          {/* Tabs */}
          <div className="mb-4 px-4">
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center border-l-4 border-transparent p-4">
                <Skeleton className="mr-3 h-10 w-10 rounded-full" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                  <Skeleton className="mt-1 h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side - Chat */}
        <div className="flex flex-1 flex-col">
          {/* Chat Header */}
          <div className="flex items-center justify-between border-b border-gray-200 p-4">
            <div className="flex items-center">
              <Skeleton className="mr-3 h-10 w-10 rounded-full" />
              <div>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="mt-1 h-3 w-24" />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}
              >
                <div className="max-w-xs lg:max-w-md">
                  <Skeleton className="h-12 w-48 rounded-2xl" />
                  <Skeleton className="mt-1 h-3 w-16 ml-auto" />
                </div>
              </div>
            ))}
          </div>

          {/* Message Input */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center space-x-2">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="flex-1 h-10" />
              <Skeleton className="h-10 w-10 rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="w-full md:hidden">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-b border-gray-200 p-4">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="mt-1 h-3 w-48" />
          </div>

          {/* Search */}
          <div className="p-4">
            <Skeleton className="h-10 w-full" />
          </div>

          {/* Tabs */}
          <div className="mb-4 px-4">
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center border-b border-gray-100 p-4">
                <Skeleton className="mr-3 h-12 w-12 rounded-full" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="mt-1 h-3 w-36" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 