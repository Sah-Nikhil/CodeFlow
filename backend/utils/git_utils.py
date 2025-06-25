# backend/utils/git_utils.py
import asyncio
from GitPython import GitCommandError, Repo
import os

async def clone_repository(repo_url: str, target_dir: str):
    """Clones a Git repository to a target directory."""
    if not os.path.exists(target_dir):
        os.makedirs(target_dir)

    # GitPython's clone operation can be blocking, so run in a thread pool executor
    # or use asyncio's loop.run_in_executor for better async integration.
    # For simplicity, using a blocking call for now, but be aware for high concurrency.
    try:
        print(f"Cloning {repo_url} into {target_dir}...")
        repo = await asyncio.to_thread(Repo.clone_from, repo_url, target_dir)
        print(f"Repository cloned successfully: {repo.working_dir}")
    except GitCommandError as e:
        print(f"Git command error: {e}")
        raise ValueError(f"Failed to clone repository: {e.stderr}")
    except Exception as e:
        print(f"An unexpected error occurred during cloning: {e}")
        raise ValueError(f"An unexpected error occurred during cloning: {str(e)}")
