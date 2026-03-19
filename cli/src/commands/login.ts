import { createInterface } from 'node:readline/promises'
import chalk from 'chalk'
import qrcode from 'qrcode-terminal'
import { saveConfig, getConfig, getApiUrl } from '../config.js'
import { api } from '../api.js'

export async function loginCommand(): Promise<void> {
  const settingsUrl = `${getApiUrl()}/settings`

  console.log()
  console.log(chalk.bold('Arkora CLI Login'))
  console.log()
  console.log('Scan this QR code to open Settings in Arkora,')
  console.log('then generate an API key under "Developer":')
  console.log()

  qrcode.generate(settingsUrl, { small: true })

  console.log()
  console.log(chalk.dim(settingsUrl))
  console.log()

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const key = (await rl.question('Paste your API key (ark_...): ')).trim()
  rl.close()

  if (!key.startsWith('ark_') || key.length !== 68) {
    console.error(chalk.red('Invalid API key format. Keys start with ark_ and are 68 characters.'))
    process.exit(1)
  }

  // Validate the key by hitting the stats endpoint
  try {
    await api('/stats', key)
  } catch (err) {
    console.error(chalk.red(`Key validation failed: ${err instanceof Error ? err.message : String(err)}`))
    process.exit(1)
  }

  const config = getConfig()
  config.apiKey = key
  saveConfig(config)

  console.log()
  console.log(chalk.green('Logged in successfully.'))
  console.log(chalk.dim(`Config saved to ~/.config/arkora/config.json`))
}
