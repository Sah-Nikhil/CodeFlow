# backend/parser/build_grammars.py
import os
from tree_sitter import Language

# Define the path where the shared library will be created
BUILD_DIR = os.path.join(os.path.dirname(__file__), 'build')
SHARED_LIBRARY_PATH = os.path.join(BUILD_DIR, 'languages.so')

# Define the paths to your grammar repositories
GRAMMAR_PATHS = [
    os.path.join(os.path.dirname(__file__), 'grammars', 'tree-sitter-javascript'),
    os.path.join(os.path.dirname(__file__), 'grammars', 'tree-sitter-typescript', 'typescript'), # For .ts files
    os.path.join(os.path.dirname(__file__), 'grammars', 'tree-sitter-typescript', 'tsx'),        # For .tsx files
    os.path.join(os.path.dirname(__file__), 'grammars', 'tree-sitter-python'),
]

def build_tree_sitter_grammars():
    """
    Builds the Tree-sitter shared library from the cloned grammar repositories.
    """
    if not os.path.exists(BUILD_DIR):
        os.makedirs(BUILD_DIR)
        print(f"Created build directory: {BUILD_DIR}")

    print(f"Attempting to build grammars to: {SHARED_LIBRARY_PATH}")
    print("Grammar source paths:")
    for path in GRAMMAR_PATHS:
        print(f"  - {path}")
        if not os.path.exists(path):
            print(f"    WARNING: Path does not exist: {path}")
            # You might want to raise an error here if a grammar path is missing
            # or ensure your cloning steps were successful.

    try:
        # The correct way to call build_library depends heavily on tree-sitter version.
        # This is the most common and current method for recent versions (post 0.20)
        # It's a method of the Language class, as originally thought, but accessed
        # through the module itself.

        # If previous attempts with Language.build_library failed,
        # it might be due to a very specific sub-version or build.
        # Let's try the common syntax again in a script where imports are clearer.

        # This assumes Language.build_library is available and accepts the paths.
        # If this fails, we will explicitly try a fallback.
        Language.build_library(SHARED_LIBRARY_PATH, GRAMMAR_PATHS)
        print("Tree-sitter grammars built successfully!")

    except AttributeError:
        print("Error: Language.build_library method not found. This might be due to a tree-sitter version issue.")
        print("Falling back to a more direct, lower-level compilation if possible (not implemented here).")
        print("Please ensure you have a C/C++ compiler (e.g., GCC, Clang, MSVC) installed and in your PATH.")
        print("For Windows, install 'Build Tools for Visual Studio' with C++ desktop development.")
        print("For Linux/macOS, install 'build-essential' (Linux) or Xcode Command Line Tools (macOS).")
        import sys
        sys.exit(1)
    except Exception as e:
        print(f"An unexpected error occurred during grammar compilation: {e}")
        print("Please ensure you have a C/C++ compiler (e.g., GCC, Clang, MSVC) installed and in your PATH.")
        print("For Windows, install 'Build Tools for Visual Studio' with C++ desktop development.")
        print("For Linux/macOS, install 'build-essential' (Linux) or Xcode Command Line Tools (macOS).")
        import sys
        sys.exit(1)


if __name__ == "__main__":
    build_tree_sitter_grammars()
