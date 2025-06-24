// Initialize Mermaid with better configuration
mermaid.initialize({
    startOnLoad: true,
    theme: 'default',
    flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis'
    },
    themeVariables: {
        primaryColor: '#e1f5fe',
        primaryTextColor: '#000',
        primaryBorderColor: '#01579b',
        lineColor: '#333',
        secondaryColor: '#f3e5f5',
        tertiaryColor: '#fff3e0'
    }
});

// Global variables to store diagram data
window.currentSimplified = '';
window.currentDetailed = '';
window.currentFlowData = null;

function showTab(tabId) {
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => content.classList.remove('active'));

    // Remove active class from all buttons
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => button.classList.remove('active'));

    // Show selected tab
    document.getElementById(tabId).classList.add('active');

    // Add active class to clicked button
    event.target.classList.add('active');
}

function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('error-message').classList.add('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function showError(message) {
    const errorElement = document.getElementById('error-message');
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
    hideLoading();
}

function displayResults(data) {
    hideLoading();

    if (data.error) {
        showError(data.error);
        return;
    }

    // Store both versions globally
    window.currentSimplified = data.mermaid_code;
    window.currentDetailed = data.detailed_mermaid || data.mermaid_code;
    window.currentFlowData = data.flow_data;

    // Display simplified Mermaid code by default
    document.getElementById('mermaid-output').value = window.currentSimplified;

    // Create diagram output with controls
    const diagramOutput = document.getElementById('diagram-output');
    diagramOutput.innerHTML = `
        <div class="diagram-controls">
            <button id="simplified-btn" class="diagram-btn active" onclick="showSimplified()">
                📊 Simplified View
            </button>
            <button id="detailed-btn" class="diagram-btn" onclick="showDetailed()">
                🔍 Detailed View
            </button>
            <button id="function-btn" class="diagram-btn" onclick="showFunctionOnly()">
                ⚡ Functions Only
            </button>
        </div>
        <div class="diagram-info">
            <p><strong>Language:</strong> ${data.language}</p>
            <p><strong>Functions Found:</strong> ${data.flow_data.functions ? data.flow_data.functions.length : 0}</p>
        </div>
        <div id="simplified-diagram" class="mermaid-container">
            <div class="mermaid">${window.currentSimplified}</div>
        </div>
        <div id="detailed-diagram" class="mermaid-container" style="display:none">
            <div class="mermaid">${window.currentDetailed}</div>
        </div>
        <div id="function-diagram" class="mermaid-container" style="display:none">
            <div class="mermaid" id="function-only-content"></div>
        </div>
    `;

    // Re-initialize Mermaid for the new diagram
    try {
        mermaid.init(undefined, diagramOutput.querySelector('#simplified-diagram .mermaid'));
    } catch (error) {
        console.error('Mermaid rendering error:', error);
        showError('Error rendering diagram. Please check the Mermaid code syntax.');
    }
}

function showSimplified() {
    // Update button states
    updateButtonStates('simplified-btn');

    // Show/hide diagrams
    document.getElementById('simplified-diagram').style.display = 'block';
    document.getElementById('detailed-diagram').style.display = 'none';
    document.getElementById('function-diagram').style.display = 'none';

    // Update mermaid output
    document.getElementById('mermaid-output').value = window.currentSimplified;
}

function showDetailed() {
    // Update button states
    updateButtonStates('detailed-btn');

    // Show/hide diagrams
    document.getElementById('simplified-diagram').style.display = 'none';
    document.getElementById('detailed-diagram').style.display = 'block';
    document.getElementById('function-diagram').style.display = 'none';

    // Initialize detailed diagram if not already done
    const detailedDiagram = document.getElementById('detailed-diagram').querySelector('.mermaid');
    if (!detailedDiagram.hasAttribute('data-processed')) {
        try {
            mermaid.init(undefined, detailedDiagram);
        } catch (error) {
            console.error('Detailed diagram rendering error:', error);
        }
    }

    // Update mermaid output
    document.getElementById('mermaid-output').value = window.currentDetailed;
}

function showFunctionOnly() {
    // Update button states
    updateButtonStates('function-btn');

    // Generate function-only diagram
    const functionOnlyCode = generateFunctionOnlyDiagram(window.currentFlowData);

    // Show/hide diagrams
    document.getElementById('simplified-diagram').style.display = 'none';
    document.getElementById('detailed-diagram').style.display = 'none';
    document.getElementById('function-diagram').style.display = 'block';

    // Update function diagram content
    const functionDiagramContent = document.getElementById('function-only-content');
    functionDiagramContent.innerHTML = functionOnlyCode;
    functionDiagramContent.removeAttribute('data-processed');

    try {
        mermaid.init(undefined, functionDiagramContent);
    } catch (error) {
        console.error('Function diagram rendering error:', error);
    }

    // Update mermaid output
    document.getElementById('mermaid-output').value = functionOnlyCode;
}

function generateFunctionOnlyDiagram(flowData) {
    if (!flowData || !flowData.functions || flowData.functions.length === 0) {
        return `flowchart TD
    START([No Functions Found])
    class START startEnd`;
    }

    let mermaidCode = "flowchart TD\n";
    mermaidCode += `
    classDef startEnd fill:#e1f5fe,stroke:#01579b,stroke-width:3px
    classDef function fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px
    classDef highlight fill:#ffebee,stroke:#c62828,stroke-width:2px

`;

    // Add start node
    mermaidCode += "    START([Program Entry])\n";
    mermaidCode += "    class START startEnd\n";

    // Add function nodes
    const functions = flowData.functions;
    for (let i = 0; i < functions.length; i++) {
        const funcName = functions[i].replace(/[^a-zA-Z0-9]/g, '_');
        mermaidCode += `    FUNC_${i}[${functions[i]}]\n`;
        mermaidCode += `    class FUNC_${i} function\n`;

        if (i === 0) {
            mermaidCode += `    START --> FUNC_${i}\n`;
        } else {
            mermaidCode += `    FUNC_${i-1} --> FUNC_${i}\n`;
        }
    }

    // Add end node
    mermaidCode += "    END([Program Exit])\n";
    mermaidCode += "    class END startEnd\n";
    mermaidCode += `    FUNC_${functions.length - 1} --> END\n`;

    return mermaidCode;
}

function updateButtonStates(activeButtonId) {
    // Remove active class from all buttons
    document.querySelectorAll('.diagram-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Add active class to clicked button
    document.getElementById(activeButtonId).classList.add('active');
}

function analyzeCode() {
    const code = document.getElementById('code-input').value.trim();

    if (!code) {
        showError('Please enter some code to analyze.');
        return;
    }

    showLoading();

    fetch('/analyze', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: code })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => displayResults(data))
    .catch(error => {
        console.error('Error:', error);
        showError('An error occurred while analyzing the code. Please check your input and try again.');
    });
}

function analyzeFile() {
    const filePath = document.getElementById('file-path').value.trim();

    if (!filePath) {
        showError('Please enter a file path.');
        return;
    }

    showLoading();

    fetch('/analyze', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file_path: filePath })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => displayResults(data))
    .catch(error => {
        console.error('Error:', error);
        showError('An error occurred while analyzing the file. Please check the file path and try again.');
    });
}

function analyzeDirectory() {
    const directoryPath = document.getElementById('directory-path').value.trim();

    if (!directoryPath) {
        showError('Please enter a directory path.');
        return;
    }

    showLoading();

    fetch('/analyze_directory', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory_path: directoryPath })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        hideLoading();

        if (data.error) {
            showError(data.error);
            return;
        }

        displayDirectoryResults(data.results);
    })
    .catch(error => {
        console.error('Error:', error);
        showError('An error occurred while analyzing the directory. Please check the directory path and try again.');
    });
}

function displayDirectoryResults(results) {
    const diagramOutput = document.getElementById('diagram-output');
    let combinedMermaid = '';
    let fileCount = 0;
    let totalFunctions = 0;

    // Create directory summary
    let summaryHtml = `
        <div class="directory-summary">
            <h3>Directory Analysis Summary</h3>
            <div class="summary-stats">
    `;

    results.forEach((result, index) => {
        if (!result.error) {
            fileCount++;
            const fileName = result.file_path.split('\\').pop() || result.file_path.split('/').pop();
            const functionCount = result.flow_data.functions ? result.flow_data.functions.length : 0;
            totalFunctions += functionCount;

            summaryHtml += `
                <div class="file-summary">
                    <strong>${fileName}</strong> - ${functionCount} functions
                    <button onclick="showFileDetails(${index})" class="small-btn">View Details</button>
                </div>
            `;

            combinedMermaid += `\n\n<!-- File: ${result.file_path} -->\n${result.mermaid_code}`;
        }
    });

    summaryHtml += `
            </div>
            <div class="total-stats">
                <p><strong>Total Files:</strong> ${fileCount}</p>
                <p><strong>Total Functions:</strong> ${totalFunctions}</p>
            </div>
        </div>
    `;

    diagramOutput.innerHTML = summaryHtml;
    document.getElementById('mermaid-output').value = combinedMermaid;

    // Store results for individual file viewing
    window.directoryResults = results;
}

function showFileDetails(index) {
    const result = window.directoryResults[index];
    if (result && !result.error) {
        displayResults(result);
    }
}

function copyMermaidCode() {
    const mermaidOutput = document.getElementById('mermaid-output');
    mermaidOutput.select();
    mermaidOutput.setSelectionRange(0, 99999); // For mobile devices

    try {
        document.execCommand('copy');

        // Show feedback
        const button = event.target;
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        button.style.backgroundColor = '#4caf50';

        setTimeout(() => {
            button.textContent = originalText;
            button.style.backgroundColor = '';
        }, 2000);
    } catch (err) {
        console.error('Failed to copy text: ', err);
        showError('Failed to copy to clipboard. Please select and copy manually.');
    }
}

function exportDiagram(format) {
    const mermaidCode = document.getElementById('mermaid-output').value;

    if (!mermaidCode.trim()) {
        showError('No diagram to export. Please generate a diagram first.');
        return;
    }

    if (format === 'mermaid') {
        // Download as .mmd file
        const blob = new Blob([mermaidCode], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'flowchart.mmd';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } else if (format === 'svg') {
        // This would require server-side conversion or client-side SVG generation
        showError('SVG export not implemented yet. Please copy the Mermaid code and use the Mermaid Live Editor.');
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    // Ctrl+Enter to analyze code
    if (event.ctrlKey && event.key === 'Enter') {
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab.id === 'code-tab') {
            analyzeCode();
        } else if (activeTab.id === 'file-tab') {
            analyzeFile();
        } else if (activeTab.id === 'directory-tab') {
            analyzeDirectory();
        }
        event.preventDefault();
    }
});

// Auto-resize textarea
document.addEventListener('DOMContentLoaded', function() {
    const codeInput = document.getElementById('code-input');
    if (codeInput) {
        codeInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
    }
});
