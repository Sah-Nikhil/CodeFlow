// Initialize Mermaid
mermaid.initialize({ startOnLoad: true });

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

    // Display Mermaid code
    document.getElementById('mermaid-output').value = data.mermaid_code;

    // Render diagram
    const diagramOutput = document.getElementById('diagram-output');
    diagramOutput.innerHTML = `<div class="mermaid">${data.mermaid_code}</div>`;

    // Re-initialize Mermaid for the new diagram
    mermaid.init(undefined, diagramOutput.querySelector('.mermaid'));
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
    .then(response => response.json())
    .then(data => displayResults(data))
    .catch(error => {
        console.error('Error:', error);
        showError('An error occurred while analyzing the code.');
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
    .then(response => response.json())
    .then(data => displayResults(data))
    .catch(error => {
        console.error('Error:', error);
        showError('An error occurred while analyzing the file.');
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
    .then(response => response.json())
    .then(data => {
        hideLoading();

        if (data.error) {
            showError(data.error);
            return;
        }

        // Display results for multiple files
        const diagramOutput = document.getElementById('diagram-output');
        let combinedMermaid = '';

        data.results.forEach((result, index) => {
            if (!result.error) {
                combinedMermaid += `\n\n<!-- File: ${result.file_path} -->\n${result.mermaid_code}`;
            }
        });

        document.getElementById('mermaid-output').value = combinedMermaid;

        // For directory analysis, show a summary
        diagramOutput.innerHTML = `
            <h4>Directory Analysis Complete</h4>
            <p>Analyzed ${data.results.length} files</p>
            <p>Check the Mermaid code section for combined results</p>
        `;
    })
    .catch(error => {
        console.error('Error:', error);
        showError('An error occurred while analyzing the directory.');
    });
}

function copyMermaidCode() {
    const mermaidOutput = document.getElementById('mermaid-output');
    mermaidOutput.select();
    document.execCommand('copy');

    // Show feedback
    const button = event.target;
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    setTimeout(() => {
        button.textContent = originalText;
    }, 2000);
}
// Initialize Mermaid
mermaid.initialize({ startOnLoad: true });

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

    // Display Mermaid code
    document.getElementById('mermaid-output').value = data.mermaid_code;

    // Render diagram
    const diagramOutput = document.getElementById('diagram-output');
    diagramOutput.innerHTML = `<div class="mermaid">${data.mermaid_code}</div>`;

    // Re-initialize Mermaid for the new diagram
    mermaid.init(undefined, diagramOutput.querySelector('.mermaid'));
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
    .then(response => response.json())
    .then(data => displayResults(data))
    .catch(error => {
        console.error('Error:', error);
        showError('An error occurred while analyzing the code.');
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
    .then(response => response.json())
    .then(data => displayResults(data))
    .catch(error => {
        console.error('Error:', error);
        showError('An error occurred while analyzing the file.');
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
    .then(response => response.json())
    .then(data => {
        hideLoading();

        if (data.error) {
            showError(data.error);
            return;
        }

        // Display results for multiple files
        const diagramOutput = document.getElementById('diagram-output');
        let combinedMermaid = '';

        data.results.forEach((result, index) => {
            if (!result.error) {
                combinedMermaid += `\n\n<!-- File: ${result.file_path} -->\n${result.mermaid_code}`;
            }
        });

        document.getElementById('mermaid-output').value = combinedMermaid;

        // For directory analysis, show a summary
        diagramOutput.innerHTML = `
            <h4>Directory Analysis Complete</h4>
            <p>Analyzed ${data.results.length} files</p>
            <p>Check the Mermaid code section for combined results</p>
        `;
    })
    .catch(error => {
        console.error('Error:', error);
        showError('An error occurred while analyzing the directory.');
    });
}

function copyMermaidCode() {
    const mermaidOutput = document.getElementById('mermaid-output');
    mermaidOutput.select();
    document.execCommand('copy');

    // Show feedback
    const button = event.target;
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    setTimeout(() => {
        button.textContent = originalText;
    }, 2000);
}
