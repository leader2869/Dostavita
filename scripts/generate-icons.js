#!/usr/bin/env node
// Render every web icon from the single vector brand source.
const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')
const root = path.join(__dirname, '..')
async function main() {
  const source = fs.readFileSync(path.join(root, 'public/icon.svg'))
  for (const [size, name] of [[32,'icon-32x32.png'],[180,'apple-icon-180x180.png'],[192,'icon-192x192.png'],[512,'icon-512x512.png']]) {
    await sharp(source).resize(size,size).png().toFile(path.join(root,'public',name))
  }
  // Optional local Android project: retain its application ID and signing identity.
  const res = path.join(root,'android/app/src/main/res')
  if (fs.existsSync(res)) {
    for (const [density,size] of [['mdpi',48],['hdpi',72],['xhdpi',96],['xxhdpi',144],['xxxhdpi',192]]) {
      const dir = path.join(res,`mipmap-${density}`)
      fs.mkdirSync(dir,{recursive:true})
      for (const name of ['ic_launcher.png','ic_launcher_round.png']) {
        await sharp(source).resize(size,size).png().toFile(path.join(dir,name))
      }
      // Adaptive icon foreground has extra room for launcher masks.
      const canvas = Math.round(size*2.25)
      const foreground = await sharp(source).resize(size,size).png().toBuffer()
      await sharp({create:{width:canvas,height:canvas,channels:4,background:'#87ceeb'}})
        .composite([{input:foreground,gravity:'center'}]).png().toFile(path.join(dir,'ic_launcher_foreground.png'))
    }
  }
  console.log('Dostavita icons generated')
}
main().catch(error=>{console.error(error);process.exitCode=1})
