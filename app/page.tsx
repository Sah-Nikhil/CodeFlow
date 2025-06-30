// app/page.tsx
"use client";

import React, { useState, useRef } from "react";
import Graph from "@/components/Graph";
import DirectoryTree, { DirectoryNode } from "@/components/DirectoryTree";
import { ParsedData, Node } from "@/lib/parsers/babel";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

const HomePage: React.FC = () => {
  const [inputPath, setInputPath] = useState<string>("");
  const [graphData, setGraphData] = useState<ParsedData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [codePreview, setCodePreview] = useState<string | null>(null);
  const [repoUrl, setRepoUrl] = useState<string>("");

  const graphContainerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<{ focusNode: (nodeId: string) => void }>(null);
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
    setRepoUrl("");

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
      // If inputPath is a GitHub URL, store it for file preview
      if (inputPath.startsWith("http://") || inputPath.startsWith("https://")) {
        setRepoUrl(inputPath);
      }
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
        // Try to fetch the real file content from the API
        const res = await fetch("/api/file-content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filePath: node.data.label.replace(/\\/g, "/"),
            repoUrl: repoUrl || undefined,
          }),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to fetch file content");
        }
        const data = await res.json();
        setCodePreview(data.content);
      } catch (err) {
        console.error("Error fetching code preview:", err);
        setCodePreview(`Could not load code preview for ${node.id}.`);
      }
    } else {
      setCodePreview(`No direct code preview for node type: ${node.data.type}.`);
    }
  };

  // Utility: Convert flat file list to directory tree
  function buildDirectoryTree(files: string[]): DirectoryNode[] {
    const root: { [key: string]: DirectoryNode } = {};
    for (const file of files) {
      const parts = file.split("/");
      let current = root;
      let path = "";
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        path = path ? path + "/" + part : part;
        if (!current[part]) {
          current[part] = {
            name: part,
            path,
            ...(i < parts.length - 1 ? { children: {} } : {}),
          } as DirectoryNode;
        }
        if (i < parts.length - 1) {
          current = current[part].children as any;
        }
      }
    }
    // Recursively convert children objects to arrays
    function toArray(obj: any): DirectoryNode[] {
      return Object.values(obj).map((node: any) =>
        node.children ? { ...node, children: toArray(node.children) } : node
      );
    }
    return toArray(root);
  }

  // Extract file nodes from graphData
  const fileNodes = graphData?.nodes.filter((n: Node) => n.data.type === "file");
  // Normalize file paths to use forward slashes for directory tree
  const filePaths = fileNodes?.map((n: Node) => n.data.label.replace(/\\/g, "/")) || [];
  const directoryTree = buildDirectoryTree(filePaths);


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

  // Utility: Guess language from file extension
  function getLanguageFromFilename(filename: string): string {
    const ext = filename.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "js": return "javascript";
      case "ts": return "typescript";
      case "tsx": return "tsx";
      case "jsx": return "jsx";
      case "py": return "python";
      case "java": return "java";
      case "c": return "c";
      case "cpp": return "cpp";
      case "cs": return "csharp";
      case "json": return "json";
      case "css": return "css";
      case "html": return "html";
      case "md": return "markdown";
      case "go": return "go";
      case "rb": return "ruby";
      case "php": return "php";
      case "sh": return "bash";
      case "yml": case "yaml": return "yaml";
      default: return "text";
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center p-6 bg-gray-100 text-gray-800">
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
        <div className="w-full max-w-7xl h-[850px] bg-white rounded-lg shadow-md overflow-hidden flex">
          {/* Graph Area */}
          <div ref={graphContainerRef} className="flex-grow h-full relative">
            {graphDimensions.width > 0 && graphDimensions.height > 0 && (
              <Graph
                ref={graphRef}
                graphData={graphData}
                width={graphDimensions.width}
                height={graphDimensions.height}
                onNodeClick={handleNodeClick}
              />
            )}
            <div className="absolute top-4 left-4 text-sm bg-neutral-700 text-white p-2 rounded-md bg-opacity-70">
              Nodes: {graphData.nodes.length}, Edges: {graphData.edges.length}
            </div>
            <button
              onClick={exportGraphAsSvg}
              className="absolute bottom-4 left-4 p-2 bg-neutral-600 text-neutral-50 rounded-md hover:bg-neutral-800 text-sm"
            >
              Export as SVG
            </button>
          </div>
          {/* Directory Tree Pane */}
          <div className="w-80 h-full border-l border-gray-200 bg-gray-50 overflow-auto">
            <h3 className="fixed-top text-lg font-semibold p-4 border-b border-gray-200">Directory Structure</h3>
            <DirectoryTree tree={directoryTree} onFileClick={(filePath) => {
              const node = fileNodes?.find((n: Node) => n.data.label.replace(/\\/g, "/") === filePath);
              console.log('[DirectoryTree] Clicked filePath:', filePath);
              if (node) {
                console.log('[DirectoryTree] Found node for filePath:', node.id, node);
                handleNodeClick(node);
                // Focus/zoom to node in graph
                setTimeout(() => {
                  graphRef.current?.focusNode(node.id);
                }, 200); // Small delay to ensure graph is ready
              } else {
                console.warn('[DirectoryTree] No node found for filePath:', filePath, 'Available file node labels:', fileNodes?.map(n => n.data.label));
              }
            }} />
          </div>
        </div>
      ) : (
        graphData && (
          <p className="text-gray-500 text-lg">
            No nodes found in the graph data. Please check the input path and try again.
          </p>
        )
      )}

      {selectedNode && codePreview && (
        <div className="justify-start w-full max-w-4xl bg-neutral-50 p-6 rounded-lg shadow-md mt-8">
          <h3 className="text-xl font-semibold mb-4">Code Preview for {selectedNode.data.label}</h3>
          <SyntaxHighlighter
            language={getLanguageFromFilename(selectedNode.data.label)}
            style={oneDark}
            customStyle={{ borderRadius: 8, fontSize: 14, padding: 16 }}
            showLineNumbers
          >
            {codePreview}
          </SyntaxHighlighter>
        </div>
      )}

    </div>
  );
};

export default HomePage;
