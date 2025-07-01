// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {
    IAccessControlEnumerable
} from "@openzeppelin/contracts/access/extensions/IAccessControlEnumerable.sol";

interface IRewardAllocation is IAccessControlEnumerable {
    /* STRUCTS */

    /**
     * @notice Structure to store details about a specific reward allocation.
     * @param token The address of the ERC20 token being allocated.
     * @param allocatedAmount The total amount of tokens allocated for this Merkle root.
     * @param claimedAmount The total amount of tokens already claimed from this allocation.
     * @param startTimestamp The timestamp when claiming for this allocation becomes active.
     */
    struct AllocationInfo {
        address token;
        uint256 allocatedAmount;
        uint256 claimedAmount;
        uint256 startTimestamp;
    }

    /* EVENTS */

    /**
     * @notice Emitted when a new reward allocation is added.
     * @param root The Merkle root of the new allocation.
     * @param token The address of the ERC20 token for this allocation.
     * @param allocatedAmount The total amount of tokens allocated.
     * @param startTimestamp The timestamp when claiming can begin.
     */
    event AllocationAdded(
        bytes32 indexed root,
        address indexed token,
        uint256 allocatedAmount,
        uint256 startTimestamp
    );

    /**
     * @notice Emitted when a user successfully claims their reward.
     * @param root The Merkle root from which the reward was claimed.
     * @param user The address of the user who claimed the reward.
     * @param amount The amount of tokens claimed.
     */
    event RewardClaimed(bytes32 indexed root, address indexed user, uint256 amount);

    /**
     * @notice Emitted when an allocation is cancelled.
     * @param root The Merkle root of the cancelled allocation.
     * @param token The address of the ERC20 token of the cancelled allocation.
     * @param uncommittedAmount The amount of tokens that were allocated but not claimed, now uncommitted.
     */
    event AllocationCancelled(
        bytes32 indexed root,
        address indexed token,
        uint256 uncommittedAmount
    );

    /**
     * @notice Emitted when surplus tokens (tokens not committed to any allocation) are withdrawn.
     * @param token The address of the ERC20 token withdrawn.
     * @param to The address to which the surplus tokens were sent.
     * @param amount The amount of surplus tokens withdrawn.
     */
    event SurplusTokensWithdrawn(address indexed token, address indexed to, uint256 amount);

    /**
     * @notice Emitted when tokens are emergency withdrawn for a specific token type.
     * @param token The address of the ERC20 token that was emergency withdrawn.
     * @param to The address to which the tokens were sent.
     * @param withdrawnAmount The total balance of the specified token withdrawn from the contract.
     */
    event TokensEmergencyWithdrawn(
        address indexed token,
        address indexed to,
        uint256 withdrawnAmount
    );

    /* ERRORS */

    /// @notice Reverts if an operation is attempted with a zero address where a valid address is expected.
    error RewardAllocation__ZeroAddress();

    /// @notice Reverts if an operation is attempted with a zero amount where a non-zero amount is expected.
    error RewardAllocation__ZeroAmount();

    /**
     * @notice Reverts if an attempt is made to add an allocation with a Merkle root that already exists.
     * @param root The Merkle root that already exists.
     */
    error RewardAllocation__ThisRootAlreadyExists(bytes32 root);

    /**
     * @notice Reverts if an operation is attempted on a Merkle root that does not correspond to an existing allocation.
     * @param root The Merkle root that does not exist.
     */
    error RewardAllocation__ThisRootDoesNotExist(bytes32 root);

    /**
     * @notice Reverts if an operation is attempted on a token that has been emergency withdrawn.
     * @param token The address of the token that has been emergency withdrawn.
     */
    error RewardAllocation__ThisTokenIsEmergencyWithdrawn(address token);

    /**
     * @notice Reverts if an attempt is made to cancel an allocation from which rewards have already been claimed.
     * @param root The Merkle root of the allocation that cannot be cancelled.
     */
    error RewardAllocation__ThisRootIsNotCancellable(bytes32 root);

    /**
     * @notice Reverts if the contract does not have enough balance of a token to cover a new allocation.
     * @param token The address of the token.
     * @param tokenBalance The current balance of the token in the contract.
     * @param requiredTokenBalance The required balance of the token to add the allocation.
     */
    error RewardAllocation__InsufficientContractBalance(
        address token,
        uint256 tokenBalance,
        uint256 requiredTokenBalance
    );

    /**
     * @notice Reverts if an attempt is made to withdraw more surplus tokens than available.
     * @param token The address of the token.
     * @param surplusTokens The available surplus amount of the token.
     * @param withdrawAmount The amount attempted to be withdrawn.
     */
    error RewardAllocation__NotEnoughSurplusTokens(
        address token,
        uint256 surplusTokens,
        uint256 withdrawAmount
    );

    /**
     * @notice Reverts if a claim is attempted before the allocation's start timestamp.
     * @param root The Merkle root of the allocation.
     * @param startTimestamp The required start timestamp for claiming.
     * @param blockTimestamp The current block timestamp.
     */
    error RewardAllocation__ClaimPeriodNotYetActive(
        bytes32 root,
        uint256 startTimestamp,
        uint256 blockTimestamp
    );

    /**
     * @notice Reverts if a user attempts to claim a reward for a specific leaf that has already been claimed.
     * @param root The Merkle root of the allocation.
     * @param user The address of the user attempting the claim.
     * @param claimAmount The amount of the claim.
     * @param leaf The Merkle leaf corresponding to the claim, which has already been processed.
     */
    error RewardAllocation__RewardAlreadyClaimedForThisAllocation(
        bytes32 root,
        address user,
        uint256 claimAmount,
        bytes32 leaf
    );

    /**
     * @notice Reverts if the provided Merkle proof is invalid for the given root and leaf.
     * @param root The Merkle root.
     * @param leaf The Merkle leaf generated from user's address and claim amount.
     * @param proof The Merkle proof provided by the user.
     */
    error RewardAllocation__InvalidMerkleProof(bytes32 root, bytes32 leaf, bytes32[] proof);

    /**
     * @notice Reverts if the cumulative claimed amount for an allocation would exceed its total allocated amount.
     * This should ideally not happen with correct Merkle tree construction and claim amounts.
     * @param root The Merkle root of the allocation.
     * @param claimedAmount The cumulative claimed amount after the current claim.
     * @param allocatedAmount The total allocated amount for the root.
     */
    error RewardAllocation__ClaimedExceedsAllocated(
        bytes32 root,
        uint256 claimedAmount,
        uint256 allocatedAmount
    );

    /* PUBLIC VARIABLES */

    /**
     * @notice Checks if a user has claimed at least one reward for a specific allocation.
     * @dev This does not mean the user cannot claim other rewards from the same allocation if multiple leaves are assigned to them.
     * @param root The Merkle root of the allocation.
     * @param user The address of the user.
     * @return True if the user has claimed at least one reward, false otherwise.
     */
    function hasClaimed(bytes32 root, address user) external view returns (bool);

    /**
     * @notice Checks if a specific reward leaf has been claimed for a given allocation.
     * @param root The Merkle root of the allocation.
     * @param leaf The Merkle leaf, which represents a specific claim.
     * @return True if the leaf has been claimed, false otherwise.
     */
    function hasClaimedLeaf(bytes32 root, bytes32 leaf) external view returns (bool);

    /**
     * @notice Returns the total amount of a specific token that is currently committed to all active allocations.
     * @dev This is the sum of all allocated amounts for a token, minus any amounts that have been claimed or uncommitted through cancellation.
     * @param token The address of the ERC20 token.
     * @return The total amount of the token committed to active allocations.
     */
    function totalOverallClaimableAmountPerToken(address token) external view returns (uint256);

    /**
     * @notice Checks if a specific token type has been subject to an emergency withdrawal.
     * If true, no further operations (add allocation, claim, cancel) can be performed for this token.
     * @param token The address of the ERC20 token.
     * @return True if the token has been emergency withdrawn, false otherwise.
     */
    function isTokenEmergencyWithdrawn(address token) external view returns (bool);

    /**
     * @notice Returns the keccak256 hash of the "REWARD_ALLOCATOR_ROLE".
     * This role grants permissions to manage allocations (add, cancel).
     * @return The bytes32 representation of the reward allocator role.
     */
    function REWARD_ALLOCATOR_ROLE() external view returns (bytes32);

    /**
     * @notice Returns the keccak256 hash of the "FUNDS_MANAGER_ROLE".
     * This role grants permissions to manage contract funds (withdraw surplus, emergency withdraw).
     * @return The bytes32 representation of the funds manager role.
     */
    function FUNDS_MANAGER_ROLE() external view returns (bytes32);

    /**
     * @notice Returns the keccak256 hash of the "PAUSER_ROLE".
     * This role grants permissions to pause the contract.
     * @return The bytes32 representation of the pauser role.
     */
    function PAUSER_ROLE() external view returns (bytes32);

    /**
     * @notice Returns the keccak256 hash of the "UNPAUSER_ROLE".
     * This role grants permissions to unpause the contract.
     * @return The bytes32 representation of the unpauser role.
     */
    function UNPAUSER_ROLE() external view returns (bytes32);

    /* INITIALIZER */

    /**
     * @notice Initializes the RewardAllocation contract.
     * Sets up access control, reentrancy guard, and pausable features.
     * Grants the `DEFAULT_ADMIN_ROLE` to the `defaultAdmin`.
     * @param defaultAdmin The address to be granted the `DEFAULT_ADMIN_ROLE`.
     */
    function initialize(address defaultAdmin) external;

    /* USER FUNCTIONS */

    /**
     * @notice Allows a user to claim their allocated reward for a specific Merkle root.
     * @param root The Merkle root of the allocation.
     * @param claimAmount The amount of tokens to claim.
     * @param proof The Merkle proof for the claim.
     */
    function claim(bytes32 root, uint256 claimAmount, bytes32[] memory proof) external;

    /* ADMIN FUNCTIONS */

    /**
     * @notice Adds a new reward allocation.
     * Caller must have the `REWARD_ALLOCATOR_ROLE`.
     * The contract must hold sufficient balance of the specified token to cover the `allocatedAmount`
     * on top of existing commitments.
     * @param root The Merkle root for the new allocation. Must not already exist.
     * @param token The ERC20 token address for this allocation. Must not be the zero address.
     * @param allocatedAmount The total amount of tokens for this allocation. Must be greater than zero.
     * @param startTimestamp The timestamp from which rewards can be claimed.
     */
    function addAllocation(
        bytes32 root,
        address token,
        uint256 allocatedAmount,
        uint256 startTimestamp
    ) external;

    /**
     * @notice Cancels an existing reward allocation.
     * Caller must have the `REWARD_ALLOCATOR_ROLE`.
     * An allocation can only be cancelled if no rewards have been claimed from it yet.
     * @param root The Merkle root of the allocation to cancel. Must exist.
     */
    function cancelAllocation(bytes32 root) external;

    /**
     * @notice Pauses the contract, preventing claims.
     * Caller must have the `PAUSER_ROLE`.
     */
    function pause() external;

    /**
     * @notice Unpauses the contract, allowing claims to resume.
     * Caller must have the `UNPAUSER_ROLE`.
     */
    function unpause() external;

    /**
     * @notice Withdraws surplus tokens from the contract.
     * Surplus tokens are those not committed to any active allocation.
     * Caller must have the `FUNDS_MANAGER_ROLE`.
     * @param token The address of the ERC20 token to withdraw. Must not be zero address.
     * @param to The address to send the withdrawn tokens to. Must not be zero address.
     * @param withdrawAmount The amount of tokens to withdraw. Must be greater than zero and not exceed surplus.
     */
    function withdrawSurplusTokens(address token, address to, uint256 withdrawAmount) external;

    /**
     * @notice Performs an emergency withdrawal of all tokens of a specific type.
     * This action marks the token as "emergency withdrawn", preventing any further allocations,
     * claims, or cancellations related to this token.
     * Caller must have the `FUNDS_MANAGER_ROLE`.
     * @param token The address of the ERC20 token to withdraw. Must not be zero address.
     * @param to The address to send the withdrawn tokens to. Must not be zero address.
     */
    function emergencyWithdraw(address token, address to) external;

    /* VIEW FUNCTIONS */

    /**
     * @notice Returns an array of all active Merkle roots.
     * @return An array of `bytes32` representing all current Merkle roots.
     */
    function allRoots() external view returns (bytes32[] memory);

    /**
     * @notice Returns the total number of active Merkle roots.
     * @return The count of active Merkle roots.
     */
    function allRootsLength() external view returns (uint256);

    /**
     * @notice Returns the Merkle root at a specific index in the list of all roots.
     * @param index The index of the desired root.
     * @return The `bytes32` Merkle root at the given index.
     */
    function allRootsAt(uint256 index) external view returns (bytes32);

    /**
     * @notice Retrieves the `AllocationInfo` for a given Merkle root.
     * @param root The Merkle root to query.
     * @return allocInfo_ The `AllocationInfo` struct containing details for the specified root.
     */
    function allocInfo(bytes32 root) external view returns (AllocationInfo memory);
}
