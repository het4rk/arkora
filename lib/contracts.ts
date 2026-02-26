// ── WLD Token (ERC-20 on World Chain mainnet, chain 480) ──────────────────────
// Verified: https://worldscan.org/token/0x2cFc85d8E48F8EAB294be644d9E25C3030863003
export const WLD_TOKEN_ADDRESS = '0x2cFc85d8E48F8EAB294be644d9E25C3030863003' as const

export const ERC20_TRANSFER_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const

