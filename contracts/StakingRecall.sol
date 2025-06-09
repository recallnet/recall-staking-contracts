// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {INftReceipt} from "./interfaces/INftReceipt.sol";

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {
    PausableUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

import {
    AccessControlUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import {
    ReentrancyGuardUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {
    MulticallUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/MulticallUpgradeable.sol";

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {IStaking} from "./interfaces/IStaking.sol";

contract Staking is
    Initializable,
    PausableUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    MulticallUpgradeable,
    IStaking
{
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;

    /// @notice Token to stake
    IERC20 public override stakeToken;

    /// @notice NFT receipt contract (represents receipt of each stake)
    INftReceipt public override nftReceipt;

    /// @notice Last stake id
    uint256 public lastId;

    /// @notice Total staked amount
    uint256 public totalStaked;

    /// @notice Minimum stake amount
    uint256 public minStakeAmount;

    /// @notice Cooldown period for withdrawing stake
    uint256 public withdrawCooldown;

    bool public unlockedAll;

    uint256 public constant MAX_WITHDRAW_COOLDOWN = 180 days;

    bytes32 public constant CONTRACT_MANAGER_ROLE = keccak256("CONTRACT_MANAGER_ROLE");

    bytes32 public constant EMERGENCY_MANAGER_ROLE = keccak256("EMERGENCY_MANAGER_ROLE");

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    bytes32 public constant UNPAUSER_ROLE = keccak256("UNPAUSER_ROLE");

    /// @notice Mapping of allowed durations
    mapping(uint256 duration => bool isAllowed) public allowedDurations;

    /// @notice Total amount of all user's stakes
    mapping(address account => uint256) public totalUserStaked;

    mapping(uint256 tokenId => StakeInfo stake) public stakeInfo;

    mapping(address => EnumerableSet.UintSet) private _tokenIds;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _stakeToken,
        address _nftReceipt,
        address _defaultAdmin
    ) public initializer {
        if (_stakeToken == address(0) || _nftReceipt == address(0) || _defaultAdmin == address(0))
            revert ZeroAddress();

        __Pausable_init();
        __ReentrancyGuard_init();
        __AccessControl_init();
        __Multicall_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _defaultAdmin);

        stakeToken = IERC20(_stakeToken);
        nftReceipt = INftReceipt(_nftReceipt);

        allowedDurations[30 days] = true;
        allowedDurations[60 days] = true;
        allowedDurations[90 days] = true;

        withdrawCooldown = 30 days;
    }

    /**
     * @notice Deposits tokens into contract and creates new stake for `msg.sender`
     * @dev The `amount` must be approved before deposit
     * @param amount - The amount to stake
     * @param duration - The duration of the stake in seconds
     * @return The id of the stake
     */
    function stake(
        uint256 amount,
        uint256 duration
    ) public whenNotPaused nonReentrant returns (uint256) {
        if (!allowedDurations[duration]) revert NotAllowedDuration(duration);
        if (amount == 0 || amount < minStakeAmount) revert NotAllowedAmount(amount);

        uint256 newTokenId = ++lastId;

        totalUserStaked[msg.sender] += amount;
        totalStaked += amount;

        uint256 lockupEndTime = block.timestamp + duration;
        _tokenIds[msg.sender].add(newTokenId);
        stakeInfo[newTokenId] = StakeInfo(
            uint256(amount),
            uint64(block.timestamp),
            uint64(lockupEndTime),
            0
        );

        nftReceipt.mint(msg.sender, newTokenId);
        stakeToken.safeTransferFrom(msg.sender, address(this), amount);

        emit Stake(msg.sender, newTokenId, amount, block.timestamp, lockupEndTime);
        return newTokenId;
    }

    /**
     * @notice Partial relock of the stake:
     * decreases the amount of the existing stake 
     * and creates a new one with new lock amount and duration
     * @dev The previous stake will be decreased and created new one 


    the previous stake here that exists right now will be decreased 
    and in parallel we create a new one with new lock amount. 

    in partial relock, make new stakeInfo for the locked share: with startTime set to when relock is called.
    The existing stakeInfo holds the remaining unlocked-but-still-staked amount
    */
    function relock(
        uint256 tokenId,
        uint256 newLockDuration,
        uint256 newLockAmount
    ) external whenNotPaused nonReentrant returns (uint256) {
        if (!allowedDurations[newLockDuration]) revert NotAllowedDuration(newLockDuration);
        if (newLockAmount == 0 || newLockAmount < minStakeAmount) revert NotAllowedAmount(newLockAmount);
        if (!_tokenIds[msg.sender].contains(tokenId)) revert NotStakeOwner(tokenId);

        StakeInfo storage userOldStake = stakeInfo[tokenId];
        if (userOldStake.withdrawAllowedTime != 0) revert AlreadyUnstaked();
        if (block.timestamp < userOldStake.lockupEndTime) revert TooEarlyForRelock();

        // update existing stakeInfo
        userOldStake.amount -= newLockAmount;

        // create new stakeInfo
        uint256 newTokenId = ++lastId;

        _tokenIds[msg.sender].add(newTokenId);
        stakeInfo[newTokenId] = StakeInfo(
            uint256(newLockAmount),
            uint64(block.timestamp),
            uint64(block.timestamp + newLockDuration),
            0
        );
        nftReceipt.mint(msg.sender, newTokenId);

        emit Relock(msg.sender, tokenId, userOldStake.amount);
        emit Stake(
            msg.sender,
            newTokenId,
            newLockAmount,
            block.timestamp,
            block.timestamp + newLockDuration
        );
        return newTokenId;
    }

    /**
     * @notice Relocks the entire stake for a new duration
     * @dev The `tokenId` must be owned by `msg.sender`
     *      and the stake must be unlocked (passed lockupTime) and must not be unstaked
     * @param tokenId - The id of the stake to relock
     * @param newLockDuration - The new duration of the stake
     * @return The id of the new stake
     */
    function relock(
        uint256 tokenId,
        uint256 newLockDuration
    ) external whenNotPaused nonReentrant returns (uint256) {
        if (!allowedDurations[newLockDuration]) revert NotAllowedDuration(newLockDuration);
        if (!_tokenIds[msg.sender].remove(tokenId)) revert NotStakeOwner(tokenId);

        StakeInfo memory userOldStake = stakeInfo[tokenId];
        if (userOldStake.withdrawAllowedTime != 0) revert AlreadyUnstaked();
        if (block.timestamp < userOldStake.lockupEndTime) revert TooEarlyForRelock();
        delete stakeInfo[tokenId];

        // create new stakeInfo
        uint256 newTokenId = ++lastId;
        _tokenIds[msg.sender].add(newTokenId);
        stakeInfo[newTokenId] = StakeInfo(
            uint256(userOldStake.amount),
            uint64(block.timestamp),
            uint64(block.timestamp + newLockDuration),
            0
        );

        nftReceipt.burn(msg.sender, tokenId);
        nftReceipt.mint(msg.sender, newTokenId);

        emit Relock(msg.sender, tokenId, 0);
        emit Stake(
            msg.sender,
            newTokenId,
            userOldStake.amount,
            block.timestamp,
            block.timestamp + newLockDuration
        );

        return newTokenId;
    }

    /**
     * @notice Partial unstake of the stake. Unstakes the amountToUnstake for the further withdrawal.
     * Creates a new stake for the remaining amount with previous conditions.
     * @param tokenId - The id of the stake to unstake
     * @param amountToUnstake - The amount to unstake.
     * @return The id of the new stake
     */
    function unstake(
        uint256 tokenId,
        uint256 amountToUnstake
    ) public whenNotPaused nonReentrant returns (uint256) {
        StakeInfo storage userOldStake = stakeInfo[tokenId];
        if (block.timestamp < userOldStake.lockupEndTime) revert TooEarlyForUnstake();
        if (userOldStake.withdrawAllowedTime != 0) revert AlreadyUnstaked();
        if (!_tokenIds[msg.sender].contains(tokenId)) revert NotStakeOwner(tokenId);

        // @dev reverts in case amount exceeds stake amount
        uint256 newStakeAmount = userOldStake.amount - amountToUnstake;
        userOldStake.amount = amountToUnstake;
        userOldStake.withdrawAllowedTime = uint64(block.timestamp + withdrawCooldown);

        if (newStakeAmount == 0) revert NonPartialUnstake();
        // create new stakeInfo with remaining amount and same startTime, lockupEndTime
        uint256 newTokenId = ++lastId;
        _tokenIds[msg.sender].add(newTokenId);
        stakeInfo[newTokenId] = StakeInfo(
            uint256(newStakeAmount),
            uint64(userOldStake.startTime),
            uint64(userOldStake.lockupEndTime),
            0
        );
        nftReceipt.mint(msg.sender, newTokenId);

        emit Unstake(msg.sender, tokenId, amountToUnstake);
        emit Stake(
            msg.sender,
            newTokenId,
            newStakeAmount,
            userOldStake.startTime,
            userOldStake.lockupEndTime
        );
        return newTokenId;
    }

    /**
     * @notice Unstakes the entire stake by setting the `withdrawAllowedTime`
     * @dev The `tokenId` must be owned by `msg.sender` and the stake must be unlocked (passed lockupEndTime)
     * @param tokenId - The id of the stake to unstake
     */
    function unstake(uint256 tokenId) external whenNotPaused nonReentrant {
        StakeInfo storage userStake = stakeInfo[tokenId];
        if (block.timestamp < userStake.lockupEndTime) revert TooEarlyForUnstake();
        if (userStake.withdrawAllowedTime != 0) revert AlreadyUnstaked();
        if (!_tokenIds[msg.sender].contains(tokenId)) revert NotStakeOwner(tokenId);

        userStake.withdrawAllowedTime = uint64(block.timestamp + withdrawCooldown);

        emit Unstake(msg.sender, tokenId, userStake.amount);
    }

    /**
     * @notice Withdraws the stake amount after the cooldown period
     * @dev The `tokenId` must be owned by `msg.sender` and the stake must be unstaked
     * @param tokenId - The id of the stake (NFT) to withdraw
     */
    function withdraw(uint256 tokenId) public nonReentrant {
        StakeInfo memory userStake = stakeInfo[tokenId];

        if (!unlockedAll) {
            if (block.timestamp < userStake.withdrawAllowedTime) revert NotUnstakedYet();
            if (!_tokenIds[msg.sender].remove(tokenId)) revert NotStakeOwner(tokenId);
        }

        delete stakeInfo[tokenId];

        totalUserStaked[msg.sender] -= userStake.amount;
        totalStaked -= userStake.amount;

        nftReceipt.burn(msg.sender, tokenId);
        stakeToken.safeTransfer(msg.sender, userStake.amount);

        emit Withdraw(msg.sender, tokenId, userStake.amount);
    }

    /**
     * @notice Returns array of all users stakes
     * @param user The account address of staker
     */
    function getUserStakes(address user) external view returns (StakeInfoWithId[] memory) {
        uint256[] memory tokenIds = _tokenIds[user].values();

        StakeInfoWithId[] memory _stakes = new StakeInfoWithId[](tokenIds.length);
        for (uint256 i = 0; i < tokenIds.length; i++) {
            _stakes[i] = StakeInfoWithId(
                tokenIds[i],
                stakeInfo[tokenIds[i]].amount,
                stakeInfo[tokenIds[i]].startTime,
                stakeInfo[tokenIds[i]].lockupEndTime,
                stakeInfo[tokenIds[i]].withdrawAllowedTime
            );
        }
        return _stakes;
    }

    function setAllowedDuration(
        uint256 _duration,
        bool _allowed
    ) external onlyRole(CONTRACT_MANAGER_ROLE) {
        allowedDurations[_duration] = _allowed;
        emit UpdateAllowedDuration(_duration, _allowed);
    }

    function setMinStakeAmount(
        uint256 _newMinStakeAmount
    ) external onlyRole(CONTRACT_MANAGER_ROLE) {
        minStakeAmount = _newMinStakeAmount;
        emit UpdateMinStakeAmount(_newMinStakeAmount);
    }

    function setWithdrawCooldown(
        uint256 _newWithdrawCooldown
    ) external onlyRole(CONTRACT_MANAGER_ROLE) {
        if (_newWithdrawCooldown > MAX_WITHDRAW_COOLDOWN) revert MaxWithdrawCooldown();

        withdrawCooldown = _newWithdrawCooldown;
        emit UpdateWithdrawCooldown(_newWithdrawCooldown);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(UNPAUSER_ROLE) {
        if (unlockedAll) revert Unlocked();
        _unpause();
    }

    /**
     * @notice Unlocks all stakes and terminates staking functionality
     * @dev Only for emergency purposes
     */
    function emergencyUnlock() external whenPaused onlyRole(EMERGENCY_MANAGER_ROLE) {
        unlockedAll = true;
        emit EmergencyUnlock();
    }
}
