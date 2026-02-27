// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ArkoraNullifierRegistry
 * @notice Records verified World ID nullifiers on World Chain.
 *         Each entry proves a real human completed World ID Orb verification
 *         for Arkora at a specific block. Immutable — a nullifier registered
 *         once can never be unregistered.
 *
 * @dev Deployed on World Chain mainnet (chain 480).
 *      Only the contract owner (Arkora server wallet) can register nullifiers.
 *      This prevents fake registrations — the server only calls register()
 *      after a successful onchain WorldIDRouter proof verification.
 */
contract ArkoraNullifierRegistry {
    // Emitted once per nullifier, never again
    event NullifierRegistered(
        bytes32 indexed nullifierHash,
        uint256 blockNumber,
        address indexed registeredBy
    );

    // nullifierHash => block number at registration (0 = not registered)
    mapping(bytes32 => uint256) public registeredAt;

    address public owner;

    error NotOwner();
    error AlreadyRegistered();

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /**
     * @notice Register a World ID nullifier after successful proof verification.
     * @param nullifierHash  The nullifier_hash from the World ID ZK proof (as bytes32).
     *                       Pass the raw bigint value left-padded to 32 bytes.
     */
    function register(bytes32 nullifierHash) external onlyOwner {
        if (registeredAt[nullifierHash] != 0) revert AlreadyRegistered();
        registeredAt[nullifierHash] = block.number;
        emit NullifierRegistered(nullifierHash, block.number, msg.sender);
    }

    /**
     * @notice Check if a nullifier has been registered and at which block.
     * @return registered  True if the nullifier exists in the registry.
     * @return blockNum    Block number at registration time (0 if not registered).
     */
    function lookup(bytes32 nullifierHash)
        external
        view
        returns (bool registered, uint256 blockNum)
    {
        blockNum = registeredAt[nullifierHash];
        registered = blockNum != 0;
    }

    /**
     * @notice Transfer ownership to a new address (e.g. a multisig).
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }
}
