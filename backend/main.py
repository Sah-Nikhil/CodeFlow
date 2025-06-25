# backend/main.py
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import os
import shutil
import tempfile

from .parser.tree_sitter_parser import parse_repository
from .utils.git_utils import clone_repository
from .utils.file_utils import get_files_in_path, should_ignore_path

app = FastAPI()

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], # Replace with your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/analyze")
async def analyze_codebase(
    repo_url: Optional[str] = Form(None),
    local_path: Optional[str] = Form(None)
):
    """
    Analyzes a GitHub repository or a local directory and returns its structure.
    """
    if not repo_url and not local_path:
        raise HTTPException(status_code=400, detail="Either 'repo_url' or 'local_path' must be provided.")

    temp_dir = None
    target_path = None

    try:
        if repo_url:
            temp_dir = tempfile.mkdtemp()
            await clone_repository(repo_url, temp_dir)
            target_path = temp_dir
            print(f"Cloned {repo_url} to {temp_dir}")
        elif local_path:
            if not os.path.isdir(local_path):
                raise HTTPException(status_code=400, detail=f"Local path '{local_path}' does not exist or is not a directory.")
            target_path = local_path
            print(f"Analyzing local path: {local_path}")

        if not target_path:
            raise HTTPException(status_code=500, detail="Could not determine target path for analysis.")

        # Get all relevant files, respecting ignore rules
        all_files = []
        for root, _, files in os.walk(target_path):
            if should_ignore_path(root, is_dir=True):
                continue
            for file_name in files:
                file_path = os.path.join(root, file_name)
                if not should_ignore_path(file_path, is_dir=False):
                    all_files.append(file_path)

        # Parse the files
        graph_data = await parse_repository(target_path, all_files)
        return graph_data
    except Exception as e:
        print(f"An error occurred: {e}")
        raise HTTPException(status_code=500, detail=f"An error occurred during analysis: {str(e)}")
    finally:
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
            print(f"Cleaned up temporary directory: {temp_dir}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
