# backend/parser/tree_sitter_parser.py
from tree_sitter import Language, Parser
import os
import asyncio

# Path to your built grammars. Adjust if you store them elsewhere.
# Ensure this path is correct after building grammars.
GRAMMARS_BUILD_DIR = os.path.join(os.path.dirname(__file__), 'build')

# Load languages
# You need to build these grammars first. Instructions below.
try:
    JS_LANGUAGE = Language(os.path.join(GRAMMARS_BUILD_DIR, 'languages.so'), 'javascript')
    TS_LANGUAGE = Language(os.path.join(GRAMMARS_BUILD_DIR, 'languages.so'), 'typescript')
    TSX_LANGUAGE = Language(os.path.join(GRAMMARS_BUILD_DIR, 'languages.so'), 'tsx')
    PYTHON_LANGUAGE = Language(os.path.join(GRAMMARS_BUILD_DIR, 'languages.so'), 'python')
    print("Tree-sitter languages loaded successfully.")
except Exception as e:
    print(f"Error loading Tree-sitter languages. Make sure grammars are built: {e}")
    # Exit or handle gracefully if grammars are not found/built
    JS_LANGUAGE, TS_LANGUAGE, TSX_LANGUAGE, PYTHON_LANGUAGE = None, None, None, None


def get_parser(file_path: str) -> Optional[Parser]:
    """Returns a Tree-sitter parser based on file extension."""
    parser = Parser()
    _, ext = os.path.splitext(file_path)
    if ext in ['.js', '.jsx'] and JS_LANGUAGE:
        parser.set_language(JS_LANGUAGE)
    elif ext == '.ts' and TS_LANGUAGE:
        parser.set_language(TS_LANGUAGE)
    elif ext == '.tsx' and TSX_LANGUAGE:
        parser.set_language(TSX_LANGUAGE)
    elif ext == '.py' and PYTHON_LANGUAGE:
        parser.set_language(PYTHON_LANGUAGE)
    else:
        return None
    return parser

async def parse_file(file_path: str, base_path: str):
    """
    Parses a single file using Tree-sitter and extracts relevant information.
    Returns nodes, edges, and optional code content.
    """
    parser = get_parser(file_path)
    if not parser:
        return [], [], ""

    try:
        with open(file_path, 'rb') as f:
            code_bytes = f.read()
        code_str = code_bytes.decode('utf-8', errors='ignore')

        tree = parser.parse(code_bytes)
        root_node = tree.root_node

        file_id = os.path.relpath(file_path, base_path)
        file_node = {"id": file_id, "label": os.path.basename(file_path), "type": "file", "code": code_str}
        nodes = [file_node]
        edges = []
        node_counter = 0 # To ensure unique IDs for internal nodes

        # Example: Extract function definitions, imports, JSX components
        # This is a simplified example. A full implementation would involve
        # more sophisticated AST traversal and pattern matching.

        # Query for functions, imports, JSX components
        # These queries might need refinement based on specific grammar versions
        js_ts_tsx_query_str = """
            (import_statement (import_clause (named_imports (import_specifier (identifier) @imported_name))))
            (import_statement (string_fragment) @import_path)
            (export_statement) @export
            (function_declaration (identifier) @function_name)
            (call_expression (identifier) @call_name)
            (jsx_element (jsx_opening_element (jsx_identifier) @component_name))
        """
        python_query_str = """
            (import_statement (dotted_name) @imported_name)
            (import_from_statement (dotted_name) @imported_name)
            (function_definition (identifier) @function_name)
            (call (attribute (identifier) @call_name) (argument_list)) @call_name # simple calls
            (call (identifier) @call_name (argument_list)) @call_name
        """

        if parser.language == JS_LANGUAGE or parser.language == TS_LANGUAGE or parser.language == TSX_LANGUAGE:
            query = parser.language.query(js_ts_tsx_query_str)
        elif parser.language == PYTHON_LANGUAGE:
            query = parser.language.query(python_query_str)
        else:
            return nodes, edges, code_str

        captures = query.captures(root_node)

        for cap_node, cap_name in captures:
            content = cap_node.text.decode('utf-8', errors='ignore')
            node_id = f"{file_id}-{cap_name}-{node_counter}"

            if cap_name == "function_name":
                nodes.append({"id": node_id, "label": content, "type": "function"})
                edges.append({"id": f"e-{node_id}-contains", "source": file_id, "target": node_id, "type": "contains"})
            elif cap_name == "component_name": # For JSX components
                nodes.append({"id": node_id, "label": content, "type": "component"})
                edges.append({"id": f"e-{node_id}-contains", "source": file_id, "target": node_id, "type": "contains"})
            elif cap_name == "call_name":
                # This is simplified. In a real app, you'd resolve call targets.
                # For now, just mark it as a call within the file.
                nodes.append({"id": node_id, "label": f"Call: {content}", "type": "call_expression"})
                edges.append({"id": f"e-{node_id}-contains", "source": file_id, "target": node_id, "type": "contains"})
            elif cap_name in ["imported_name", "import_path"]:
                 # More complex logic needed to link imports to actual files.
                 # For now, just add a generic import relation to the file.
                 nodes.append({"id": node_id, "label": f"Import: {content}", "type": "import_statement"})
                 edges.append({"id": f"e-{file_id}-imports-{node_id}", "source": file_id, "target": node_id, "type": "import"})

            node_counter += 1

        return nodes, edges, code_str

    except Exception as e:
        print(f"Error parsing file {file_path}: {e}")
        return [], [], ""


async def parse_repository(repo_path: str, file_paths: list[str]):
    """
    Parses all files in a repository and consolidates the graph data.
    """
    all_nodes = []
    all_edges = []
    file_contents = {} # Store code content for preview

    tasks = [parse_file(fp, repo_path) for fp in file_paths]
    results = await asyncio.gather(*tasks)

    for nodes, edges, code_content in results:
        all_nodes.extend(nodes)
        all_edges.extend(edges)
        if nodes and "code" in nodes[0]: # Assuming file node is first and has code
            file_contents[nodes[0]["id"]] = nodes[0]["code"]
            del nodes[0]["code"] # Remove code from node to reduce graph JSON size

    return {"nodes": all_nodes, "edges": all_edges, "file_contents": file_contents}
