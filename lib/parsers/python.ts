// lib/parser/python.ts
import { Node, Edge, ParsedData } from "./babel"; // Re-using interfaces for consistency

/**
 * Parses Python code to extract file-level imports, function definitions,
 * class definitions, and simple function calls.
 *
 * Python does not have explicit "export" keywords like JS/TS.
 * Anything defined at the top-level of a module is implicitly available for import.
 *
 * @param filePath The absolute or relative path to the file being parsed.
 * @param code The string content of the file.
 * @returns ParsedData containing nodes and edges representing the code structure.
 */
export const parsePythonCode = (
  filePath: string,
  code: string
): ParsedData => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Add the file itself as a node
  nodes.push({
    id: filePath,
    data: { label: filePath, type: "file" },
  });

  try {
    // 1. Function Definitions
    // Regex for 'def function_name(...):'
    // Also captures async def
    const functionDefRegex = /^\s*(?:async\s+)?def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(.*?\)\s*:/gm;
    let funcDefMatch;
    while ((funcDefMatch = functionDefRegex.exec(code)) !== null) {
      const functionName = funcDefMatch[1];
      const functionId = `${filePath}#${functionName}`;

      nodes.push({
        id: functionId,
        data: { label: functionName, type: "function", filePath: filePath },
      });
      edges.push({
        id: `${filePath}-defines-func-${functionId}`,
        source: filePath,
        target: functionId,
        type: "defines",
        label: "defines",
        rawTarget: functionId,
      });
    }

    // 2. Class Definitions
    // Regex for 'class ClassName(...):'
    const classDefRegex = /^\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*\(.*\))?\s*:/gm;
    let classDefMatch;
    while ((classDefMatch = classDefRegex.exec(code)) !== null) {
      const className = classDefMatch[1];
      const classId = `${filePath}#${className}`;

      nodes.push({
        id: classId,
        data: { label: className, type: "class", filePath: filePath },
      });
      edges.push({
        id: `${filePath}-defines-class-${classId}`,
        source: filePath,
        target: classId,
        type: "defines",
        label: "defines",
        rawTarget: classId,
      });
    }

    // 3. Imports and From-Imports
    // Covers:
    // - import module
    // - import module as alias
    // - from package import module
    // - from package import module as alias
    // - from package import *
    const importRegex =
      /^\s*(?:import\s+([a-zA-Z_][a-zA-Z0-9_.]*)(?:\s+as\s+[a-zA-Z_][a-zA-Z0-9_]*)?|from\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s+import\s+(?:[a-zA-Z_][a-zA-Z0-9_]*(?:\s+as\s+[a-zA-Z_][a-zA-Z0-9_]*)?(?:,\s*[a-zA-Z_][a-zA-Z0-9_]*(?:\s+as\s+[a-zA-Z_][a-zA-Z0-9_]*)?)*|\*))/gm;

    let importMatch;
    while ((importMatch = importRegex.exec(code)) !== null) {
      const fullImportPath = importMatch[1] || importMatch[2]; // Captures full module path

      if (fullImportPath) {
        // Python relative imports start with '.' or '..'
        // For accurate resolution, these also need the base directory context.
        // We will store the raw target and resolve in API handler.
        const importEdgeId = `${filePath}-imports-${fullImportPath}-${importMatch.index}`;
        edges.push({
          id: importEdgeId,
          source: filePath,
          target: fullImportPath, // This target needs resolution in the API handler
          type: "imports",
          label: "imports",
          rawTarget: fullImportPath,
        });
      }
    }

    // 4. Simple Function/Method Calls (using regex)
    // This is a heuristic approach, looking for `word(`.
    // Will capture function calls and method calls.
    const callRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
    let callMatch;
    const detectedCalls = new Set<string>(); // To avoid duplicate edges for same call within a file
    while ((callMatch = callRegex.exec(code)) !== null) {
      const calleeName = callMatch[1];

      // Exclude common keywords or built-ins that are not actual calls
      if (
        ![
          "if",
          "for",
          "while",
          "with",
          "def",
          "class",
          "return",
          "yield",
          "raise",
          "try",
          "except",
          "finally",
          "print", // Python 2 style print statements
          "del",
          "assert",
          "pass",
          "async",
          "await",
        ].includes(calleeName)
      ) {
        const callEdgeId = `${filePath}-calls-${calleeName}-${callMatch.index}`;
        if (!detectedCalls.has(callEdgeId)) {
          edges.push({
            id: callEdgeId,
            source: filePath,
            target: calleeName, // Raw name, needs resolution
            type: "calls",
            label: "calls",
            rawTarget: calleeName,
          });
          detectedCalls.add(callEdgeId);
        }
      }
    }
  } catch (error) {
    console.error(`Error parsing Python file ${filePath}:`, error);
    // Log the error but allow other files to be processed.
  }

  return { nodes, edges };
};
