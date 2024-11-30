#!/usr/bin/env node

const { execSync } = require('child_process');

const repoUrl = 'https://github.com/KarthikrajS/node-boilerplate.git'; // Replace with your repo URL
const projectName = process.argv[2] || 'my-project';

console.log(`Cloning the boilerplate into ${projectName}...`);
execSync(`git clone ${repoUrl} ${projectName}`, { stdio: 'inherit' });

console.log('Installing dependencies...');
execSync(`cd ${projectName} && npm install`, { stdio: 'inherit' });

console.log('Boilerplate setup complete! Ready to code!');
