from flask import Flask, render_template, request, jsonify
import os
import json
from parsers.python_parser import EnhancedPythonParser
from parsers.cpp_parser import CppParser
from parsers.typescript_parser import TypeScriptParser

app = Flask(__name__)

class CodeFlowApp:
    def __init__(self):
        self.parsers = {
            'python': EnhancedPythonParser(),
            'cpp': CppParser(),
            'typescript': TypeScriptParser()
        }

    def detect_language(self, file_path):
        """Detect programming language from file extension"""
        ext = os.path.splitext(file_path)[1].lower()
        if ext in ['.py']:
            return 'python'
        elif ext in ['.cpp', '.c', '.cc', '.cxx', '.h', '.hpp']:
            return 'cpp'
        elif ext in ['.ts', '.js', '.tsx', '.jsx']:
            return 'typescript'
        return None

    def analyze_code(self, file_path, code_content=None):
        """Analyze code and generate flow diagram data"""
        if code_content:
            language = self.detect_language(file_path) or 'python'
        else:
            language = self.detect_language(file_path)
            if not language:
                return {'error': 'Unsupported file type'}

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    code_content = f.read()
            except Exception as e:
                return {'error': f'Error reading file: {str(e)}'}

        parser = self.parsers.get(language)
        if not parser:
            return {'error': f'No parser available for {language}'}

        try:
            flow_data = parser.parse(code_content, file_path)
            return {
                'language': language,
                'flow_data': flow_data,
                'mermaid_code': self.generate_function_flow_mermaid(flow_data),
                'detailed_mermaid': self.generate_detailed_mermaid(flow_data)
            }
        except Exception as e:
            return {'error': f'Parsing error: {str(e)}'}

    def generate_function_flow_mermaid(self, flow_data):
        """Generate a high-level function flow diagram"""
        mermaid_code = "flowchart TD\n"

        # Extract functions and their relationships
        functions = self.extract_function_info(flow_data)

        if not functions:
            return self.generate_simple_sequential_flow(flow_data)

        # Add styling
        mermaid_code += """
    classDef main fill:#e1f5fe,stroke:#01579b,stroke-width:3px
    classDef func fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px
    classDef decision fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef important fill:#ffebee,stroke:#c62828,stroke-width:2px

"""

        # Add main entry point
        mermaid_code += "    MAIN([Main Program])\n"
        mermaid_code += "    class MAIN main\n"

        # Add function nodes
        for func in functions:
            safe_name = self.make_safe_id(func['name'])
            mermaid_code += f"    {safe_name}[{func['name']}]\n"
            mermaid_code += f"    class {safe_name} func\n"

            # Add decision points within function if any
            if func['has_conditions']:
                decision_id = f"{safe_name}_LOGIC"
                mermaid_code += f"    {decision_id}{{{func['name']} Decision Logic}}\n"
                mermaid_code += f"    class {decision_id} decision\n"
                mermaid_code += f"    {safe_name} --> {decision_id}\n"

                # Add return path
                return_id = f"{safe_name}_RETURN"
                mermaid_code += f"    {return_id}[Return from {func['name']}]\n"
                mermaid_code += f"    class {return_id} important\n"
                mermaid_code += f"    {decision_id} --> {return_id}\n"

        # Add function call relationships
        if functions:
            mermaid_code += f"    MAIN --> {functions[0]['safe_name']}\n"

            # Connect functions based on call relationships
            for func in functions:
                for called_func in func['calls']:
                    called_safe_name = self.make_safe_id(called_func)
                    if any(f['safe_name'] == called_safe_name for f in functions):
                        mermaid_code += f"    {func['safe_name']} -.->|calls| {called_safe_name}\n"

        # Add end
        mermaid_code += "    END([Program End])\n"
        mermaid_code += "    class END main\n"

        if functions:
            # Connect last function to end
            last_func = functions[-1]
            if last_func['has_conditions']:
                return_id = f"{last_func['safe_name']}_RETURN"
                mermaid_code += f"    {return_id} --> END\n"
            else:
                mermaid_code += f"    {last_func['safe_name']} --> END\n"
        else:
            mermaid_code += "    MAIN --> END\n"

        return mermaid_code

    def extract_function_info(self, flow_data):
        """Extract function information from flow data"""
        functions = []

        for node in flow_data.get('nodes', []):
            if node['type'] == 'function' and 'Function:' in node['label']:
                func_name = node['label'].replace('Function: ', '').strip()

                # Skip if already processed
                if any(f['name'] == func_name for f in functions):
                    continue

                # Check if this function has conditions
                has_conditions = any(
                    n['type'] == 'condition' for n in flow_data.get('nodes', [])
                    if self.is_node_in_function(n, func_name, flow_data)
                )

                # Extract function calls within this function
                function_calls = self.extract_function_calls_for_function(func_name, flow_data)

                functions.append({
                    'name': func_name,
                    'safe_name': self.make_safe_id(func_name),
                    'has_conditions': has_conditions,
                    'node_id': node['id'],
                    'calls': function_calls
                })

        return functions

    def is_node_in_function(self, node, func_name, flow_data):
        """Check if a node belongs to a specific function"""
        # This is a simplified check - in a more sophisticated parser,
        # you'd track function scope more precisely
        return True  # For now, assume all nodes could be in any function

    def extract_function_calls_for_function(self, func_name, flow_data):
        """Extract function calls made by a specific function"""
        calls = []

        for node in flow_data.get('nodes', []):
            if node['type'] == 'function' and 'Call:' in node['label']:
                call_name = node['label'].replace('Call: ', '').replace('()', '').strip()
                # Filter out built-in functions and methods
                if not self.is_builtin_function(call_name):
                    calls.append(call_name)

        return list(set(calls))  # Remove duplicates

    def is_builtin_function(self, func_name):
        """Check if function is a built-in or library function"""
        builtins = ['print', 'len', 'str', 'int', 'float', 'list', 'dict', 'set',
                   'range', 'enumerate', 'zip', 'open', 'close', 'get', 'append',
                   'Toplevel', 'Label', 'Entry', 'Button', 'Frame', 'Canvas']
        return any(builtin in func_name for builtin in builtins)

    def generate_simple_sequential_flow(self, flow_data):
        """Generate simple sequential flow for scripts without functions"""
        mermaid_code = "flowchart TD\n"
        mermaid_code += """
    classDef start fill:#e1f5fe,stroke:#01579b,stroke-width:3px
    classDef process fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef condition fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef end fill:#ffebee,stroke:#c62828,stroke-width:3px

"""

        mermaid_code += "    START([Script Start])\n"
        mermaid_code += "    class START start\n"

        # Add main processing steps
        step_count = 1
        prev_node = "START"

        # Only include meaningful nodes
        meaningful_nodes = [node for node in flow_data.get('nodes', [])
                          if self.is_meaningful_node(node)]

        for node in meaningful_nodes[:5]:  # Limit to first 5 meaningful steps
            step_id = f"STEP{step_count}"
            label = self.clean_label(node['label'])

            if node['type'] == 'condition':
                mermaid_code += f"    {step_id}{{{label}}}\n"
                mermaid_code += f"    class {step_id} condition\n"
            else:
                mermaid_code += f"    {step_id}[{label}]\n"
                mermaid_code += f"    class {step_id} process\n"

            mermaid_code += f"    {prev_node} --> {step_id}\n"
            prev_node = step_id
            step_count += 1

        mermaid_code += "    END([Script End])\n"
        mermaid_code += "    class END end\n"
        mermaid_code += f"    {prev_node} --> END\n"

        return mermaid_code

    def is_meaningful_node(self, node):
        """Check if a node represents meaningful program flow"""
        label = node['label'].lower()

        # Skip generic nodes
        skip_patterns = ['import', 'assign', 'expr', 'continue', 'merge']
        if any(pattern in label for pattern in skip_patterns):
            return False

        # Include important flow control
        if node['type'] in ['condition', 'function']:
            return True

        # Include specific important operations
        important_patterns = ['try block', 'exception', 'return', 'call:', 'if:', 'for:', 'while:']
        return any(pattern in label for pattern in important_patterns)

    def generate_detailed_mermaid(self, flow_data):
        """Generate detailed Mermaid flowchart (original version)"""
        mermaid_code = "flowchart TD\n"

        # Add custom styling
        mermaid_code += """
    classDef startEnd fill:#e1f5fe,stroke:#01579b,stroke-width:3px,color:#000
    classDef process fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000
    classDef condition fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000
    classDef function fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px,color:#000

"""

        # Add nodes with better formatting
        for node in flow_data.get('nodes', []):
            node_id = self.make_safe_id(node['id'])
            label = self.clean_label(node['label'])
            node_type = node.get('type', 'process')

            if node_type == 'start' or node_type == 'end':
                mermaid_code += f"    {node_id}([{label}])\n"
                mermaid_code += f"    class {node_id} startEnd\n"
            elif node_type == 'condition':
                mermaid_code += f"    {node_id}{{{label}}}\n"
                mermaid_code += f"    class {node_id} condition\n"
            elif node_type == 'function':
                mermaid_code += f"    {node_id}[{label}]\n"
                mermaid_code += f"    class {node_id} function\n"
            else:
                mermaid_code += f"    {node_id}[{label}]\n"
                mermaid_code += f"    class {node_id} process\n"

        # Add edges with labels
        for edge in flow_data.get('edges', []):
            from_node = self.make_safe_id(edge['from'])
            to_node = self.make_safe_id(edge['to'])
            label = edge.get('label', '')
            style = edge.get('style', 'solid')

            if style == 'dotted':
                if label:
                    mermaid_code += f"    {from_node} -.->|{label}| {to_node}\n"
                else:
                    mermaid_code += f"    {from_node} -.-> {to_node}\n"
            else:
                if label:
                    mermaid_code += f"    {from_node} -->|{label}| {to_node}\n"
                else:
                    mermaid_code += f"    {from_node} --> {to_node}\n"

        return mermaid_code

    def make_safe_id(self, node_id):
        """Make node ID safe for Mermaid"""
        # Replace problematic characters
        safe_id = str(node_id).replace('-', '_').replace(' ', '_').replace(':', '_').replace('.', '_')
        # Remove parentheses and other special characters
        safe_id = ''.join(c for c in safe_id if c.isalnum() or c == '_')
        # Ensure it starts with a letter
        if not safe_id or not safe_id[0].isalpha():
            safe_id = 'n' + safe_id
        return safe_id

    def clean_label(self, label):
        """Clean and format labels for Mermaid"""
        # Remove quotes and limit length
        cleaned = str(label).replace('"', "'").replace('\n', ' ').strip()
        if len(cleaned) > 30:
            cleaned = cleaned[:27] + "..."
        return cleaned

# Rest of your Flask routes remain the same
code_flow_app = CodeFlowApp()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json()

    if 'code' in data:
        result = code_flow_app.analyze_code('temp.py', data['code'])
    elif 'file_path' in data:
        result = code_flow_app.analyze_code(data['file_path'])
    else:
        result = {'error': 'No code or file path provided'}

    return jsonify(result)

@app.route('/analyze_directory', methods=['POST'])
def analyze_directory():
    data = request.get_json()
    directory_path = data.get('directory_path', '')

    if not os.path.exists(directory_path):
        return jsonify({'error': 'Directory does not exist'})

    results = []
    supported_extensions = ['.py', '.cpp', '.c', '.cc', '.cxx', '.h', '.hpp', '.ts', '.js', '.tsx', '.jsx']

    for root, dirs, files in os.walk(directory_path):
        for file in files:
            if any(file.endswith(ext) for ext in supported_extensions):
                file_path = os.path.join(root, file)
                result = code_flow_app.analyze_code(file_path)
                result['file_path'] = file_path
                results.append(result)

    return jsonify({'results': results})

if __name__ == '__main__':
    app.run(debug=True, host='localhost', port=5000)
