#!/usr/bin/env tsx

import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';

interface ConsoleError {
  type: string;
  text: string;
  timestamp: number;
}

async function captureConsoleErrors() {
  console.log('🚀 Launching browser to capture shader errors...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const consoleErrors: ConsoleError[] = [];

  // Capture all console messages
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();

    if (type === 'error' || type === 'warning') {
      consoleErrors.push({
        type,
        text,
        timestamp: Date.now()
      });

      console.log(`[${type.toUpperCase()}] ${text}`);
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    consoleErrors.push({
      type: 'pageerror',
      text: error.toString(),
      timestamp: Date.now()
    });

    console.log(`[PAGE ERROR] ${error.toString()}`);
  });

  console.log('📡 Navigating to Slang Demo page...\n');
  await page.goto('http://localhost:8080/slang-demo', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  // Wait for shader compilation to complete
  console.log('⏳ Waiting for shader compilation (15 seconds)...\n');
  await new Promise(resolve => setTimeout(resolve, 15000));

  // Analyze errors
  console.log(`\n📊 Analysis: Captured ${consoleErrors.length} console messages\n`);

  // Group errors by type
  const errorsByType: Record<string, string[]> = {};

  consoleErrors.forEach(err => {
    if (!errorsByType[err.type]) {
      errorsByType[err.type] = [];
    }
    errorsByType[err.type].push(err.text);
  });

  // Find redefinition patterns
  const redefinitions: Record<string, number> = {};

  consoleErrors.forEach(err => {
    const match = err.text.match(/['"]([^'"]+)['"] : redefinition/);
    if (match) {
      const symbol = match[1];
      redefinitions[symbol] = (redefinitions[symbol] || 0) + 1;
    }
  });

  // Sort redefinitions by frequency
  const sortedRedefinitions = Object.entries(redefinitions)
    .sort((a, b) => b[1] - a[1]);

  console.log('🔴 Most frequently redefined symbols:');
  sortedRedefinitions.slice(0, 20).forEach(([symbol, count]) => {
    console.log(`  ${symbol}: ${count} times`);
  });

  // Save detailed report
  const report = {
    totalErrors: consoleErrors.length,
    errorsByType,
    redefinitions: sortedRedefinitions,
    allErrors: consoleErrors
  };

  const reportPath = '/Users/spot/Code/bms-highscore-challenge/tools/shader/artifacts/shader-error-report.json';
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n💾 Detailed report saved to: ${reportPath}`);
  console.log('\n✅ Error capture complete!');

  await browser.close();
}

captureConsoleErrors().catch(console.error);
