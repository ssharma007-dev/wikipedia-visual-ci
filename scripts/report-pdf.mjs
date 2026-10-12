// Turn the HTML report into a PDF (A4, light theme). Usage: node scripts/report-pdf.mjs <report.html> <report.pdf>
import { chromium } from '@playwright/test';
import path from 'node:path';

const [html, pdf] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.emulateMedia({ colorScheme: 'light', media: 'print' });
await page.goto('file://' + path.resolve(html), { waitUntil: 'load' });
await page.pdf({
  path: pdf, format: 'A4', printBackground: true,
  margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' },
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#777">Agent 1 visual report · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
});
await browser.close();
console.log(`PDF: ${pdf}`);
