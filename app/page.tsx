// app/page.tsx
"use client";

import React, { useState, useRef } from "react";
import Graph from "@/components/Graph";
import { ParsedData, Node } from "@/lib/parser/babel"; // Re-use interfaces

const HomePage: React.FC = () => {
  const [inputPath, setInputPath] = useState<string>("");
  const [graphData, setGraphData] = useState<ParsedData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [codePreview, setCodePreview] = useState<string | null>(null);

  const graphContainerRef = useRef<HTMLDivElement>(null);
  const [graphDimensions, setGraphDimensions] = useState({ width: 0, height: 0 });

  // Update graph dimensions on window resize and initial load
  React.useEffect(() => {
    const updateDimensions = () => {
      if (graphContainerRef.current) {
        setGraphDimensions({
          width: graphContainerRef.current.clientWidth,
          height: graphContainerRef.current.clientHeight,
        });
      }
    };
    updateDimensions(); // Set initial dimensions
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setGraphData(null); // Clear previous graph
    setSelectedNode(null); // Clear selected node
    setCodePreview(null); // Clear code preview

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputPath }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Something went wrong.");
      }

      const data: ParsedData = await response.json();
      setGraphData(data);
    } catch (err: any) {
      console.error("API Call Error:", err);
      setError(err.message || "An unknown error occurred during analysis.");
    } finally {
      setLoading(false);
    }
  };

  const handleNodeClick = async (node: Node) => {
    setSelectedNode(node);
    setCodePreview("Loading code preview..."); // Placeholder for loading

    // If it's a file node, fetch its content for preview
    if (node.data.type === "file" || node.data.filePath) {
      try {
        // This is a simplified approach. In a real scenario, you'd need
        // to pass the original inputPath (repo URL or local baseDir) to
        // another API route to securely fetch the file content.
        // For demonstration, we'll simulate fetching or show a dummy.
        // As the backend already processed the files, we could have it store
        // or return content for selected files. For now, a placeholder.

        // Simulating a delay and success
        await new Promise(resolve => setTimeout(resolve, 500));
        // In a real app, you'd have an API endpoint like /api/file-content?path=node.id
        // const fileContentResponse = await fetch(`/api/file-content?path=${encodeURIComponent(node.id)}`);
        // const content = await fileContentResponse.text();
        const dummyContent = `// Code preview for ${node.id}\n\n` +
                             `console.log("This is a dummy code snippet.");\n` +
                             `function someFunc() {\n  // Real code content would go here\n}\n` +
                             `/* This content is not fetched from the actual file due to security/complexity. */\n` +
                             `/* Implement a dedicated file content API to make this work for real. */`;

        setCodePreview(dummyContent);
      } catch (err) {
        console.error("Error fetching code preview:", err);
        setCodePreview(`Could not load code preview for ${node.id}.`);
      }
    } else {
      setCodePreview(`No direct code preview for node type: ${node.data.type}.`);
    }
  };

  // Sample graph data as requested for quick testing
  const sampleGraphData: ParsedData = {
    nodes: [
      { id: "App.tsx", data: { label: "App.tsx", type: "file" } },
      { id: "Hero.tsx", data: { label: "Hero.tsx", type: "file" } },
      { id: "Button.tsx", data: { label: "Button.tsx", type: "file" } },
      { id: "App.tsx#Hero", data: { label: "Hero", type: "component", filePath: "App.tsx" } },
      { id: "Hero.tsx#Button", data: { label: "Button", type: "component", filePath: "Hero.tsx" } },
      { id: "utils.ts", data: { label: "utils.ts", type: "file" } },
      { id: "utils.ts#helperFunc", data: { label: "helperFunc", type: "function", filePath: "utils.ts" } },
      { id: "App.tsx#render", data: { label: "render", type: "function", filePath: "App.tsx" } },
    ],
    edges: [
      { id: "e1", source: "App.tsx", target: "Hero.tsx", type: "imports", label: "imports" },
      { id: "e2", source: "App.tsx", target: "App.tsx#Hero", type: "renders", label: "renders" },
      { id: "e3", source: "Hero.tsx", target: "Button.tsx", type: "imports", label: "imports" },
      { id: "e4", source: "Hero.tsx", target: "Hero.tsx#Button", type: "renders", label: "renders" },
      { id: "e5", source: "App.tsx", target: "utils.ts", type: "imports", label: "imports" },
      { id: "e6", source: "App.tsx#render", target: "utils.ts#helperFunc", type: "calls", label: "calls" },
      { id: "e7", source: "App.tsx", target: "App.tsx#render", type: "defines", label: "defines" },
      { id: "e8", source: "utils.ts", target: "utils.ts#helperFunc", type: "defines", label: "defines" },
    ],
  };


  // Export graph as SVG
  const exportGraphAsSvg = () => {
    if (graphData && graphContainerRef.current) {
      const svgElement = graphContainerRef.current.querySelector("svg");
      if (svgElement) {
        const serializer = new XMLSerializer();
        let svgString = serializer.serializeToString(svgElement);

        // Add SVG namespace if missing (often added by D3, but good to ensure)
        if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
            svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        }
        // Add XML declaration
        svgString = '<?xml version="1.0" standalone="no"?>\r\n' + svgString;


        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const svgUrl = URL.createObjectURL(svgBlob);
        const downloadLink = document.createElement("a");
        downloadLink.href = svgUrl;
        downloadLink.download = "code_flow_graph.svg";
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(svgUrl);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-8 bg-gray-100 text-gray-800">
      <h1 className="text-3xl font-bold mb-6">Codebase Visualizer</h1>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg bg-white p-6 rounded-lg shadow-md mb-8 flex flex-col gap-4"
      >
        <label htmlFor="inputPath" className="text-lg font-medium">
          GitHub Repo URL or Local Folder Path:
        </label>
        <input
          type="text"
          id="inputPath"
          value={inputPath}
          onChange={(e) => setInputPath(e.target.value)}
          placeholder="e.g., https://github.com/vercel/next.js or ./my-project"
          className="p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="p-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Analyzing..." : "Analyze Codebase"}
        </button>
      </form>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 w-full max-w-lg">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      )}

      {loading && (
        <p className="text-gray-600 text-lg">
          <span className="animate-spin inline-block w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full mr-2"></span>
          Loading graph... This might take a moment for large repositories.
        </p>
      )}

      {graphData && graphData.nodes.length > 0 ? (
        <div className="w-full max-w-6xl h-[650px] bg-white rounded-lg shadow-md overflow-hidden flex">
          {/* Graph Area */}
          <div ref={graphContainerRef} className="flex-grow h-full relative">
            {graphDimensions.width > 0 && graphDimensions.height > 0 && (
              <Graph
                graphData={graphData}
                width={graphDimensions.width}
                height={graphDimensions.height}
                onNodeClick={handleNodeClick}
              />
            )}
            <div className="absolute top-4 left-4 text-sm bg-gray-700 text-white p-2 rounded-md bg-opacity-70">
              Nodes: {graphData.nodes.length}, Edges: {graphData.edges.length}
            </div>
            <button
              onClick={exportGraphAsSvg}
              className="absolute bottom-4 left-4 p-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm"
            >
              Export as SVG
            </button>
          </div>

          {/* Code Preview Panel */}
          {selectedNode && (
            <div className="w-96 bg-gray-800 text-white p-4 overflow-auto border-l border-gray-700 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">
                  Preview: {selectedNode.data.label}
                </h3>
                <button
                  onClick={() => {
                    setSelectedNode(null);
                    setCodePreview(null);
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  &times;
                </button>
              </div>
              <p className="text-sm text-gray-400 mb-2">
                Type: {selectedNode.data.type}{" "}
                {selectedNode.data.filePath && `(${selectedNode.data.filePath})`}
              </p>
              <div className="flex-grow bg-gray-900 p-3 rounded-md font-mono text-sm overflow-auto">
                <pre className="whitespace-pre-wrap break-all">{codePreview || "Select a node to see its code."}</pre>
              </div>
            </div>
          )}
        </div>
      ) : graphData && graphData.nodes.length === 0 && !loading && !error ? (
        <p className="text-gray-600 text-lg">
          No graph data generated. Try a different path or repository.
        </p>
      ) : null}

      {!graphData && !loading && !error && (
        <div className="w-full max-w-4xl h-[600px] bg-white rounded-lg shadow-md overflow-hidden flex items-center justify-center">
          <p className="text-gray-500 text-lg">
            Enter a GitHub repository URL or local folder path to visualize the
            codebase.
          </p>
        </div>
      )}

      {/* Static Sample Graph Section */}
      <h2 className="text-2xl font-bold mt-10 mb-4">
        Sample Graph (for structure testing)
      </h2>
      <div className="w-full max-w-4xl h-[400px] bg-white rounded-lg shadow-md overflow-hidden">
        <Graph graphData={sampleGraphData} width={800} height={400} />
      </div>
    </div>
  );
};

export default HomePage;
