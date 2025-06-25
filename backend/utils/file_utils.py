# backend/utils/file_utils.py
import os
import fnmatch

# Define common ignore patterns
COMMON_IGNORE_PATTERNS = [
    "node_modules", ".git", ".next", ".venv", "__pycache__",
    "*.pyc", "*.log", ".env", ".DS_Store", "package-lock.json",
    "yarn.lock"
]

def should_ignore_path(path: str, is_dir: bool = False) -> bool:
    """
    Checks if a given path (file or directory) should be ignored based on common patterns.
    This does not parse .gitignore files yet, but can be extended.
    """
    basename = os.path.basename(path)

    # Check common ignore directories
    if is_dir and basename in [".git", ".next", "node_modules", ".venv", "__pycache__"]:
        return True

    # Check common ignore files/patterns
    for pattern in COMMON_IGNORE_PATTERNS:
        if fnmatch.fnmatch(basename, pattern):
            return True

    return False

def get_files_in_path(root_dir: str):
    """
    Recursively gets all relevant files in a directory, respecting ignore rules.
    This function is primarily for demonstrating and less for the main flow as
    os.walk already traverses and the main.py filters.
    """
    for root, dirs, files in os.walk(root_dir):
        # Filter directories in place for os.walk to skip them
        dirs[:] = [d for d in dirs if not should_ignore_path(os.path.join(root, d), is_dir=True)]

        for file in files:
            file_path = os.path.join(root, file)
            if not should_ignore_path(file_path, is_dir=False):
                yield file_path
