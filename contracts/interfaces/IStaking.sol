// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {INftReceipt} from "./INftReceipt.sol";

interface IStaking {
    /* STRUCTS */

    /**
     * @notice Structure to store details about a specific stake.
     * @param amount The amount of tokens staked.
     * @param startTime The timestamp when staking started.
     * @param lockupEndTime The timestamp when staking is locked up.
     * @param withdrawAllowedTime The timestamp when withdrawal is allowed.
     */
    struct StakeInfo {
        uint256 amount;
        uint64 startTime;
        uint64 lockupEndTime;
        uint64 withdrawAllowedTime;
    }

    /**
     * @notice Structure to store details about a specific stake.
     * @param tokenId The id of the stake.
     * @param amount The amount of tokens staked.
     * @param startTime The timestamp when staking started.
     * @param lockupEndTime The timestamp when staking is locked up.
     * @param withdrawAllowedTime The timestamp when withdrawal is allowed.
     */
    struct StakeInfoWithId {
        uint256 tokenId; // stake id
        uint256 amount; // stake amount
        uint64 startTime; // stake start time
        uint64 lockupEndTime; // lockup end timestamp
        uint64 withdrawAllowedTime; // zero until it’s unstaked
    }

    /* EVENTS */

    /**
     * @notice Emitted when a new stake is created.
     * @param staker The address of the staker.
     * @param tokenId The id of the stake.
     * @param amount The amount of tokens staked.
     * @param startTime The timestamp when staking started.
     * @param lockupEndTime The timestamp when staking is locked up.
     */
    event Stake(
        address indexed staker,
        uint256 tokenId,
        uint256 amount,
        uint256 startTime,
        uint256 lockupEndTime
    );

    /**
     * @notice Emitted when a stake is relocked.
     * @param staker The address of the staker.
     * @param tokenId The id of the stake.
     * @param updatedOldStakeAmount The amount of tokens relocked.
     */
    event Relock(address indexed staker, uint256 tokenId, uint256 updatedOldStakeAmount);

    /**
     * @notice Emitted when a stake is unstaked.
     * @param staker The address of the staker.
     * @param tokenId The id of the stake.
     * @param amountToUnstake The amount of tokens unstaked.
     * @param withdrawAllowedTime When the withdrawal is allowed.
     */
    event Unstake(address indexed staker, uint256 tokenId, uint256 amountToUnstake, uint64 withdrawAllowedTime);

    /**
     * @notice Emitted when a stake is withdrawn.
     * @param staker The address of the staker.
     * @param tokenId The id of the stake.
     * @param amount The amount of tokens withdrawn.
     */
    event Withdraw(address indexed staker, uint256 tokenId, uint256 amount);

    /**
     * @notice Emitted when the allowed durations are updated.
     * @param duration The duration to update.
     * @param allowed The allowed status.
     */
    event UpdateAllowedDuration(uint256 duration, bool allowed);

    /**
     * @notice Emitted when the min stake amount is updated.
     * @param newMinStakeAmount The new min stake amount.
     */
    event UpdateMinStakeAmount(uint256 newMinStakeAmount);

    /**
     * @notice Emitted when the withdraw cooldown period is updated.
     * @param newWithdrawCooldown The new withdraw cooldown period.
     */
    event UpdateWithdrawCooldown(uint256 newWithdrawCooldown);

    /**
     * @notice Emitted when emergency unlock is called.
     */
    event EmergencyUnlock();

    /* ERRORS */

    /// @notice Reverts if an operation is attempted with a zero address where a valid address is expected.
    error ZeroAddress();

    /// @notice Reverts if an operation is attempted with non-allowed amount.
    error NotAllowedAmount(uint256 amount);

    /// @notice Reverts if an operation is attempted with a duration that is not allowed.
    error NotAllowedDuration(uint256 duration);

    /// @notice Reverts if an operation is attempted with an amount that is too early for unstake. (Lockup period has not passed yet)
    error TooEarlyForUnstake();

    /// @notice Reverts if an operation is attempted with an amount that is too early for relock. (Lockup period has not passed yet)
    error TooEarlyForRelock();

    /// @notice Reverts if an operation is attempted on a stake that has not been unstaked yet.
    error NotUnstakedYet();

    /// @notice Reverts if an operation is attempted on a stake that has already been unstaked.
    error AlreadyUnstaked();

    /// @notice Reverts if an operation is attempted on a stake that is not fully unstaked.
    error NonPartialUnstake();

    /// @notice Reverts if an operation is attempted with a stake that is not owned by the caller.
    error NotStakeOwner(uint256 id);

    /// @notice Reverts if admin attempts to set withdraw cooldown period to a value greater than the maximum.
    error MaxWithdrawCooldown();

    /// @notice Reverts if the operation cannot be performed because the contract is unlocked.
    error Unlocked();

    /* PUBLIC VARIABLES */
    /**
     * @notice Returns the keccak256 hash of the "CONTRACT_MANAGER_ROLE".
     * This role grants permissions to manage general contract configuration
     * (set allowed durations, min stake amount, etc.).
     * @return The bytes32 representation of the contract manager role.
     */
    function CONTRACT_MANAGER_ROLE() external view returns (bytes32);

    /**
     * @notice Returns the keccak256 hash of the "EMERGENCY_MANAGER_ROLE".
     * This role grants permissions to perform emergency unlock of all stakes.
     * @return The bytes32 representation of the emergency manager role.
     */
    function EMERGENCY_MANAGER_ROLE() external view returns (bytes32);

    /**
     * @notice Returns the keccak256 hash of the "PAUSER_ROLE".
     * This role grants permissions to pause the contract.
     * @return The bytes32 representation of the pauser role.
     */
    function PAUSER_ROLE() external view returns (bytes32);

    /**
     * @notice Returns the maximum withdraw cooldown period.
     * @return The maximum withdraw cooldown period in seconds.
     */
    function MAX_WITHDRAW_COOLDOWN() external view returns (uint256);

    /**
     * @notice Returns the keccak256 hash of the "UNPAUSER_ROLE".
     * This role grants permissions to unpause the contract.
     * @return The bytes32 representation of the unpauser role.
     */
    function UNPAUSER_ROLE() external view returns (bytes32);

    /**
     * @notice Returns the token to stake.
     * @return The address of the token to stake.
     */
    function stakeToken() external view returns (IERC20);

    /**
     * @notice Returns the NFT receipt contract (represents receipt of each stake).
     * @return The address of the NFT receipt contract.
     */
    function nftReceipt() external view returns (INftReceipt);

    /**
     * @notice Returns the last issued token id (stake id).
     * @return The last issued token id.
     */
    function lastId() external view returns (uint256);

    /**
     * @notice Returns the current total staked amount by all users.
     * @return The total staked amount.
     */
    function totalStaked() external view returns (uint256);

    /**
     * @notice Returns the minimum stake amount. (Can be zero)
     * @return The minimum stake amount.
     */
    function minStakeAmount() external view returns (uint256);

    /**
     * @notice Returns the cooldown period for withdrawing stake.
     * @return The cooldown period for withdrawing stake in seconds.
     */
    function withdrawCooldown() external view returns (uint256);

    /**
     * @notice Returns the flag for emergency unlock.
     * @return The flag for emergency unlock.
     */
    function unlockedAll() external view returns (bool);

    /**
     * @notice Return the total amount of a user's stakes.
     * @param account The address of the user.
     * @return The total amount of the user's stakes.
     */
    function totalUserStaked(address account) external view returns (uint256);

    /**
     * @notice Checks if a duration is allowed for staking.
     * @param duration The duration in seconds to check.
     * @return True if the duration is allowed, false otherwise.
     */
    function allowedDurations(uint256 duration) external view returns (bool);

    /**
     * @notice Initializes the Staking contract.
     * Sets up staking token, NFT receipt, initial allowed durations, withdrawal cooldown period,
     * access control, reentrancy guard, and pausable features.
     * Grants the `DEFAULT_ADMIN_ROLE` to the `defaultAdmin`.
     * @param _stakeToken The address of the ERC20 token to stake.
     * @param _nftReceipt The address of the NFT receipt contract.
     * @param _defaultAdmin The address to be granted the `DEFAULT_ADMIN_ROLE`.
     */
    function initialize(address _stakeToken, address _nftReceipt, address _defaultAdmin) external;

    /**
     * @notice Deposits tokens into contract and creates new stake for `msg.sender`
     * @dev The `amount` must be approved before deposit
     * @param amount The amount to stake
     * @param duration The duration of the stake in seconds
     * @return The id of the new stake
     */
    function stake(uint256 amount, uint256 duration) external returns (uint256);

    /**
     * @notice Deposits tokens into contract and creates new stake for `user` (stakes on behalf of user)
     * @dev The `amount` must be approved before deposit by the caller
     * @param user The address of the user - beneficiary of the stake
     * @param amount The amount to stake
     * @param duration The duration of the stake in seconds
     * @return The id of the new stake
     */
    function stake(address user, uint256 amount, uint256 duration) external returns (uint256);

    /**
     * @notice Partially relocks the stake: splits existing stake into two
     * @dev Decreases the amount of the existing stake and creates a new stake
     *      with specified amount and duration. The original stake must be unlocked
     *      (passed lockupTime) and not yet unstaked.
     * @param tokenId The id of the existing stake to partially relock
     * @param newLockDuration The duration for the new stake
     * @param newLockAmount The amount to transfer from old stake to new stake
     * @return The id of the newly created stake
     */
    function relock(
        uint256 tokenId,
        uint256 newLockDuration,
        uint256 newLockAmount
    ) external returns (uint256);

    /**
     * @notice Relocks the entire stake for a new duration
     * @dev The `tokenId` must be owned by `msg.sender`
     *      and the stake must be unlocked (passed lockupTime) and must not be unstaked
     * @param tokenId The id of the stake to relock
     * @param newLockDuration The new duration of the stake
     * @return The id of the new stake
     */
    function relock(uint256 tokenId, uint256 newLockDuration) external returns (uint256);

    /**
     * @notice Partial unstake of the stake. Unstakes the amountToUnstake for the further withdrawal.
     * Creates a new stake for the remaining amount with previous conditions.
     * @param tokenId The id of the stake to unstake
     * @param amountToUnstake The amount to unstake.
     * @return The id of the new stake
     */
    function unstake(uint256 tokenId, uint256 amountToUnstake) external returns (uint256);

    /**
     * @notice Unstakes the entire stake by setting the `withdrawAllowedTime`
     * @dev The `tokenId` must be owned by `msg.sender` and the stake must be unlocked (passed lockupEndTime)
     * @param tokenId The id of the stake to unstake
     */
    function unstake(uint256 tokenId) external;

    /**
     * @notice Withdraws the stake amount after the cooldown period
     * @dev The `tokenId` must be owned by `msg.sender` and the stake must be unstaked
     * @param tokenId - The id of the stake (NFT) to withdraw
     */
    function withdraw(uint256 tokenId) external;

    /* VIEW FUNCTIONS */

    /**
     * @notice Returns array of all users stakes
     * @param user The account address of staker
     */
    function getUserStakes(address user) external view returns (StakeInfoWithId[] memory);

    /**
     * @notice Returns the stake information for a given token id.
     * @param tokenId The id of the stake.
     * @return The `StakeInfo` struct containing details for the specified stake.
     */
    function stakeInfo(uint256 tokenId) external view returns (StakeInfo memory);

    /* ADMIN FUNCTIONS */

    /**
     * @notice Sets new allowed duration (or disables existing one)
     * @dev Only for the contract manager
     * @param _duration The duration to set
     * @param _allowed The allowed status
     */
    function setAllowedDuration(uint256 _duration, bool _allowed) external;

    /**
     * @notice Sets new min stake amount
     * @dev Only for the contract manager. Can be zero to disable.
     * @param _newMinStakeAmount The new min stake amount
     */
    function setMinStakeAmount(uint256 _newMinStakeAmount) external;

    /**
     * @notice Sets new withdraw cooldown period
     * @dev Only for the contract manager
     * @param _newWithdrawCooldown The new withdraw cooldown period
     */
    function setWithdrawCooldown(uint256 _newWithdrawCooldown) external;

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
     * @notice Unlocks all stakes and terminates staking functionality
     * @dev Only for emergency purposes
     */
    function emergencyUnlock() external;
}
