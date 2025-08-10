"use client";

interface MailboxTabsProps {
  activeTab: "inbox" | "archived";
  onTabChange: (tab: "inbox" | "archived") => void;
}

export function MailboxTabs({ activeTab, onTabChange }: MailboxTabsProps) {
  return (
    <div className="mb-4 px-4">
      <div className="flex rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => onTabChange("inbox")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "inbox"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Inbox
        </button>
        <button
          onClick={() => onTabChange("archived")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "archived"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Archived
        </button>
      </div>
    </div>
  );
}
