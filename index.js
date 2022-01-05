#!/bin/env node

import path from 'path'
import http from 'http'

import sharp from 'sharp'

import fs from '@magic/fs'
import log from '@magic/log'
import cli from '@magic/cli'


const runRequest = async ({ hostname, urlPath:path }) => {

  const options = {
    hostname,
    port: 80,
    path,
    method: 'GET'
  }

  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      const result = []
      res.on('data', d => {
        result.push(d)
      })

      res.on('end', () => {
        const buffer = Buffer.concat(result)
        resolve(buffer)
      })

      res.on('error', reject)
    })

    req.on('error', reject)

    req.end()

  })
}

const maps = [
  {
    name: 'color',
    hostname: 's3-eu-west-1.amazonaws.com',
    path: '/whereonmars.cartodb.net/viking_mdim21_global',

    zoom: 7,
    minX: 48,
    maxX: 57,

    minY: 38,
    maxY: 47,

    originalSize: 2560,
    size: 2048,
  },
  {
    name: 'height',
    hostname: 's3-eu-west-1.amazonaws.com',
    path: '/whereonmars.cartodb.net/mola-color',

    zoom: 6,
    minX: 24,
    maxX: 28,

    minY: 19,
    maxY: 23,

    originalSize: 1280,
    size: 1024,
  }
]

const run = async () => {
  await Promise.all(maps.map(async map => {
    const { hostname } = map

    const cwd = process.cwd()
    const dir = path.join(cwd, map.name)
    await fs.mkdirp(dir)

    for (let x = map.minX; x <= map.maxX; x++) {
      for (let y = map.minY; y <= map.maxY; y++) {
        const filePath = path.join(dir, `${x}-${y}.png`)
        const exists = await fs.exists(filePath)
        if (!exists) {
          const urlPath = `${map.path}/${map.zoom}/${x}/${y}.png`
          log.warn('W_IMAGE_NOEXIST', `image does not exist, downloading: ${hostname}${urlPath} to ${dir}`)
          const file = await runRequest({ hostname, urlPath })
          await fs.writeFile(filePath, file)
          log.success('wrote', filePath.replace(cwd, ''))
        }
      }
    }

    log(`downloaded ${map.name} images, merging them using convert from imagemagic`)

    const allOutImages = []

    for (let y = map.minY; y <= map.maxY; y++) {
      const imagePath = []

      for (let x = map.minX; x <= map.maxX; x++) {
        imagePath.push(`${x}-${y}.png`)
      }

      const fullImagePath = imagePath.map(p => path.join(dir, p)).join(' ')
      const imageOutPath = path.join(dir, `merged-${y}.png`)

      allOutImages.push(imageOutPath)

      const exists = await fs.exists(imageOutPath)
      if (!exists) {
        log.warn('E_NO_EXIST', `${imageOutPath} does not exist. appending images.`)
        const cmd = `convert ${fullImagePath} +append ${imageOutPath}`
        await cli.exec(cmd)
        log.success('Image saved', imageOutPath)
      }
    }

    const fullOutImagePath = path.join(cwd, `smiley-${map.name}-${map.originalSize}.png`)
    const exists = await fs.exists(fullOutImagePath)

    if (!exists) {
      log.warn('E_NO_EXIST', `${fullOutImagePath} does not exist. appending images.`)
      const cmd = `convert ${allOutImages.reverse().join(' ')} -append ${fullOutImagePath}`
      await cli.exec(cmd)
      log.success('Final merge done', fullOutImagePath)

      sharp(fullOutImagePath)
        .resize(map.size, map.size, {
          kernel: sharp.kernel.nearest,
          fit: 'contain',
          position: 'right top',
        })
        .toFile(`smiley-${map.name}-${map.size}.png`)
    }

  }))
}

run()