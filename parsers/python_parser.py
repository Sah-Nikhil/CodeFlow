import ast
import os

class PythonParser:
    def __init__(self):
        self.node_counter = 0
        self.nodes = []
        self.edges = []

    def parse(self, code_content, file_path=""):
        """Parse Python code and extract flow information"""
        self.node_counter = 0
        self.nodes = []
        self.edges = []

        try:
            tree = ast.parse(code_content)
            self.visit_node(tree, None)

            return {
                'nodes': self.nodes,
                'edges': self.edges,
                'file_path': file_path
            }
        except SyntaxError as e:
            raise Exception(f"Python syntax error: {str(e)}")

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

    def visit_node(self, node, parent_id):
        """Visit AST node and create flow diagram nodes"""
        if isinstance(node, ast.Module):
            start_id = self.create_node("Start", "start")
            last_id = start_id

            for child in node.body:
                last_id = self.visit_node(child, last_id)

            self.create_node("End", "end", last_id)
            return last_id

        elif isinstance(node, ast.FunctionDef):
            func_id = self.create_node(f"Function: {node.name}", "function", parent_id)
            last_id = func_id

            for child in node.body:
                last_id = self.visit_node(child, last_id)

            return last_id

        elif isinstance(node, ast.If):
            condition = ast.unparse(node.test) if hasattr(ast, 'unparse') else "condition"
            if_id = self.create_node(f"If: {condition}", "condition", parent_id)

            # Process if body
            if_body_id = self.create_node("If Body", "process")
            self.edges.append({'from': if_id, 'to': if_body_id, 'label': 'Yes'})

            last_if_id = if_body_id
            for child in node.body:
                last_if_id = self.visit_node(child, last_if_id)

            # Process else body
            if node.orelse:
                else_body_id = self.create_node("Else Body", "process")
                self.edges.append({'from': if_id, 'to': else_body_id, 'label': 'No'})

                last_else_id = else_body_id
                for child in node.orelse:
                    last_else_id = self.visit_node(child, last_else_id)

                # Merge point
                merge_id = self.create_node("Merge", "process")
                self.edges.append({'from': last_if_id, 'to': merge_id})
                self.edges.append({'from': last_else_id, 'to': merge_id})
                return merge_id

            return last_if_id

        elif isinstance(node, ast.For):
            target = ast.unparse(node.target) if hasattr(ast, 'unparse') else "item"
            iter_val = ast.unparse(node.iter) if hasattr(ast, 'unparse') else "iterable"
            for_id = self.create_node(f"For {target} in {iter_val}", "condition", parent_id)

            loop_body_id = self.create_node("Loop Body", "process")
            self.edges.append({'from': for_id, 'to': loop_body_id, 'label': 'Continue'})

            last_id = loop_body_id
            for child in node.body:
                last_id = self.visit_node(child, last_id)

            # Loop back
            self.edges.append({'from': last_id, 'to': for_id})

            return for_id

        elif isinstance(node, ast.While):
            condition = ast.unparse(node.test) if hasattr(ast, 'unparse') else "condition"
            while_id = self.create_node(f"While: {condition}", "condition", parent_id)

            loop_body_id = self.create_node("Loop Body", "process")
            self.edges.append({'from': while_id, 'to': loop_body_id, 'label': 'True'})

            last_id = loop_body_id
            for child in node.body:
                last_id = self.visit_node(child, last_id)

            # Loop back
            self.edges.append({'from': last_id, 'to': while_id})

            return while_id

        elif isinstance(node, ast.Call):
            func_name = "function_call"
            if isinstance(node.func, ast.Name):
                func_name = node.func.id
            elif isinstance(node.func, ast.Attribute):
                func_name = node.func.attr

            call_id = self.create_node(f"Call: {func_name}()", "function", parent_id)
            return call_id

        else:
            # Generic node for other statements
            node_type = type(node).__name__
            generic_id = self.create_node(f"{node_type}", "process", parent_id)
            return generic_id
