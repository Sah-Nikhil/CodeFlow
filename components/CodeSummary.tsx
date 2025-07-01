    import React, { useEffect, useState } from "react";

interface CodeSummaryProps {
  code: string;
  filename: string;
}

const CodeSummary: React.FC<CodeSummaryProps> = ({ code, filename }) => {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code || !filename) {
      setSummary(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    setSummary(null);
    fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, filename }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to fetch summary");
        }
        return res.json();
      })
      .then((data) => setSummary(data.summary))
      .catch((err) => {
        setError(err.message || "Could not generate summary for this file.");
      })
      .finally(() => setLoading(false));
  }, [code, filename]);

  return (
    <div className="w-96 min-w-[20rem] border-l pl-6">
      <h3 className="text-xl font-semibold mb-4">File Summary</h3>
      {loading ? (
        <div className="text-gray-500">Generating summary...</div>
      ) : error ? (
        <div className="text-red-500 whitespace-pre-wrap text-sm">{error}</div>
      ) : summary ? (
        <div className="whitespace-pre-wrap text-sm">{summary}</div>
      ) : (
        <div className="text-gray-400">No summary available.</div>
      )}
    </div>
  );
};

export default CodeSummary;
