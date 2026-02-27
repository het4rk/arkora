/**
 * Deploy ArkoraNullifierRegistry to World Chain mainnet.
 *
 * Usage:
 *   REGISTRY_DEPLOYER_PRIVATE_KEY=0x... npx tsx scripts/deployRegistry.ts
 *
 * Requirements:
 *   - A wallet with a small amount of ETH on World Chain mainnet (chain 480)
 *   - Bridge ETH at https://bridge.worldchain.io
 *   - Gas cost is fractions of a cent per transaction on World Chain
 *
 * After deployment:
 *   1. Copy the printed contract address
 *   2. Add REGISTRY_ADDRESS=0x... to Vercel Dashboard env vars
 *   3. Add REGISTRY_DEPLOYER_PRIVATE_KEY=0x... to Vercel Dashboard env vars
 *   4. Redeploy - the verify flow will start registering nullifiers automatically
 */

import { createWalletClient, createPublicClient, http, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { worldchain } from 'viem/chains'

// Bytecode produced by solc 0.8.20 - compile with:
// solc --bin --optimize --optimize-runs 200 contracts/ArkoraNullifierRegistry.sol
// OR use Remix IDE (remix.ethereum.org) and paste the contract source
// Paste the compiled bytecode here after compiling:
const BYTECODE = process.env.REGISTRY_BYTECODE as Hex | undefined

async function deploy() {
  const privateKey = process.env.REGISTRY_DEPLOYER_PRIVATE_KEY as Hex | undefined
  if (!privateKey) {
    console.error('Error: REGISTRY_DEPLOYER_PRIVATE_KEY env var is required')
    process.exit(1)
  }
  if (!BYTECODE) {
    console.error('Error: REGISTRY_BYTECODE env var is required (paste compiled bytecode)')
    console.error('Compile with Remix at https://remix.ethereum.org or:')
    console.error('  npx solc --bin --optimize contracts/ArkoraNullifierRegistry.sol')
    process.exit(1)
  }

  const account = privateKeyToAccount(privateKey)
  const rpc = process.env.WORLD_CHAIN_RPC ?? 'https://worldchain-mainnet.g.alchemy.com/public'

  const walletClient = createWalletClient({
    account,
    chain: worldchain,
    transport: http(rpc),
  })

  const publicClient = createPublicClient({
    chain: worldchain,
    transport: http(rpc),
  })

  console.log(`Deploying from: ${account.address}`)
  const balance = await publicClient.getBalance({ address: account.address })
  console.log(`Balance: ${Number(balance) / 1e18} ETH on World Chain`)

  if (balance === 0n) {
    console.error('Error: wallet has no ETH on World Chain. Bridge ETH at https://bridge.worldchain.io')
    process.exit(1)
  }

  console.log('Deploying ArkoraNullifierRegistry...')
  const txHash = await walletClient.deployContract({
    abi: [],
    bytecode: BYTECODE,
  })

  console.log(`Deploy tx: https://worldscan.org/tx/${txHash}`)
  console.log('Waiting for confirmation...')

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
  if (!receipt.contractAddress) {
    console.error('Deploy failed - no contract address in receipt')
    process.exit(1)
  }

  console.log(`\n✓ Contract deployed at: ${receipt.contractAddress}`)
  console.log(`  Worldscan: https://worldscan.org/address/${receipt.contractAddress}`)
  console.log('\nNext steps:')
  console.log(`  1. Add to Vercel Dashboard:`)
  console.log(`     REGISTRY_ADDRESS=${receipt.contractAddress}`)
  console.log(`     REGISTRY_DEPLOYER_PRIVATE_KEY=${privateKey}`)
  console.log('  2. Redeploy Vercel')
  console.log('  3. New World ID verifications will auto-register in the contract')
}

deploy().catch((err) => {
  console.error('Deploy error:', err)
  process.exit(1)
})
