// app/api/analyze/route.ts
import { NextResponse } from "next/server";
import { ParsedData, Node, Edge } from "@/lib/parser/babel"; // Re-using interfaces
import { parseBabelCode } from "@/lib/parser/babel";
import { parsePythonCode } from "@/lib/parser/python";
import { simpleGit } from "simple-git";
import { globby } from "globby";
import path from "path";
import fs from "fs/promises";
import os from "os";

export const dynamic = "force-dynamic"; // Ensure this API route is dynamic

// Utility to remove duplicates from nodes/edges
const uniqueItems = <T extends { id: string }>(items: T[]): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
};

export async function POST(req: Request) {
  const { inputPath } = await req.json();

  if (!inputPath) {
    return NextResponse.json(
      { error: "Input path is required" },
      { status: 400 }
    );
  }

  let baseDir: string | null = null;
  const allParsedNodes: Node[] = [];
  const allParsedEdges: Edge[] = [];

  try {
    if (inputPath.startsWith("http")) {
      // GitHub URL
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-"));
      baseDir = tempDir;
      console.log(`Cloning ${inputPath} into ${tempDir}`);
      await simpleGit().clone(inputPath, tempDir);
    } else {
      // Local path
      baseDir = path.resolve(inputPath); // Resolve to absolute path
      try {
        await fs.access(baseDir); // Check if local path exists
        const stats = await fs.stat(baseDir);
        if (!stats.isDirectory()) {
          return NextResponse.json(
            { error: `Provided local path is not a directory: ${baseDir}` },
            { status: 400 }
          );
        }
      } catch (error) {
        return NextResponse.json(
          { error: `Local path not found or inaccessible: ${baseDir}` },
          { status: 404 }
        );
      }
    }

    if (!baseDir) {
      throw new Error("Base directory could not be determined.");
    }

    // Define patterns to ignore
    const ignorePatterns: string[] = [
      "node_modules",
      ".git",
      ".next",
      "out", // Next.js export directory
      "dist", // Common build directory
      "build",
      "coverage",
      "*.min.js", // Minified JS files
      "*.map", // Source maps
      "package.json",
      "package-lock.json",
      "yarn.lock",
      "pnpm-lock.yaml",
      "tsconfig.json",
      "jsconfig.json",
      "next.config.js",
      "next.config.ts",
      "postcss.config.mjs",
      "tailwind.config.ts",
      "eslint.config.mjs",
      "README.md",
      "LICENSE",
      ".env",
      ".env.local",
      ".env.development",
      ".env.production",
      "**/*.d.ts", // TypeScript declaration files
      "**/*.test.js", // Test files
      "**/*.test.ts",
      "**/*.spec.js",
      "**/*.spec.ts",
      "**/__tests__/**",
    ];

    // Read .gitignore and add its entries
    // Read .gitignore and add its entries
    let gitignorePath = ""; // Declare outside try block
    try {
      gitignorePath = path.join(baseDir, ".gitignore"); // Assign value here
      const gitignoreContent = await fs.readFile(gitignorePath, "utf-8");
      const gitignoreLines = gitignoreContent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));
      ignorePatterns.push(...gitignoreLines);
    } catch (err) {
      // Now gitignorePath is accessible
      console.log("No .gitignore found or error reading it at", gitignorePath);
      // No .gitignore, continue without it
    }

    // Find all relevant files using globby
    const filePaths = await globby(["**/*.{js,jsx,ts,tsx,py}"], {
      cwd: baseDir,
      ignore: ignorePatterns,
      onlyFiles: true,
      absolute: true,
    });

    console.log(`Found ${filePaths.length} relevant files.`);

    // First Pass: Parse all files and collect raw nodes and edges
    for (const filePath of filePaths) {
      const relativeFilePath = path.relative(baseDir, filePath);
      const fileExtension = path.extname(filePath);

      try {
        const fileContent = await fs.readFile(filePath, "utf-8");
        let currentParsedData: ParsedData = { nodes: [], edges: [] };

        if ([".js", ".jsx", ".ts", ".tsx"].includes(fileExtension)) {
          currentParsedData = parseBabelCode(relativeFilePath, fileContent);
        } else if ([".py"].includes(fileExtension)) {
          currentParsedData = parsePythonCode(relativeFilePath, fileContent);
        }
        // Add other language parsers here as needed

        allParsedNodes.push(...currentParsedData.nodes);
        allParsedEdges.push(...currentParsedData.edges);
      } catch (fileReadError) {
        console.error(`Error processing file ${filePath}:`, fileReadError);
      }
    }

    // Dedup nodes and edges after collecting all from parsers
    const uniqueNodes = uniqueItems(allParsedNodes);
    const uniqueEdges = uniqueItems(allParsedEdges);

    console.log(
      `Initial parsing: ${uniqueNodes.length} nodes, ${uniqueEdges.length} edges`
    );

    // --- Second Pass: Resolve Edge Targets ---
    // This is where we map rawTarget strings (like 'Button', './utils')
    // to actual node IDs within our uniqueNodes list.

    const finalNodes: Node[] = [...uniqueNodes]; // Start with all unique nodes
    const finalEdges: Edge[] = [];

    // Create a map for quick lookup of nodes by their various identifiers
    // This includes file paths, function/class/component names within files.
    const nodeMap = new Map<string, Node>();
    uniqueNodes.forEach((node) => {
      nodeMap.set(node.id, node);
      // Also map by just the label for easier resolution of imported/called names
      // This is a simplified approach; true resolution is complex.
      if (node.data.type === "function" || node.data.type === "class" || node.data.type === "component" || node.data.type === "export") {
        nodeMap.set(node.data.label, node); // e.g., "Button" -> Button.tsx#Button
        // Also map just the name part for calls
        const namePart = node.data.label.split("#").pop();
        if (namePart) {
          nodeMap.set(namePart, node);
        }
      }
    });

    for (const edge of uniqueEdges) {
      let resolvedTargetId = edge.target; // Start with the existing target

      if (edge.rawTarget) {
        // Try to resolve based on common patterns
        // 1. Resolve relative file imports (e.g., './utils', '../components/Button')
        if (edge.type === "imports" && (edge.rawTarget.startsWith(".") || edge.rawTarget.startsWith("/"))) {
          // Attempt to resolve to an actual file path in the analyzed project
          const sourceFilePath = edge.source;
          // Normalize paths for comparison
          let targetAbsolutePath: string | null = null;
          try {
            // Handle cases where the rawTarget might have a file extension
            const targetPathWithExt = path.resolve(path.dirname(path.join(baseDir, sourceFilePath)), edge.rawTarget);
            if (filePaths.includes(targetPathWithExt)) {
              targetAbsolutePath = targetPathWithExt;
            } else {
              // Try common extensions if no extension in rawTarget
              const potentialExtensions = [".js", ".jsx", ".ts", ".tsx", ".py"];
              for (const ext of potentialExtensions) {
                const targetPathWithoutExt = path.resolve(path.dirname(path.join(baseDir, sourceFilePath)), edge.rawTarget);
                if (filePaths.includes(targetPathWithoutExt + ext)) {
                  targetAbsolutePath = targetPathWithoutExt + ext;
                  break;
                }
              }
            }

            // Also check for index files in directories (e.g. import './components' -> './components/index.js')
            if (!targetAbsolutePath) {
              const targetDir = path.resolve(path.dirname(path.join(baseDir, sourceFilePath)), edge.rawTarget);
              const potentialIndexFiles = ["index.js", "index.jsx", "index.ts", "index.tsx", "index.py"];
              for (const indexFile of potentialIndexFiles) {
                const potentialIndexPath = path.join(targetDir, indexFile);
                if (filePaths.includes(potentialIndexPath)) {
                  targetAbsolutePath = potentialIndexPath;
                  break;
                }
              }
            }
          } catch (e) {
            console.warn(`Error resolving path for ${edge.rawTarget} from ${sourceFilePath}:`, e);
          }


          if (targetAbsolutePath) {
            resolvedTargetId = path.relative(baseDir, targetAbsolutePath);
          } else {
            // If it's a relative path but not found, it might be an external library or misconfigured
            // For now, let it be the rawTarget as a separate node or filter it out.
            // Option: Add a node for "unresolved external module"
            // console.warn(`Could not resolve local import: ${edge.rawTarget} from ${sourceFilePath}`);
          }
        }
        // 2. Resolve internal function/class/component calls/renders/exports
        else {
          // Try to find a node by its raw target name (e.g., 'Button', 'myFunction')
          // This is heuristic: it finds the FIRST node with that label.
          // For real accuracy, this needs scope-aware resolution.
          let foundNode = nodeMap.get(edge.rawTarget);

          if (!foundNode) {
            // If not found directly, try finding nodes defined within the source file first
            const potentialLocalNodeId = `${edge.source}#${edge.rawTarget}`;
            foundNode = nodeMap.get(potentialLocalNodeId);
          }

          if (foundNode) {
            resolvedTargetId = foundNode.id;
          } else {
            // If the raw target refers to a component/function/class name
            // (e.g., "Hero" in <Hero /> or "fetchData()" call)
            // try to find a file where this might be defined or exported
            // This is a weak link: it connects to the file that *defines* something with that label,
            // not necessarily where it's *imported from*.
            const potentialFileNode = filePaths.find(fp => {
              const relPath = path.relative(baseDir, fp);
              // Basic check: does the filename contain the component/function name?
              // This is a very rough heuristic.
              return relPath.includes(edge.rawTarget) || relPath.toLowerCase().includes(edge.rawTarget.toLowerCase());
            });

            if (potentialFileNode) {
                resolvedTargetId = path.relative(baseDir, potentialFileNode);
                // Also add a new node for the component/function if it wasn't captured as an explicit node
                // (e.g. if the parser didn't make a node for "Hero" component, just an edge TO "Hero")
                if (!nodeMap.has(resolvedTargetId) && !uniqueNodes.some(n => n.id === resolvedTargetId)) {
                    finalNodes.push({ id: resolvedTargetId, data: { label: resolvedTargetId, type: 'file' } });
                    nodeMap.set(resolvedTargetId, finalNodes[finalNodes.length - 1]);
                }
            } else {
                // If the raw target refers to something truly external or not found within the project
                // We might want to add it as a generic external node.
                if (!nodeMap.has(edge.rawTarget)) {
                    finalNodes.push({ id: edge.rawTarget, data: { label: edge.rawTarget, type: "import" } });
                    nodeMap.set(edge.rawTarget, finalNodes[finalNodes.length - 1]);
                }
                resolvedTargetId = edge.rawTarget;
            }
          }
        }
      }

      // Add the resolved edge
      // Ensure source and target exist as nodes before adding edge
      if (nodeMap.has(edge.source) && nodeMap.has(resolvedTargetId)) {
          finalEdges.push({
            id: edge.id,
            source: edge.source,
            target: resolvedTargetId,
            type: edge.type,
            label: edge.label,
            rawTarget: edge.rawTarget, // Keep raw target for debugging if needed
          });
      } else {
          console.warn(`Dropped edge: Source '${edge.source}' or Target '${resolvedTargetId}' not found in nodes. Raw target: '${edge.rawTarget}'`);
      }
    }

    const finalUniqueNodes = uniqueItems(finalNodes);
    const finalUniqueEdges = uniqueItems(finalEdges);

    console.log(
      `Final graph: ${finalUniqueNodes.length} nodes, ${finalUniqueEdges.length} edges`
    );

    return NextResponse.json({
      nodes: finalUniqueNodes,
      edges: finalUniqueEdges,
    });
  } catch (error) {
    console.error("Analysis failed:", error);
    return NextResponse.json(
      { error: "Failed to analyze codebase", details: (error as Error).message },
      { status: 500 }
    );
  } finally {
    if (inputPath.startsWith("http") && baseDir) {
      // Clean up temp directory if it was a GitHub repo
      try {
        console.log(`Cleaning up temporary directory: ${baseDir}`);
        await fs.rm(baseDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error("Error cleaning up temporary directory:", cleanupError);
      }
    }
  }
}
