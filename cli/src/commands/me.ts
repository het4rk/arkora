import chalk from 'chalk'
import { requireApiKey, getConfig, saveConfig } from '../config.js'
import { api } from '../api.js'
import { accent, accentBold, dim, setAccent } from '../theme.js'

interface MeData {
  pseudoHandle: string | null
  identityMode: string
  isVerified: boolean
  karmaScore: number
  activeSkinId: string
  customHex: string | null
  createdAt: string
}

export async function meCommand(): Promise<void> {
  const key = requireApiKey()
  const res = await api<MeData>('/me', key)
  const user = res.data!

  // Update local skin config
  const config = getConfig()
  config.skinId = user.activeSkinId
  if (user.customHex) config.customHex = user.customHex
  saveConfig(config)
  setAccent(user.activeSkinId, user.customHex)

  const name = user.pseudoHandle ?? dim('(no handle set)')
  const mode = user.identityMode
  const karma = user.karmaScore
  const joined = new Date(user.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  console.log()
  console.log(accentBold(name))
  console.log()
  console.log(`  Identity:  ${accent(mode)}`)
  console.log(`  Verified:  ${chalk.green('Yes')}`)
  console.log(`  Karma:     ${accent(String(karma))}`)
  console.log(`  Skin:      ${accent(user.activeSkinId)}${user.customHex ? ` (${user.customHex})` : ''}`)
  console.log(`  Joined:    ${dim(joined)}`)
  console.log()
}
