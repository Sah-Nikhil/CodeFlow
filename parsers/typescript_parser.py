import re
import json

class TypeScriptParser:
    def __init__(self):
        self.node_counter = 0
        self.nodes = []
        self.edges = []

    def parse(self, code_content, file_path=""):
        """Parse TypeScript/JavaScript code and extract flow information"""
        self.node_counter = 0
        self.nodes = []
        self.edges = []

        lines = code_content.split('\n')
        self.parse_lines(lines)

        return {
            'nodes': self.nodes,
            'edges': self.edges,
            'file_path': file_path
        }

    def create_node(self, label, node_type='process', parent_id=None):
        """Create a new node"""
        node_id = f"node_{self.node_counter}"
        self.node_counter += 1

        self.nodes.append({
            'id': node_id,
            'label': label,
            'type': node_type
        })

        if parent_id:
            self.edges.append({
                'from': parent_id,
                'to': node_id
            })

        return node_id

    def parse_lines(self, lines):
        """Parse TypeScript/JavaScript lines and create flow nodes"""
        start_id = self.create_node("Start", "start")
        current_id = start_id

        i = 0
        while i < len(lines):
            line = lines[i].strip()

            if not line or line.startswith('//') or line.startswith('/*'):
                i += 1
                continue

            # Function definition
            if re.match(r'(function\s+\w+|const\s+\w+\s*=\s*\([^)]*\)\s*=>|\w+\s*\([^)]*\)\s*{)', line):
                func_match = re.search(r'(function\s+(\w+)|const\s+(\w+)|(\w+)\s*\()', line)
                if func_match:
                    func_name = func_match.group(2) or func_match.group(3) or func_match.group(4) or "anonymous"
                    current_id = self.create_node(f"Function: {func_name}", "function", current_id)

            # If statement
            elif line.startswith('if'):
                condition = re.search(r'if\s*\(([^)]+)\)', line)
                condition_text = condition.group(1) if condition else "condition"
                current_id = self.create_node(f"If: {condition_text}", "condition", current_id)

            # For loop
            elif line.startswith('for'):
                loop_match = re.search(r'for\s*\(([^)]+)\)', line)
                loop_text = loop_match.group(1) if loop_match else "loop"
                current_id = self.create_node(f"For: {loop_text}", "condition", current_id)

            # While loop
            elif line.startswith('while'):
                condition = re.search(r'while\s*\(([^)]+)\)', line)
                condition_text = condition.group(1) if condition else "condition"
                current_id = self.create_node(f"While: {condition_text}", "condition", current_id)

            # Function call
            elif re.search(r'\w+\s*\([^)]*\)', line) and not line.startswith('if') and not line.startswith('for') and not line.startswith('while'):
                func_match = re.search(r'(\w+)\s*\([^)]*\)', line)
                if func_match:
                    func_name = func_match.group(1)
                    current_id = self.create_node(f"Call: {func_name}()", "function", current_id)

            # Return statement
            elif line.startswith('return'):
                current_id = self.create_node("Return", "process", current_id)

            i += 1

        self.create_node("End", "end", current_id)
