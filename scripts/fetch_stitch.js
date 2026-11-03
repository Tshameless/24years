const https = require('https');
const fs = require('fs');
const path = require('path');

function callRpc(method, params) {
  const apiKey = process.env.STITCH_API_KEY;
  if (!apiKey) {
    throw new Error('STITCH_API_KEY environment variable is required');
  }

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: method,
        arguments: params
      }
    });
    const req = https.request('https://stitch.googleapis.com/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch(e) {
          resolve(body);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  const targetDir = path.resolve('apps/mp/stitch-design-assets');
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const screensRes = await callRpc('list_screens', { projectId: '14273146544935528330' });
  const screens = JSON.parse(screensRes.result.content[0].text).screens;

  console.log('Total screens:', screens.length);

  for (const s of screens) {
    console.log(`Processing: [${s.deviceType || 'UNKNOWN'}] ${s.title}`);
    if (s.htmlCode && s.htmlCode.name) {
      try {
        const fileRes = await callRpc('download_file', { name: s.htmlCode.name });
        const content = fileRes.result?.content?.[0]?.text;
        if (content) {
          const parsed = JSON.parse(content);
          const safeTitle = (s.deviceType ? s.deviceType + '_' : '') + s.title.replace(/[\\/:*?"<>|]/g, '_');
          const filePath = path.join(targetDir, `${safeTitle}.html`);
          fs.writeFileSync(filePath, parsed.html || parsed.content || content, 'utf8');
          console.log(`Saved: ${safeTitle}.html`);
        }
      } catch (err) {
        console.error(`Error saving ${s.title}:`, err.message);
      }
    }
  }
}

run().catch(console.error);
