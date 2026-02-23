import { createPublicClient, http, defineChain } from 'viem'

export const worldChainSepolia = defineChain({
  id: 4801,
  name: 'World Chain Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_WC_RPC ??
          'https://worldchain-sepolia.g.alchemy.com/public',
      ],
    },
  },
  blockExplorers: {
    default: {
      name: 'World Chain Sepolia Explorer',
      url: 'https://worldchain-sepolia.explorer.alchemy.com',
    },
  },
  testnet: true,
})

export const publicClient = createPublicClient({
  chain: worldChainSepolia,
  transport: http(),
})
