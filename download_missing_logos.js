import fs from 'fs';
import path from 'path';
import https from 'https';

const LOGO_DIR = './public/logos';

const MISSING_BRANDS = [
  { file: 'byd.png', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/BYD_Auto_logo.svg/240px-BYD_Auto_logo.svg.png' },
  { file: 'gwm.png', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Great_Wall_Motor_logo.svg/240px-Great_Wall_Motor_logo.svg.png' },
  { file: 'ram.png', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Ram_trucks_logo.svg/240px-Ram_trucks_logo.svg.png' }
];

function downloadWithUserAgent(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    };
    https.get(url, options, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function run() {
  console.log('Downloading missing brand logos with User-Agent...');
  for (const brand of MISSING_BRANDS) {
    const destPath = path.join(LOGO_DIR, brand.file);
    try {
      await downloadWithUserAgent(brand.url, destPath);
      console.log(`Success: ${brand.file}`);
    } catch (err) {
      console.error(`Error downloading ${brand.file}:`, err.message);
    }
  }
}

run();
