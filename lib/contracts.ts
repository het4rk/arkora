// ArkVotes contract ABI — keep in sync with contracts/ArkVotes.sol
export const ARK_VOTES_ABI = [
  {
    type: 'function',
    name: 'castVote',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'postId', type: 'bytes32' },
      { name: 'direction', type: 'int8' },
      { name: 'nullifierHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getVoteTally',
    stateMutability: 'view',
    inputs: [{ name: 'postId', type: 'bytes32' }],
    outputs: [
      { name: 'upvotes', type: 'uint256' },
      { name: 'downvotes', type: 'uint256' },
      { name: 'netScore', type: 'int256' },
    ],
  },
  {
    type: 'function',
    name: 'hasVoted',
    stateMutability: 'view',
    inputs: [
      { name: 'postId', type: 'bytes32' },
      { name: 'nullifierHash', type: 'bytes32' },
    ],
    outputs: [
      { name: 'voted', type: 'bool' },
      { name: 'direction', type: 'int8' },
    ],
  },
  {
    type: 'event',
    name: 'VoteCast',
    inputs: [
      { name: 'postId', type: 'bytes32', indexed: true },
      { name: 'nullifierHash', type: 'bytes32', indexed: true },
      { name: 'direction', type: 'int8', indexed: false },
    ],
  },
] as const

export function getArkVotesAddress(): `0x${string}` {
  const addr = process.env.NEXT_PUBLIC_ARK_VOTES_ADDRESS
  if (!addr || addr === '0x0000000000000000000000000000000000000000') {
    // Return zero address pre-deploy — contract calls will be skipped
    return '0x0000000000000000000000000000000000000000'
  }
  return addr as `0x${string}`
}

export function isContractDeployed(): boolean {
  const addr = getArkVotesAddress()
  return addr !== '0x0000000000000000000000000000000000000000'
}
