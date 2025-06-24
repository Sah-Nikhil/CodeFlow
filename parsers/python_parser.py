import ast
import os

class EnhancedPythonParser:
    def __init__(self):
        self.node_counter = 0
        self.nodes = []
        self.edges = []
        self.current_function = None
        self.function_calls = []

    def parse(self, code_content, file_path=""):
        """Parse Python code and extract meaningful flow information"""
        self.node_counter = 0
        self.nodes = []
        self.edges = []
        self.current_function = None
        self.function_calls = []

        try:
            tree = ast.parse(code_content)

            # First pass: collect all function definitions
            functions = self.collect_functions(tree)

            # Second pass: create flow diagram
            if functions:
                self.create_function_flows(tree, functions)
            else:
                # If no functions, create main flow
                self.create_main_flow(tree)

            return {
                'nodes': self.nodes,
                'edges': self.edges,
                'file_path': file_path,
                'functions': [f['name'] for f in functions]
            }
        except SyntaxError as e:
            raise Exception(f"Python syntax error: {str(e)}")

    def collect_functions(self, tree):
        """Collect all function definitions"""
        functions = []
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                functions.append({
                    'name': node.name,
                    'node': node,
                    'calls': self.extract_function_calls(node)
                })
        return functions

    def extract_function_calls(self, func_node):
        """Extract function calls within a function"""
        calls = []
        for node in ast.walk(func_node):
            if isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    calls.append(node.func.id)
                elif isinstance(node.func, ast.Attribute):
                    calls.append(f"{ast.unparse(node.func.value) if hasattr(ast, 'unparse') else 'obj'}.{node.func.attr}")
        return calls

    def create_function_flows(self, tree, functions):
        """Create flow diagrams for each function"""
        # Create main entry point
        main_id = self.create_node("Program Start", "start")
        last_main_id = main_id

        # Process each function
        function_nodes = {}
        for func in functions:
            func_id = self.create_node(f"Function: {func['name']}", "function")
            function_nodes[func['name']] = func_id

            # Create function flow
            last_func_id = self.create_function_body_flow(func['node'], func_id)

            # Connect to main flow if it's a main-level function call
            if self.is_main_function_call(tree, func['name']):
                self.edges.append({'from': last_main_id, 'to': func_id})
                last_main_id = last_func_id

        # Create end node
        self.create_node("Program End", "end", last_main_id)

        # Add function call connections
        self.add_function_call_edges(functions, function_nodes)

    def create_function_body_flow(self, func_node, func_start_id):
        """Create flow for function body"""
        current_id = func_start_id

        for stmt in func_node.body:
            current_id = self.process_statement(stmt, current_id)

        return current_id

    def process_statement(self, stmt, parent_id):
        """Process individual statements and create meaningful nodes"""
        if isinstance(stmt, ast.If):
            return self.process_if_statement(stmt, parent_id)
        elif isinstance(stmt, ast.For):
            return self.process_for_loop(stmt, parent_id)
        elif isinstance(stmt, ast.While):
            return self.process_while_loop(stmt, parent_id)
        elif isinstance(stmt, ast.Try):
            return self.process_try_statement(stmt, parent_id)
        elif isinstance(stmt, ast.Return):
            return self.process_return_statement(stmt, parent_id)
        elif isinstance(stmt, ast.Call):
            return self.process_function_call(stmt, parent_id)
        elif isinstance(stmt, ast.Assign):
            return self.process_assignment(stmt, parent_id)
        else:
            # Skip less important statements
            return parent_id

    def process_if_statement(self, stmt, parent_id):
        """Process if statements with proper branching"""
        condition = self.get_condition_text(stmt.test)
        if_id = self.create_node(f"If: {condition}", "condition", parent_id)

        # Process if body
        if_body_start = self.create_node("If True", "process")
        self.edges.append({'from': if_id, 'to': if_body_start, 'label': 'Yes'})

        if_body_end = if_body_start
        for child_stmt in stmt.body:
            if_body_end = self.process_statement(child_stmt, if_body_end)

        # Process else body
        if stmt.orelse:
            else_body_start = self.create_node("If False", "process")
            self.edges.append({'from': if_id, 'to': else_body_start, 'label': 'No'})

            else_body_end = else_body_start
            for child_stmt in stmt.orelse:
                else_body_end = self.process_statement(child_stmt, else_body_end)

            # Merge point
            merge_id = self.create_node("Continue", "process")
            self.edges.append({'from': if_body_end, 'to': merge_id})
            self.edges.append({'from': else_body_end, 'to': merge_id})
            return merge_id
        else:
            # No else branch
            merge_id = self.create_node("Continue", "process")
            self.edges.append({'from': if_body_end, 'to': merge_id})
            self.edges.append({'from': if_id, 'to': merge_id, 'label': 'No'})
            return merge_id

    def process_for_loop(self, stmt, parent_id):
        """Process for loops"""
        target = ast.unparse(stmt.target) if hasattr(ast, 'unparse') else "item"
        iter_val = ast.unparse(stmt.iter) if hasattr(ast, 'unparse') else "collection"

        loop_start = self.create_node(f"For {target} in {iter_val}", "condition", parent_id)
        loop_body_start = self.create_node("Loop Body", "process")

        self.edges.append({'from': loop_start, 'to': loop_body_start, 'label': 'Each Item'})

        loop_body_end = loop_body_start
        for child_stmt in stmt.body:
            loop_body_end = self.process_statement(child_stmt, loop_body_end)

        # Loop back
        self.edges.append({'from': loop_body_end, 'to': loop_start, 'label': 'Next'})

        # Exit loop
        loop_exit = self.create_node("Loop Complete", "process")
        self.edges.append({'from': loop_start, 'to': loop_exit, 'label': 'Done'})

        return loop_exit

    def process_while_loop(self, stmt, parent_id):
        """Process while loops"""
        condition = self.get_condition_text(stmt.test)

        loop_start = self.create_node(f"While: {condition}", "condition", parent_id)
        loop_body_start = self.create_node("Loop Body", "process")

        self.edges.append({'from': loop_start, 'to': loop_body_start, 'label': 'True'})

        loop_body_end = loop_body_start
        for child_stmt in stmt.body:
            loop_body_end = self.process_statement(child_stmt, loop_body_end)

        # Loop back
        self.edges.append({'from': loop_body_end, 'to': loop_start})

        # Exit loop
        loop_exit = self.create_node("Loop Exit", "process")
        self.edges.append({'from': loop_start, 'to': loop_exit, 'label': 'False'})

        return loop_exit

    def process_try_statement(self, stmt, parent_id):
        """Process try-except blocks"""
        try_id = self.create_node("Try Block", "process", parent_id)

        try_body_end = try_id
        for child_stmt in stmt.body:
            try_body_end = self.process_statement(child_stmt, try_body_end)

        if stmt.handlers:
            except_id = self.create_node("Exception Handler", "process")
            self.edges.append({'from': try_id, 'to': except_id, 'label': 'Error'})

            except_body_end = except_id
            for handler in stmt.handlers:
                for child_stmt in handler.body:
                    except_body_end = self.process_statement(child_stmt, except_body_end)

            # Merge
            merge_id = self.create_node("Continue", "process")
            self.edges.append({'from': try_body_end, 'to': merge_id})
            self.edges.append({'from': except_body_end, 'to': merge_id})
            return merge_id

        return try_body_end

    def process_return_statement(self, stmt, parent_id):
        """Process return statements"""
        if stmt.value:
            return_text = f"Return: {ast.unparse(stmt.value) if hasattr(ast, 'unparse') else 'value'}"
        else:
            return_text = "Return"

        return self.create_node(return_text, "end", parent_id)

    def process_function_call(self, stmt, parent_id):
        """Process function calls"""
        if isinstance(stmt.func, ast.Name):
            func_name = stmt.func.id
        elif isinstance(stmt.func, ast.Attribute):
            func_name = f"{ast.unparse(stmt.func.value) if hasattr(ast, 'unparse') else 'obj'}.{stmt.func.attr}"
        else:
            func_name = "function"

        return self.create_node(f"Call: {func_name}()", "function", parent_id)

    def process_assignment(self, stmt, parent_id):
        """Process important assignments"""
        if len(stmt.targets) == 1 and isinstance(stmt.targets[0], ast.Name):
            var_name = stmt.targets[0].id
            if isinstance(stmt.value, ast.Call):
                # Assignment from function call
                return self.process_function_call(stmt.value, parent_id)
            elif self.is_important_assignment(var_name, stmt.value):
                assign_text = f"Set {var_name}"
                return self.create_node(assign_text, "process", parent_id)

        return parent_id

    def is_important_assignment(self, var_name, value):
        """Determine if assignment is important enough to show"""
        # Show assignments to important variables or complex expressions
        important_patterns = ['result', 'output', 'data', 'config', 'connection']
        return any(pattern in var_name.lower() for pattern in important_patterns)

    def get_condition_text(self, test_node):
        """Extract readable condition text"""
        if hasattr(ast, 'unparse'):
            condition = ast.unparse(test_node)
            return condition[:50] + "..." if len(condition) > 50 else condition
        else:
            return "condition"

    def create_main_flow(self, tree):
        """Create flow for scripts without functions"""
        start_id = self.create_node("Script Start", "start")
        current_id = start_id

        for stmt in tree.body:
            if not isinstance(stmt, ast.FunctionDef):
                current_id = self.process_statement(stmt, current_id)

        self.create_node("Script End", "end", current_id)

    def is_main_function_call(self, tree, func_name):
        """Check if function is called at module level"""
        for node in tree.body:
            if isinstance(node, ast.Expr) and isinstance(node.value, ast.Call):
                if isinstance(node.value.func, ast.Name) and node.value.func.id == func_name:
                    return True
        return False

    def add_function_call_edges(self, functions, function_nodes):
        """Add edges for function calls between functions"""
        for func in functions:
            if func['name'] in function_nodes:
                for call in func['calls']:
                    if call in function_nodes:
                        # Add dotted edge for function calls
                        self.edges.append({
                            'from': function_nodes[func['name']],
                            'to': function_nodes[call],
                            'label': 'calls',
                            'style': 'dotted'
                        })

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
