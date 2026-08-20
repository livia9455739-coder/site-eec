const { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } = require('node:fs')
const { join, resolve } = require('node:path')

const source = resolve('public')
const destination = resolve('dist', 'public')

if (!existsSync(source)) {
    throw new Error('public directory not found')
}

mkdirSync(destination, { recursive: true })

function copyDirectory(from, to) {
    mkdirSync(to, { recursive: true })

    for (const entry of readdirSync(from)) {
        const sourcePath = join(from, entry)
        const destinationPath = join(to, entry)
        const stats = statSync(sourcePath)

        if (stats.isDirectory()) {
            copyDirectory(sourcePath, destinationPath)
            continue
        }

        if (stats.isFile()) {
            copyFileSync(sourcePath, destinationPath)
        }
    }
}

copyDirectory(source, destination)
