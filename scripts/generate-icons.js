#!/usr/bin/env node

/**
 * Скрипт для генерации PNG иконок в стиле кнопки "П!"
 * Требуется: npm install sharp (или используйте generate-icons.html в браузере)
 */

const fs = require('fs');
const path = require('path');

// Проверяем, установлен ли sharp
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('❌ Sharp не установлен. Установите его: npm install sharp');
  console.log('💡 Или используйте scripts/generate-icons.html в браузере для генерации иконок');
  process.exit(1);
}

// SVG шаблон для иконки "П!" с шрифтом Amatic SC Bold
const svgTemplate = `
<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Amatic+SC:wght@700&display=swap');
      .logo-text {
        font-family: 'Amatic SC', Arial, sans-serif;
        font-weight: 700;
        font-size: {fontSize}px;
        fill: #1f2937;
        text-anchor: middle;
        dominant-baseline: middle;
        letter-spacing: -2px;
      }
    </style>
  </defs>
  <!-- Круглый фон как у кнопки П! -->
  <circle cx="{center}" cy="{center}" r="{radius}" fill="#87ceeb"/>
  
  <!-- Текст "П!" в центре с шрифтом Amatic SC Bold -->
  <text 
    x="{center}" 
    y="{center}" 
    class="logo-text"
  >П!</text>
</svg>
`;

function generateIcon(size) {
  const center = size / 2;
  const radius = size / 2;
  const fontSize = Math.round(size * 0.55);
  
  const svg = svgTemplate
    .replace(/{size}/g, size)
    .replace(/{center}/g, center)
    .replace(/{radius}/g, radius)
    .replace(/{fontSize}/g, fontSize);
  
  return sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toBuffer();
}

async function main() {
  const publicDir = path.join(__dirname, '..', 'public');
  
  console.log('🎨 Генерация иконок в стиле кнопки "П!"...\n');
  
  const icons = [
    { size: 32, filename: 'icon-32x32.png', description: 'Favicon 32x32' },
    { size: 180, filename: 'apple-icon-180x180.png', description: 'Apple Touch Icon 180x180' },
    { size: 192, filename: 'icon-192x192.png', description: 'PWA Icon 192x192' },
    { size: 512, filename: 'icon-512x512.png', description: 'PWA Icon 512x512' },
  ];
  
  try {
    for (const icon of icons) {
      console.log(`📦 Генерация ${icon.filename} (${icon.description})...`);
      const iconBuffer = await generateIcon(icon.size);
      fs.writeFileSync(path.join(publicDir, icon.filename), iconBuffer);
      console.log(`✅ ${icon.filename} создан\n`);
    }
    
    console.log('🎉 Все иконки успешно созданы!');
  } catch (error) {
    console.error('❌ Ошибка при генерации иконок:', error.message);
    console.log('\n💡 Альтернативный способ:');
    console.log('   1. Откройте scripts/generate-icons.html в браузере');
    console.log('   2. Нажмите кнопки для скачивания иконок');
    console.log('   3. Сохраните файлы в папку public/');
    process.exit(1);
  }
}

main();

