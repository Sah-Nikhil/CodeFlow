# Code Flow Diagram Generator

A local Windows application that generates flow diagrams from Python, C++, and TypeScript code.

## Installation

1. Install Python 3.7+ from https://python.org
2. Open Command Prompt as Administrator
3. Navigate to the project directory
4. Install dependencies:
```shell
pip install -r requirements.txt
```

## Running the Application

1. Open Command Prompt
2. Navigate to the project directory
3. Run:
```shell
python app.py
```
5. Open your browser and go to: http://localhost:5000

## Usage

- **Code Input**: Paste code directly into the text area
- **File Upload**: Enter the full path to a code file
- **Directory Analysis**: Enter a directory path to analyze all supported files

## Supported File Types

- Python: `.py`
- C++: `.cpp, .c, .cc, .cxx, .h, .hpp`
- TypeScript/JavaScript: `.ts, .js, .tsx, .jsx`

## Features

- Real-time flow diagram generation
- Mermaid.js integration for beautiful diagrams
- Support for functions, conditionals, loops
- Batch directory processing
- Export Mermaid code for external use

