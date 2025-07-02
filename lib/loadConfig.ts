// lib/loadConfig.ts
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';

export function getOllamaModelName(): string {
  const configPath = path.resolve(process.cwd(), 'ollama-config.yaml');
  const file = fs.readFileSync(configPath, 'utf8');
  const parsed = yaml.load(file) as any;
  return parsed?.ollama?.model ?? 'deepseek-coder:1.3b';
}
