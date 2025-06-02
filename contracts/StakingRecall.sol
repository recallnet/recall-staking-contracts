// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {INftReceipt} from "./interfaces/INftReceipt.sol";

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

import {
    AccessControlUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import {
    ReentrancyGuardUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";


error ZeroAddress();
error NotAllowedAmount(uint256 amount);
error NotAllowedDuration(uint256 duration);
error AlreadyUnstaked();
error TooEarlyForUnstake();
error TooEarlyForRelock();
error NotUnstakedYet();
error NotStakeOwner(uint256 id);
error InvalidArraysLength();
error MaxWithdrawCooldown();
error Unlocked();

contract Staking is Initializable, PausableUpgradeable, AccessControlUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;


    event Stake(address staker, uint256 stakeId, uint256 amount, uint256 duration);
    event Relock(address staker, uint256 stakeId, uint256 duration);
    event Unstake(address staker, uint256 stakeId);
    event Withdraw(address staker, uint256 stakeId);

    event UpdateAllowedDuration(uint256 duration, bool allowed);
    event UpdateMinStakeAmount(uint256 newMinStakeAmount);
    event UpdateWithdrawCooldown(uint256 newWithdrawCooldown);
    event EmergencyUnlock();

    /// @notice Token to stake
    IERC20 public stakeToken;

    /// @notice NFT receipt contract (represents receipt of each stake)
    INftReceipt public nftReceipt;

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


    struct StakeInfo {
        uint256 amount;
        uint64 startTime;
        uint64 lockupEndTime;
        uint64 withdrawAllowedTime;
    }

    struct StakeInfoWithId {
        uint256 tokenId; // stake id
        uint256 amount;  // stake amount
        uint64 startTime; // stake start time
        uint64 lockupEndTime;  // lockup end timestamp
        uint64 withdrawAllowedTime; // zero until it’s unstaked
    }

    /// @notice Mapping of allowed durations
    mapping(uint256 duration => bool isAllowed) public allowedDurations;

    // cumulative amount of all user stakes (never decreases)
    mapping(address account => uint256) public totalUserStaked;

    mapping(uint256 tokenId => StakeInfo stake) public stakeInfo;

    mapping(address => EnumerableSet.UintSet) private _tokenIds;

    modifier whenNotUnlocked() {
        if (unlockedAll) revert Unlocked();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _stakeToken, address _nftReceipt, address _defaultAdmin) public initializer {
        if (_stakeToken == address(0) || _nftReceipt == address(0)) revert ZeroAddress();
        __Pausable_init();
        __ReentrancyGuard_init();
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _defaultAdmin);

        stakeToken = IERC20(_stakeToken);
        nftReceipt = INftReceipt(_nftReceipt);

        allowedDurations[30 days] = true;
        allowedDurations[60 days] = true;
        allowedDurations[90 days] = true;
    }

    /**
     * @notice Deposits tokens into contract and creates new stake for `msg.sender`
     * @dev The `amount` must be approved before deposit
     * @param amount - The amount to stake
     * @param duration - The duration of the stake in seconds
     * @return The id of the stake
     */
    function stake(uint256 amount, uint256 duration) public whenNotPaused whenNotUnlocked nonReentrant returns (uint256) {
        if (!allowedDurations[duration]) revert NotAllowedDuration(duration);
        if (amount == 0 || amount < minStakeAmount) revert NotAllowedAmount(amount);

        uint256 _lastId = ++lastId;

        totalUserStaked[msg.sender] += amount;
        totalStaked += amount;


        _tokenIds[msg.sender].add(_lastId);
        stakeInfo[_lastId] = StakeInfo(
            uint256(amount),
            uint64(block.timestamp),
            uint64(block.timestamp + duration),
            0
        );

        nftReceipt.mint(msg.sender, _lastId);
        stakeToken.safeTransferFrom(msg.sender, address(this), amount);

        emit Stake(msg.sender, _lastId, amount, duration);
        return _lastId;
    }


    /**
     * @notice Partial relock of the stake

    the previous stake here that exists right now will be decreased 
    and in parallel we create a new one with new lock amount. 

    in partial relock, make new stakeInfo for the locked share: with startTime set to when relock is called.
    The existing stakeInfo holds the remaining unlocked-but-still-staked amount
    */

    function relock(
        uint256 tokenId,
        uint256 newLockDuration,
        uint256 newLockAmount
    ) external whenNotPaused whenNotUnlocked nonReentrant returns (uint256) {
        if (!allowedDurations[newLockDuration]) revert NotAllowedDuration(newLockDuration);
        if (!_tokenIds[msg.sender].contains(tokenId)) revert NotStakeOwner(tokenId);

        StakeInfo storage userOldStake = stakeInfo[tokenId];
        if (block.timestamp < userOldStake.lockupEndTime) revert TooEarlyForRelock();
        
        // update existing stakeInfo
        userOldStake.amount -= newLockAmount;

        // create new stakeInfo
        uint256 _lastId = ++lastId;

        _tokenIds[msg.sender].add(_lastId);
        stakeInfo[_lastId] = StakeInfo(
            uint256(newLockAmount),
            uint64(block.timestamp),
            uint64(newLockDuration),
            0
        );
        nftReceipt.mint(msg.sender, _lastId);

        // @todo consider emitting two kinds of events: Relock and Stake
        emit Relock(msg.sender, tokenId, newLockDuration);

        return _lastId;
    }

    /**
     * @notice Relocks the entire stake for a new duration
     * @dev The `tokenId` must be owned by `msg.sender` and the stake must be unlocked
     * @param tokenId - The id of the stake to relock
     * @param newLockDuration - The new duration of the stake
     */
    function relock(uint256 tokenId, uint256 newLockDuration) external whenNotPaused whenNotUnlocked nonReentrant returns (uint256) {
        if (!allowedDurations[newLockDuration]) revert NotAllowedDuration(newLockDuration);
        if (!_tokenIds[msg.sender].remove(tokenId)) revert NotStakeOwner(tokenId);

        StakeInfo memory userOldStake = stakeInfo[tokenId];
        if (block.timestamp < userOldStake.lockupEndTime) revert TooEarlyForRelock();
        delete stakeInfo[tokenId];

        // create new stakeInfo
        uint256 _lastId = ++lastId;
        _tokenIds[msg.sender].add(_lastId);
        stakeInfo[_lastId] = StakeInfo(
            uint256(userOldStake.amount),
            uint64(block.timestamp),
            uint64(block.timestamp + newLockDuration),
            0
        );

        nftReceipt.burn(msg.sender, tokenId);
        nftReceipt.mint(msg.sender, _lastId);
        
        // @todo events
        emit Relock(msg.sender, tokenId, newLockDuration);

        return _lastId;
    }



    /**
     * @notice Partial unstake of the stake
      each partial unstake must create a new token id. 
     */
    function unstake(uint256 tokenId, uint256 amountToUnstake) public whenNotUnlocked nonReentrant returns (uint256) {
        StakeInfo storage userOldStake = stakeInfo[tokenId];
        if (block.timestamp < userOldStake.lockupEndTime) revert TooEarlyForUnstake();
        if (!_tokenIds[msg.sender].contains(tokenId)) revert NotStakeOwner(tokenId);

        uint256 newStakeAmount = userOldStake.amount - amountToUnstake;
        userOldStake.amount -= amountToUnstake;
        userOldStake.withdrawAllowedTime = uint64(block.timestamp + withdrawCooldown);

        // create new unlocked stakeInfo with remaining amount
        uint256 _lastId = ++lastId;
        _tokenIds[msg.sender].add(_lastId);
        stakeInfo[_lastId] = StakeInfo(
            uint256(newStakeAmount),
            uint64(userOldStake.startTime),
            uint64(userOldStake.lockupEndTime),
            0
        );
        nftReceipt.mint(msg.sender, _lastId);

        // @todo events
        emit Unstake(msg.sender, tokenId);

        return _lastId;
    }

    /**
     * @notice Unstakes the entire stake by setting the `withdrawAllowedTime`
     * @dev The `tokenId` must be owned by `msg.sender` and the stake must be unlocked
     * @param tokenId - The id of the stake to unstake
     */
    function unstake(uint256 tokenId) external nonReentrant {
        StakeInfo storage userStake = stakeInfo[tokenId];
        if (block.timestamp < userStake.lockupEndTime) revert TooEarlyForUnstake();
        if (!_tokenIds[msg.sender].contains(tokenId)) revert NotStakeOwner(tokenId);

        userStake.withdrawAllowedTime = uint64(block.timestamp + withdrawCooldown);
        
        // @todo events
        emit Unstake(msg.sender, tokenId);
    }


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

        emit Withdraw(msg.sender, tokenId);
    }

    function multiWithdraw(uint256[] calldata idxs) external nonReentrant {
        for (uint256 i = 0; i < idxs.length; ++i) {
            withdraw(idxs[i]);
        }
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

    function setMinStakeAmount(uint256 _newMinStakeAmount) external onlyRole(CONTRACT_MANAGER_ROLE) {
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

    function pause() external onlyRole(CONTRACT_MANAGER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(CONTRACT_MANAGER_ROLE) {
        _unpause();
    }

    /**
     * @notice Unlocks all stakes and terminates staking functionality
     * @dev Only for emergency purposes
     */
    function emergencyUnlock() external onlyRole(EMERGENCY_MANAGER_ROLE) {
        unlockedAll = true;
        emit EmergencyUnlock();
    }
}
