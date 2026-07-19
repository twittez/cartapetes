import fs from 'fs';
import path from 'path';
import https from 'https';

const LOGO_DIR = './public/logos';

const BRANDS = [
  { file: 'byd.png', url: 'https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@master/logos/optimized/byd.png' },
  { file: 'gwm.png', url: 'https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@master/logos/optimized/great-wall.png' },
  { file: 'ram.png', url: 'https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@master/logos/optimized/ram.png' }
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
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
  console.log('Downloading BYD, GWM, and RAM from jsdelivr...');
  for (const brand of BRANDS) {
    const destPath = path.join(LOGO_DIR, brand.file);
    try {
      await download(brand.url, destPath);
      console.log(`Success: ${brand.file}`);
    } catch (err) {
      console.error(`Error downloading ${brand.file}:`, err.message);
    }
  }
}

run();
