// lib/parser/babel.ts
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types"; // Import Babel types

export interface Node {
  id: string; // Unique identifier (e.g., file path, function name, component name)
  data: {
    label: string; // Display name
    type: "file" | "function" | "class" | "component" | "import" | "export"; // Type of node
    filePath?: string; // For function/component/class/export nodes, link back to file
  };
  position?: { x: number; y: number }; // Optional for D3 layout
}

export interface Edge {
  id: string; // Unique edge identifier
  source: string; // ID of the source node
  target: string; // ID of the target node
  type: "imports" | "calls" | "renders" | "exports" | "defines"; // Type of relationship
  label?: string; // Optional label for the edge (e.g., "calls", "renders")
  // Raw target value before resolution (useful for post-processing)
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
      ImportDeclaration(path) {
        const importedModule = path.node.source.value;
        const importEdgeId = `${filePath}-imports-${importedModule}-${path.node.start}`;

        edges.push({
          id: importEdgeId,
          source: filePath,
          target: importedModule, // This target needs resolution in the API handler
          type: "imports",
          label: "imports",
          rawTarget: importedModule,
        });
      },

      // 2. Handle Export Declarations (file-level exports)
      ExportNamedDeclaration(path) {
        if (path.node.source) {
          // Re-export from another module (e.g., export { foo } from './bar')
          const exportedFromModule = path.node.source.value;
          const exportEdgeId = `${filePath}-exports-from-${exportedFromModule}-${path.node.start}`;
          edges.push({
            id: exportEdgeId,
            source: filePath,
            target: exportedFromModule, // Target needs resolution
            type: "exports",
            label: "re-exports",
            rawTarget: exportedFromModule,
          });
        } else if (path.node.declaration) {
          // Export of a variable, function, or class declared in this file
          let exportedName: string | null = null;
          let exportedType: "function" | "class" | "variable" = "variable";

          if (t.isFunctionDeclaration(path.node.declaration)) {
            exportedName = path.node.declaration.id?.name || null;
            exportedType = "function";
          } else if (t.isClassDeclaration(path.node.declaration)) {
            exportedName = path.node.declaration.id?.name || null;
            exportedType = "class";
          } else if (t.isVariableDeclaration(path.node.declaration)) {
            path.node.declaration.declarations.forEach((declarator) => {
              if (t.isIdentifier(declarator.id)) {
                // Take the first exported variable name
                if (!exportedName) exportedName = declarator.id.name;
              }
            });
          }

          if (exportedName) {
            const exportedNodeId = `${filePath}#export_${exportedName}`;
            nodes.push({
              id: exportedNodeId,
              data: {
                label: exportedName,
                type: "export",
                filePath: filePath,
              },
            });
            edges.push({
              id: `${filePath}-exports-${exportedNodeId}-${path.node.start}`,
              source: filePath,
              target: exportedNodeId,
              type: "exports",
              label: `exports ${exportedType}`,
              rawTarget: exportedNodeId,
            });
          }
        } else if (path.node.specifiers) {
          // Named exports using specifiers (e.g., export { foo, bar as baz })
          path.node.specifiers.forEach((specifier) => {
            if (t.isExportSpecifier(specifier) && t.isIdentifier(specifier.exported)) {
              const exportedName = specifier.exported.name;
              const exportedNodeId = `${filePath}#export_${exportedName}`;
              nodes.push({
                id: exportedNodeId,
                data: {
                  label: exportedName,
                  type: "export",
                  filePath: filePath,
                },
              });
              edges.push({
                id: `${filePath}-exports-${exportedNodeId}-${path.node.start}-${exportedName}`,
                source: filePath,
                target: exportedNodeId,
                type: "exports",
                label: "exports",
                rawTarget: exportedNodeId,
              });
            }
          });
        }
      },
      ExportDefaultDeclaration(path) {
        // Example: export default MyComponent;
        const defaultExportId = `${filePath}#export_default`;
        nodes.push({
          id: defaultExportId,
          data: { label: "default export", type: "export", filePath: filePath },
        });
        edges.push({
          id: `${filePath}-exports-default-${path.node.start}`,
          source: filePath,
          target: defaultExportId,
          type: "exports",
          label: "exports default",
          rawTarget: defaultExportId,
        });
      },
      ExportAllDeclaration(path) {
        // Example: export * from './module';
        const exportedFromModule = path.node.source.value;
        const exportAllId = `${filePath}-exports-all-${exportedFromModule}-${path.node.start}`;
        edges.push({
          id: exportAllId,
          source: filePath,
          target: exportedFromModule, // Needs resolution
          type: "exports",
          label: "exports all from",
          rawTarget: exportedFromModule,
        });
      },

      // 3. Handle Function & Class Definitions
      FunctionDeclaration(path) {
        if (path.node.id) {
          const functionName = path.node.id.name;
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
      },
      VariableDeclarator(path) {
        // Handle arrow functions and function expressions (e.g., const func = () => {} or const func = function() {})
        if (t.isIdentifier(path.node.id)) {
          if (
            t.isArrowFunctionExpression(path.node.init) ||
            t.isFunctionExpression(path.node.init)
          ) {
            const functionName = path.node.id.name;
            const functionId = `${filePath}#${functionName}`;
            nodes.push({
              id: functionId,
              data: {
                label: functionName,
                type: "function",
                filePath: filePath,
              },
            });
            edges.push({
              id: `${filePath}-defines-var-func-${functionId}`,
              source: filePath,
              target: functionId,
              type: "defines",
              label: "defines",
              rawTarget: functionId,
            });
          }
        }
      },
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

      // 4. Handle Function/Method Calls
      CallExpression(path) {
        let calleeName: string | null = null;
        if (t.isIdentifier(path.node.callee)) {
          calleeName = path.node.callee.name;
        } else if (t.isMemberExpression(path.node.callee)) {
          // obj.method() or Class.staticMethod()
          if (t.isIdentifier(path.node.callee.property)) {
            // calleeName = `${path.node.callee.object.type === 'Identifier' ? path.node.callee.object.name : 'Unknown'}.${path.node.callee.property.name}`;
            calleeName = path.node.callee.property.name; // For now, just the method name for simplicity in target resolution
          }
        } else if (t.isCallExpression(path.node.callee)) {
          // Handle IIFEs or chained calls, for simplicity, we ignore deep nesting for now
        }

        if (calleeName) {
          const callEdgeId = `${filePath}-calls-${calleeName}-${path.node.start}`;
          // The target is the raw name of the function/method being called.
          // This will need to be resolved to an actual function/class node later.
          edges.push({
            id: callEdgeId,
            source: filePath,
            target: calleeName, // Raw name, needs resolution
            type: "calls",
            label: "calls",
            rawTarget: calleeName,
          });
        }
      },

      // 5. Handle JSX Component Usage (e.g., <Hero />)
      JSXOpeningElement(path) {
        let componentName: string | null = null;

        if (t.isJSXIdentifier(path.node.name)) {
          componentName = path.node.name.name;
        } else if (t.isJSXMemberExpression(path.node.name)) {
          // For <Component.SubComponent />
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
          // Heuristic: Capitalized names often indicate components
          // And exclude built-in HTML tags (e.g., <div>, <span>)
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
