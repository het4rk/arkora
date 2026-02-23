// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ArkVotes
 * @notice On-chain vote registry for Arkora. One vote per World ID nullifier per post.
 * @dev Deployed on World Chain Sepolia. Nullifier hashes are stored as bytes32.
 *      Off-chain DB mirrors tallies for fast UI reads; this contract is the source of truth.
 */
contract ArkVotes is Ownable, Pausable {
    // postId => nullifierHash => direction (0 = no vote, 1 = up, -1 = down)
    mapping(bytes32 => mapping(bytes32 => int8)) private _votes;

    mapping(bytes32 => uint256) public upvotes;
    mapping(bytes32 => uint256) public downvotes;

    event VoteCast(
        bytes32 indexed postId,
        bytes32 indexed nullifierHash,
        int8 direction
    );

    error InvalidDirection();
    error AlreadyVotedSameDirection();

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Cast or change a vote on a post.
     * @param postId     UUID of the post (as bytes32, left-padded)
     * @param direction  1 = upvote, -1 = downvote
     * @param nullifierHash  World ID nullifier hash (unique per human per app)
     */
    function castVote(
        bytes32 postId,
        int8 direction,
        bytes32 nullifierHash
    ) external whenNotPaused {
        if (direction != 1 && direction != -1) revert InvalidDirection();

        int8 existing = _votes[postId][nullifierHash];
        if (existing == direction) revert AlreadyVotedSameDirection();

        // Remove previous vote from tallies
        if (existing == 1) {
            upvotes[postId]--;
        } else if (existing == -1) {
            downvotes[postId]--;
        }

        // Record new vote
        _votes[postId][nullifierHash] = direction;

        if (direction == 1) {
            upvotes[postId]++;
        } else {
            downvotes[postId]--;
        }

        emit VoteCast(postId, nullifierHash, direction);
    }

    /**
     * @notice Get vote tallies for a post.
     * @return up       Number of upvotes
     * @return down     Number of downvotes
     * @return netScore Net score (up - down)
     */
    function getVoteTally(bytes32 postId)
        external
        view
        returns (
            uint256 up,
            uint256 down,
            int256 netScore
        )
    {
        up = upvotes[postId];
        down = downvotes[postId];
        netScore = int256(up) - int256(down);
    }

    /**
     * @notice Check if a nullifier has voted on a post.
     * @return voted     True if the nullifier has voted
     * @return direction The direction they voted (0 if not voted)
     */
    function hasVoted(bytes32 postId, bytes32 nullifierHash)
        external
        view
        returns (bool voted, int8 direction)
    {
        direction = _votes[postId][nullifierHash];
        voted = direction != 0;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
