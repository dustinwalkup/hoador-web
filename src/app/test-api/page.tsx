"use client";

import { useEffect, useState } from "react";

export default function TestAPIPage() {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/listings/search?limit=12&page=1");
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="mb-4 text-2xl font-bold">API Test</h1>
      <pre className="overflow-auto rounded bg-gray-100 p-4">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
