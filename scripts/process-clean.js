#!/usr/bin/env node

/**
 * Clean wrapper for process-with-llm.js that suppresses verbose ONNX runtime warnings
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scriptPath = path.join(__dirname, 'process-with-llm.js');

// Spawn the process with stderr filtering
const child = spawn('node', [scriptPath], {
  stdio: ['inherit', 'pipe', 'pipe'],
  env: { ...process.env }
});

// Filter stdout and stderr to remove ONNX warnings
const filterOutput = (data) => {
  const text = data.toString();
  const lines = text.split('\n');
  
  return lines
    .filter(line => {
      // Skip ONNX runtime warnings
      return !line.includes('CleanUnusedInitializersAndNodeArgs') &&
             !line.includes('Removing initializer') &&
             !line.includes('onnxruntime') &&
             !line.includes('should be removed from the model') &&
             !line.includes('[W:onnxruntime');
    })
    .join('\n');
};

child.stdout.on('data', (data) => {
  const filtered = filterOutput(data);
  if (filtered.trim()) {
    process.stdout.write(filtered);
  }
});

child.stderr.on('data', (data) => {
  const filtered = filterOutput(data);
  if (filtered.trim()) {
    process.stderr.write(filtered);
  }
});

child.on('close', (code) => {
  process.exit(code);
});

child.on('error', (error) => {
  console.error('Error running process:', error);
  process.exit(1);
}); 