from flask import Flask, render_template, request, jsonify
import os
import json
from parsers.python_parser import PythonParser
from parsers.cpp_parser import CppParser
from parsers.typescript_parser import TypeScriptParser

app = Flask(__name__)

class CodeFlowApp:
    def __init__(self):
        self.parsers = {
            'python': PythonParser(),
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
            # Detect language from content or assume based on context
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
                'mermaid_code': self.generate_mermaid(flow_data)
            }
        except Exception as e:
            return {'error': f'Parsing error: {str(e)}'}

    def generate_mermaid(self, flow_data):
        """Generate Mermaid flowchart syntax"""
        mermaid_code = "graph TD\n"

        # Add nodes
        for node in flow_data.get('nodes', []):
            node_id = node['id']
            label = node['label'].replace('"', "'")
            node_type = node.get('type', 'process')

            if node_type == 'start':
                mermaid_code += f"    {node_id}([{label}])\n"
            elif node_type == 'end':
                mermaid_code += f"    {node_id}([{label}])\n"
            elif node_type == 'condition':
                mermaid_code += f"    {node_id}{{{label}}}\n"
            elif node_type == 'function':
                mermaid_code += f"    {node_id}[{label}]\n"
            else:
                mermaid_code += f"    {node_id}[{label}]\n"

        # Add edges
        for edge in flow_data.get('edges', []):
            from_node = edge['from']
            to_node = edge['to']
            label = edge.get('label', '')

            if label:
                mermaid_code += f"    {from_node} -->|{label}| {to_node}\n"
            else:
                mermaid_code += f"    {from_node} --> {to_node}\n"

        return mermaid_code

code_flow_app = CodeFlowApp()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json()

    if 'code' in data:
        # Analyze code from text input
        result = code_flow_app.analyze_code('temp.py', data['code'])
    elif 'file_path' in data:
        # Analyze code from file path
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
