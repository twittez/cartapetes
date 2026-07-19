import fs from 'fs';
import path from 'path';
import https from 'https';

const LOGO_DIR = './public/logos';

if (!fs.existsSync(LOGO_DIR)) {
  fs.mkdirSync(LOGO_DIR, { recursive: true });
}

// Brand mapping to target filenames and source slugs/domains
const BRANDS = [
  { file: 'chevrolet.png', url: 'https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@master/logos/optimized/chevrolet.png' },
  { file: 'fiat.png', url: 'https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@master/logos/optimized/fiat.png' },
  { file: 'volkswagen.png', url: 'https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@master/logos/optimized/volkswagen.png' },
  { file: 'toyota.png', url: 'https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@master/logos/optimized/toyota.png' },
  { file: 'hyundai.png', url: 'https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@master/logos/optimized/hyundai.png' },
  { file: 'ford.png', url: 'https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@master/logos/optimized/ford.png' },
  { file: 'renault.png', url: 'https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@master/logos/optimized/renault.png' },
  { file: 'jeep.png', url: 'https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@master/logos/optimized/jeep.png' },
  { file: 'honda.png', url: 'https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@master/logos/optimized/honda.png' },
  { file: 'nissan.png', url: 'https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@master/logos/optimized/nissan.png' },
  { file: 'mitsubishi.png', url: 'https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@master/logos/optimized/mitsubishi.png' },
  { file: 'kia.png', url: 'https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@master/logos/optimized/kia.png' },
  { file: 'peugeot.png', url: 'https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@master/logos/optimized/peugeot.png' },
  { file: 'citroen.png', url: 'https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@master/logos/optimized/citroen.png' },
  { file: 'byd.png', url: 'https://logo.clearbit.com/byd.com' },
  { file: 'gwm.png', url: 'https://logo.clearbit.com/gwm-global.com' },
  { file: 'chery.png', url: 'https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@master/logos/optimized/chery.png' },
  { file: 'ram.png', url: 'https://logo.clearbit.com/ramtrucks.com' },
  { file: 'bmw.png', url: 'https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@master/logos/optimized/bmw.png' },
  { file: 'mercedes-benz.png', url: 'https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@master/logos/optimized/mercedes-benz.png' },
  { file: 'audi.png', url: 'https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@master/logos/optimized/audi.png' },
  { file: 'volvo.png', url: 'https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@master/logos/optimized/volvo.png' },
  { file: 'land-rover.png', url: 'https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@master/logos/optimized/land-rover.png' },
  { file: 'porsche.png', url: 'https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@master/logos/optimized/porsche.png' },
  { file: 'tesla.png', url: 'https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@master/logos/optimized/tesla.png' }
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
  console.log('Downloading brand logos...');
  for (const brand of BRANDS) {
    const destPath = path.join(LOGO_DIR, brand.file);
    try {
      await download(brand.url, destPath);
      console.log(`Success: ${brand.file}`);
    } catch (err) {
      console.error(`Error downloading ${brand.file}:`, err.message);
      // Fallback to clearbit for other failures
      if (brand.url.includes('jsdelivr')) {
        const cleanName = brand.file.replace('.png', '');
        const fallbackUrl = `https://logo.clearbit.com/${cleanName}.com`;
        try {
          console.log(`Trying fallback: ${fallbackUrl}`);
          await download(fallbackUrl, destPath);
          console.log(`Success (Fallback): ${brand.file}`);
        } catch (fallbackErr) {
          console.error(`Fallback failed for ${brand.file}:`, fallbackErr.message);
        }
      }
    }
  }
  console.log('Finished downloading brand logos!');
}

run();
