// lib/parser/babel.ts
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types"; // Import Babel types

// Extend Node to support D3 simulation properties
export interface Node {
  id: string;
  data: {
    label: string;
    type: "file" | "class" | "component" | "import" | "export" | "function";
    filePath?: string;
  };
  position?: { x: number; y: number };
  // D3 simulation properties (optional)
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface Edge {
  id: string;
  source: string;
  target: string;
  type: "renders" | "defines";
  label?: string;
  rawTarget?: string;
}

export interface ParsedData {
  nodes: Node[];
  edges: Edge[];
}

/**
 * Parses JavaScript/TypeScript/JSX/TSX code using Babel to extract
 * file-level imports/exports, function/class definitions/calls, and JSX component usage.
 *
 * @param filePath The absolute or relative path to the file being parsed.
 * @param code The string content of the file.
 * @returns ParsedData containing nodes and edges representing the code structure.
 */
export const parseBabelCode = (
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
    const ast = parser.parse(code, {
      sourceType: "module", // Treat as ES module
      plugins: [
        "jsx",
        "typescript",
        "dynamicImport",
        "importAssertions",
        "decorators-legacy", // Common for frameworks like Angular/NestJS (if applicable)
        "classProperties", // For class field declarations
        "privateMethods",
        "numericSeparator",
        "optionalChaining",
        "nullishCoalescingOperator",
      ],
      allowAwaitOutsideFunction: true, // For top-level await
    });

    traverse(ast, {
      // 1. Handle Import Declarations (file-level imports)
    //   ImportDeclaration(path) {
    //     const importedModule = path.node.source.value;
    //     const importEdgeId = `${filePath}-imports-${importedModule}-${path.node.start}`;

    //     edges.push({
    //       id: importEdgeId,
    //       source: filePath,
    //       target: importedModule, // This target needs resolution in the API handler
    //       type: "imports",
    //       label: "imports",
    //       rawTarget: importedModule,
    //     });
    //   },


      ClassDeclaration(path) {
        if (path.node.id) {
          const className = path.node.id.name;
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
      },

      JSXOpeningElement(path) {
        let componentName: string | null = null;

        if (t.isJSXIdentifier(path.node.name)) {
          componentName = path.node.name.name;
        } else if (t.isJSXMemberExpression(path.node.name)) {
          let current: t.JSXMemberExpression | t.JSXIdentifier = path.node.name;
          const parts: string[] = [];
          while (t.isJSXMemberExpression(current)) {
            parts.unshift(current.property.name);
            current = current.object;
          }
          if (t.isJSXIdentifier(current)) {
            parts.unshift(current.name);
          }
          componentName = parts.join(".");
        }

        if (componentName) {
          if (
            componentName[0] === componentName[0].toUpperCase() &&
            ![
              "div",
              "span",
              "img",
              "a",
              "p",
              "h1",
              "h2",
              "h3",
              "h4",
              "h5",
              "h6",
              "button",
              "input",
              "form",
              "ul",
              "ol",
              "li",
              "table",
              "tr",
              "td",
              "th",
              "svg",
              "path",
              "g",
              "circle",
              "rect",
              "line",
              "text",
           ].includes(componentName.toLowerCase())
          ) {
            const renderEdgeId = `${filePath}-renders-${componentName}-${path.node.start}`;
            edges.push({
              id: renderEdgeId,
              source: filePath,
              target: componentName, // Raw component name, needs resolution
              type: "renders",
              label: "renders",
              rawTarget: componentName,
            });
          }
        }
      },
    });
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error);
    // You might want to log this but continue processing other files.
    // For robust error handling, consider returning a specific error type.
  }

  return { nodes, edges };
};
