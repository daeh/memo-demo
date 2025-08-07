#!/usr/bin/env python3
"""Development deploy script to export a clean version of the repository to memo-demo-dev.

This script exports the repository using gitattributes, builds the project,
and handles committing and pushing to the test repository (memo-demo-test).
"""

import shutil
import subprocess
import sys

from pathlib import Path
from typing import Optional


def run_command(
    cmd: list[str], cwd: Path | None = None, check: bool = True, silent: bool = False, text: bool = True
) -> subprocess.CompletedProcess:
    """Run a command and return the result."""
    if not silent:
        print(f"Running: {' '.join(cmd)}")

    result = subprocess.run(cmd, cwd=cwd, check=False, capture_output=True, text=text)

    if result.returncode != 0:
        if not silent:
            print(f"❌ Command failed with return code {result.returncode}")
            if result.stderr:
                stderr_output = result.stderr if text else result.stderr.decode('utf-8', errors='replace')
                print(f"Error: {stderr_output}")
        if check:
            raise subprocess.CalledProcessError(result.returncode, cmd, result.stdout, result.stderr)

    return result


def get_git_status_details(repo_path: Path) -> dict[str, list[str]]:
    """Get detailed git status information."""
    result = run_command(["git", "status", "--porcelain"], cwd=repo_path, silent=True)
    status = {
        "modified": [],
        "added": [],
        "deleted": [],
        "renamed": [],
        "untracked": [],
    }

    for line in result.stdout.strip().split("\n"):
        if not line:
            continue
        
        # Git porcelain format is reliable:
        # First two characters are status codes (XY)
        # Third character is always a space
        # Rest is the filename
        # Use regex or just be very explicit
        parts = line.split(None, 1)  # Split on first whitespace only
        if len(parts) != 2:
            continue
            
        status_code = parts[0]
        filename = parts[1]
        
        # Handle the status codes properly
        if len(status_code) >= 1:
            if "M" in status_code:
                status["modified"].append(filename)
            elif "A" in status_code:
                status["added"].append(filename)
            elif "D" in status_code:
                status["deleted"].append(filename)
            elif "R" in status_code:
                status["renamed"].append(filename)
            elif status_code == "??":
                status["untracked"].append(filename)

    return status


def check_uncommitted_files(repo_path: Path) -> list[str]:
    """Check for uncommitted files in the repository, ignoring ./docs directory."""
    status = get_git_status_details(repo_path)

    uncommitted = []
    for status_type, files in status.items():
        for file in files:
            file_path = Path(file)
            # Ignore files in ./docs directory
            if file_path.parts and file_path.parts[0] == "docs":
                continue
            uncommitted.append(file)

    return uncommitted


def get_current_branch(repo_path: Path) -> str:
    """Get the current git branch."""
    result = run_command(["git", "branch", "--show-current"], cwd=repo_path, silent=True)
    return result.stdout.strip()


def get_latest_tag(repo_path: Path) -> str | None:
    """Get the latest git tag."""
    try:
        result = run_command(["git", "describe", "--tags", "--abbrev=0"], cwd=repo_path, check=False, silent=True)
        if result.returncode == 0:
            return result.stdout.strip()
    except subprocess.CalledProcessError:
        pass
    return None


def build_project_check(project_path: Path) -> bool:
    """Run build to verify it works before deployment."""
    print("\n🔨 Running build check...")
    try:
        result = run_command(["task", "build"], cwd=project_path)
        print("✅ Build check passed")
        return True
    except subprocess.CalledProcessError as e:
        print("❌ Build check failed!")
        print(f"Error: {e.stderr if e.stderr else 'Unknown error'}")
        return False


def export_repository(source_path: Path, target_path: Path, ref: str = "HEAD") -> None:
    """Export repository using git archive and gitattributes."""
    # Verify ref exists
    try:
        ref_result = run_command(["git", "rev-parse", ref], cwd=source_path, silent=True)
        ref_commit = ref_result.stdout.strip()[:8]
        print(f"\n📦 Exporting from {ref} (commit {ref_commit})")
    except subprocess.CalledProcessError:
        print(f"❌ Error: ref '{ref}' not found")
        sys.exit(1)

    # Ensure target directory exists
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.mkdir(exist_ok=True)

    # Initialize git if it doesn't exist
    target_git = target_path / ".git"
    if not target_git.exists():
        print("Initializing new git repository in development directory...")
        run_command(["git", "init"], cwd=target_path)
        # Add remote if it doesn't exist
        run_command(["git", "remote", "add", "origin", "https://github.com/daeh/memo-demo-test.git"], 
                   cwd=target_path, check=False, silent=True)
    else:
        print("Using existing git repository")

    # Clean existing files (except .git)
    print("Cleaning existing files (preserving .git)...")
    for item in target_path.iterdir():
        if item.name == ".git":
            continue
        if item.is_dir():
            shutil.rmtree(item)
        else:
            item.unlink()

    # Create archive using git archive (respects .gitattributes)
    print(f"Creating archive from {ref}...")
    archive_cmd = ["git", "archive", "--format=tar", ref]
    archive_result = run_command(archive_cmd, cwd=source_path, text=False)

    # Extract archive to target directory
    extract_cmd = ["tar", "-x"]
    try:
        subprocess.run(extract_cmd, cwd=target_path, input=archive_result.stdout, check=True)
    except subprocess.CalledProcessError as e:
        # This is expected if some files are excluded by gitattributes
        print("Note: Some files may have been excluded by .gitattributes")

    print("✅ Export completed")


def build_project(project_path: Path) -> None:
    """Build the project using task build."""
    print("\n🔨 Building the project...")
    
    # First run uv sync if needed
    if (project_path / "pyproject.toml").exists():
        print("Running uv sync...")
        try:
            result = run_command(["uv", "sync"], cwd=project_path)
            if result.stdout:
                print(result.stdout)
        except subprocess.CalledProcessError as e:
            print("❌ uv sync failed!")
            if e.stdout:
                print(f"Output: {e.stdout}")
            if e.stderr:
                print(f"Error: {e.stderr}")
            sys.exit(1)
    
    # Run task build
    try:
        result = run_command(["task", "build"], cwd=project_path)
        if result.stdout:
            print(result.stdout)
        print("✅ Build completed successfully")
    except subprocess.CalledProcessError as e:
        print("❌ Build failed!")
        if e.stdout:
            print(f"Output: {e.stdout}")
        if e.stderr:
            print(f"Error: {e.stderr}")
        sys.exit(1)


def commit_and_push(repo_path: Path, commit_message: str = None) -> None:
    """Commit changes and push to remote."""
    # Check if there are changes to commit
    status_result = run_command(["git", "status", "--porcelain"], cwd=repo_path, silent=True)
    if not status_result.stdout.strip():
        print("\n✅ No changes to commit.")
        return

    # Show what will be committed
    print("\n📝 Changes to be committed:")
    status = get_git_status_details(repo_path)
    for status_type, files in status.items():
        if files:
            print(f"  {status_type}: {len(files)} file(s)")
            for file in files[:3]:  # Show first 3 files
                print(f"    - {file}")
            if len(files) > 3:
                print(f"    ... and {len(files) - 3} more")

    # Stage all changes
    print("\nStaging all changes...")
    run_command(["git", "add", "-A"], cwd=repo_path)

    # Use provided commit message or generate one
    if not commit_message:
        from datetime import datetime
        commit_message = f"Dev deployment - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    
    print(f"Commit message: {commit_message}")

    # Commit changes
    print("Committing changes...")
    run_command(["git", "commit", "-m", commit_message], cwd=repo_path)

    # Push to remote
    print("\n📤 Pushing to test repository...")
    
    # Check current branch
    branch_result = run_command(["git", "branch", "--show-current"], cwd=repo_path, silent=True)
    current_branch = branch_result.stdout.strip() or "main"
    
    # Try regular push first
    push_result = run_command(["git", "push"], cwd=repo_path, check=False, silent=True)
    
    if push_result.returncode != 0:
        if "no upstream branch" in push_result.stderr.lower():
            print(f"Setting upstream branch and pushing...")
            push_result = run_command(["git", "push", "-u", "origin", current_branch], cwd=repo_path, check=False)
        elif "rejected" in push_result.stderr.lower() or "fetch first" in push_result.stderr.lower():
            print("Remote has diverged. Force pushing...")
            push_result = run_command(["git", "push", "-f", "origin", current_branch], cwd=repo_path, check=False)
        else:
            # Show the error if it's not an expected issue
            push_result = run_command(["git", "push"], cwd=repo_path, check=False)
    
    if push_result.returncode != 0:
        if "repository not found" in push_result.stderr.lower() or "could not read from remote" in push_result.stderr.lower():
            print("❌ Test repository 'memo-demo-test' doesn't exist on GitHub.")
            print("Please create it at: https://github.com/new")
        else:
            print(f"❌ Push failed: {push_result.stderr}")
            sys.exit(1)
    else:
        print("✅ Successfully pushed to test repository!")


def main():
    """Main function to orchestrate the deployment process."""
    # Define paths - DIFFERENT FROM deploy.py
    source_path = Path.cwd()
    target_path = source_path.parent / "memo-demo-dev"  # Changed from memo-demo-pub

    print("📦 Memo Demo Development Deployment Script")
    print("=" * 40)
    print(f"Source repository: {source_path}")
    print(f"Target repository: {target_path}")
    print(f"Remote repository: memo-demo-test")  # Changed from memo-demo

    # Show current git info
    current_branch = get_current_branch(source_path)
    latest_tag = get_latest_tag(source_path)
    print("\nGit Status:")
    print(f"  Current branch: {current_branch}")
    print(f"  Latest tag: {latest_tag or 'No tags found'}")

    # Check for uncommitted files (ignoring ./docs)
    uncommitted = check_uncommitted_files(source_path)
    export_ref = "HEAD"

    if uncommitted:
        print("\n⚠️  Uncommitted files detected (excluding ./docs):")
        for file in uncommitted[:5]:
            print(f"  - {file}")
        if len(uncommitted) > 5:
            print(f"  ... and {len(uncommitted) - 5} more")
        print("Using HEAD (includes uncommitted changes)")

    # Build check in source repo
    if not build_project_check(source_path):
        print("\n⚠️  Build check failed, but continuing with deployment...")

    # Show deployment summary
    print("\n📋 Development Deployment Summary:")
    print(f"  Export from: {export_ref}")
    print(f"  Target path: {target_path}")
    print(f"  Remote repo: memo-demo-test")
    print("  Actions:")
    print("    1. Export repository using gitattributes")
    print("    2. Build project in target directory")
    print("    3. Commit and force push to test repository")
    print("\n🚀 Starting deployment...")

    # Export repository
    export_repository(source_path, target_path, export_ref)

    # Build the project
    build_project(target_path)

    # Commit and push (with optional custom message from command line)
    import sys
    commit_msg = None
    if len(sys.argv) > 1:
        commit_msg = ' '.join(sys.argv[1:])
    commit_and_push(target_path, commit_msg)

    print("\n✅ Development deployment completed!")
    print(f"📁 Test repository at: {target_path}")
    print(f"🌐 View at: https://daeh.github.io/memo-demo-test/")


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Error executing command: {e.cmd}")
        print(f"Return code: {e.returncode}")
        if e.stderr:
            print(f"Error output: {e.stderr}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n\nDeployment cancelled by user.")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)