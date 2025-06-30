import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

async function fetchFromGitHub(repoUrl: string, filePath: string, branch = 'main') {
  // Parse repo owner and name from URL
  const match = repoUrl.match(/github.com[/:]([^/]+)\/([^/]+)(.git)?/i);
  if (!match) throw new Error('Invalid GitHub repo URL');
  const owner = match[1];
  const repo = match[2].replace(/.git$/, '');
  // Try main, then master if main fails
  const branches = [branch, 'master'];
  let lastErr;
  for (const b of branches) {
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${b}/${filePath}`;
    const res = await fetch(rawUrl);
    if (res.ok) return await res.text();
    lastErr = await res.text();
  }
  throw new Error(`GitHub fetch failed: ${lastErr}`);
}

export async function POST(req: NextRequest) {
  try {
    const { filePath, repoUrl, branch } = await req.json();
    console.log('[API] file-content requested for:', filePath, 'repoUrl:', repoUrl);
    if (!filePath) {
      return NextResponse.json({ error: 'Missing filePath' }, { status: 400 });
    }
    if (repoUrl) {
      // Fetch from GitHub
      const content = await fetchFromGitHub(repoUrl, filePath, branch);
      return NextResponse.json({ content });
    }
    // Local fallback
    const baseDir = process.cwd();
    const absPath = path.resolve(baseDir, filePath);
    console.log('[API] Resolved absPath:', absPath);
    if (!absPath.startsWith(baseDir)) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 403 });
    }
    const content = await fs.readFile(absPath, 'utf-8');
    return NextResponse.json({ content });
  } catch (err: any) {
    console.error('[API] file-content error:', err);
    return NextResponse.json({ error: err.message || 'Failed to read file' }, { status: 500 });
  }
}
