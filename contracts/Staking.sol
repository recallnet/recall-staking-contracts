// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

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

    /* GLOBAL VARIABLES */

    /// @inheritdoc IStaking
    bytes32 public constant override CONTRACT_MANAGER_ROLE = keccak256("CONTRACT_MANAGER_ROLE");

    /// @inheritdoc IStaking
    bytes32 public constant override EMERGENCY_MANAGER_ROLE = keccak256("EMERGENCY_MANAGER_ROLE");

    /// @inheritdoc IStaking
    bytes32 public constant override PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @inheritdoc IStaking
    bytes32 public constant override UNPAUSER_ROLE = keccak256("UNPAUSER_ROLE");

    /// @inheritdoc IStaking
    uint256 public constant override MAX_WITHDRAW_COOLDOWN = 180 days;

    /// @inheritdoc IStaking
    IERC20 public override stakeToken;

    /// @inheritdoc IStaking
    INftReceipt public override nftReceipt;

    /// @inheritdoc IStaking
    uint256 public override lastId;

    /// @inheritdoc IStaking
    uint256 public override totalStaked;

    /// @inheritdoc IStaking
    uint256 public override minStakeAmount;

    /// @inheritdoc IStaking
    uint256 public override withdrawCooldown;

    /// @inheritdoc IStaking
    bool public unlockedAll;

    /// @inheritdoc IStaking
    mapping(address account => uint256 stakedAmount) public override totalUserStaked;

    /// @inheritdoc IStaking
    mapping(uint256 duration => bool isAllowed) public override allowedDurations;

    mapping(uint256 tokenId => StakeInfo stake) private _stakeInfo;

    /// @dev Mapping of stake owners to the set of their stakes
    mapping(address => EnumerableSet.UintSet) private _tokenIds;

    /* CONSTRUCTOR */

    /**
     * @dev Constructor for the upgradeable contract.
     * It disables initializers to prevent re-initialization through the implementation contract.
     * The actual initialization is done via the `initialize` function.
     */
    constructor() {
        _disableInitializers();
    }

    /* INITIALIZER */

    /// @inheritdoc IStaking
    function initialize(
        address _stakeToken,
        address _nftReceipt,
        address _defaultAdmin
    ) external override initializer {
        if (_stakeToken == address(0) || _nftReceipt == address(0) || _defaultAdmin == address(0))
            revert ZeroAddress();

        __Pausable_init();
        __ReentrancyGuard_init();
        __AccessControl_init();
        __Multicall_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _defaultAdmin);

        stakeToken = IERC20(_stakeToken);
        nftReceipt = INftReceipt(_nftReceipt);

        // set up initial values
        _setAllowedDuration(90 days, true);
        _setAllowedDuration(180 days, true);
        _setAllowedDuration(270 days, true);
        _setAllowedDuration(365 days, true);

        withdrawCooldown = 30 days;
        emit UpdateWithdrawCooldown(30 days);
    }

    /* EXTERNAL USER FUNCTIONS */

    /// @inheritdoc IStaking
    function stake(uint256 amount, uint256 duration) external returns (uint256) {
        return _stake(msg.sender, amount, duration);
    }

    /// @inheritdoc IStaking
    function stake(address user, uint256 amount, uint256 duration) external returns (uint256) {
        return _stake(user, amount, duration);
    }

    /// @dev Stakes tokens for a `user`
    function _stake(
        address user,
        uint256 amount,
        uint256 duration
    ) internal whenNotPaused nonReentrant returns (uint256) {
        if (!allowedDurations[duration]) revert NotAllowedDuration(duration);
        if (amount == 0 || amount < minStakeAmount) revert NotAllowedAmount(amount);

        uint256 newTokenId = ++lastId;

        totalUserStaked[user] += amount;
        totalStaked += amount;

        uint256 lockupEndTime = block.timestamp + duration;
        _tokenIds[user].add(newTokenId);
        _stakeInfo[newTokenId] = StakeInfo(
            uint256(amount),
            uint64(block.timestamp),
            uint64(lockupEndTime),
            0
        );

        nftReceipt.mint(user, newTokenId);
        stakeToken.safeTransferFrom(msg.sender, address(this), amount);

        emit Stake(user, newTokenId, amount, block.timestamp, lockupEndTime);
        return newTokenId;
    }

    /// @inheritdoc IStaking
    function relock(
        uint256 tokenId,
        uint256 newLockDuration,
        uint256 newLockAmount
    ) external whenNotPaused nonReentrant returns (uint256) {
        if (!allowedDurations[newLockDuration]) revert NotAllowedDuration(newLockDuration);

        StakeInfo storage userOldStake = _stakeInfo[tokenId];
        if (
            newLockAmount == 0 ||
            newLockAmount < minStakeAmount ||
            newLockAmount >= userOldStake.amount
        ) revert NotAllowedAmount(newLockAmount);
        if (!_tokenIds[msg.sender].contains(tokenId)) revert NotStakeOwner(tokenId);

        if (userOldStake.withdrawAllowedTime != 0) revert AlreadyUnstaked();
        if (block.timestamp < userOldStake.lockupEndTime) revert TooEarlyForRelock();

        // update existing _stakeInfo
        userOldStake.amount -= newLockAmount;

        // create new _stakeInfo
        uint256 newTokenId = ++lastId;

        _tokenIds[msg.sender].add(newTokenId);
        _stakeInfo[newTokenId] = StakeInfo(
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

    /// @inheritdoc IStaking
    function relock(
        uint256 tokenId,
        uint256 newLockDuration
    ) external whenNotPaused nonReentrant returns (uint256) {
        if (!allowedDurations[newLockDuration]) revert NotAllowedDuration(newLockDuration);
        if (!_tokenIds[msg.sender].remove(tokenId)) revert NotStakeOwner(tokenId);

        StakeInfo memory userOldStake = _stakeInfo[tokenId];
        if (userOldStake.withdrawAllowedTime != 0) revert AlreadyUnstaked();
        if (block.timestamp < userOldStake.lockupEndTime) revert TooEarlyForRelock();
        delete _stakeInfo[tokenId];

        // create new _stakeInfo
        uint256 newTokenId = ++lastId;
        _tokenIds[msg.sender].add(newTokenId);
        _stakeInfo[newTokenId] = StakeInfo(
            uint256(userOldStake.amount),
            uint64(block.timestamp),
            uint64(block.timestamp + newLockDuration),
            0
        );

        nftReceipt.burn(tokenId);
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

    /// @inheritdoc IStaking
    function unstake(
        uint256 tokenId,
        uint256 amountToUnstake
    ) external whenNotPaused nonReentrant returns (uint256) {
        StakeInfo storage userOldStake = _stakeInfo[tokenId];
        if (block.timestamp < userOldStake.lockupEndTime) revert TooEarlyForUnstake();
        if (userOldStake.withdrawAllowedTime != 0) revert AlreadyUnstaked();
        if (!_tokenIds[msg.sender].contains(tokenId)) revert NotStakeOwner(tokenId);

        // @dev reverts in case amount exceeds stake amount
        uint256 newStakeAmount = userOldStake.amount - amountToUnstake;
        userOldStake.amount = amountToUnstake;
        userOldStake.withdrawAllowedTime = uint64(block.timestamp + withdrawCooldown);

        if (newStakeAmount == 0) revert NonPartialUnstake();
        // create new _stakeInfo with remaining amount and same startTime, lockupEndTime
        uint256 newTokenId = ++lastId;
        _tokenIds[msg.sender].add(newTokenId);
        _stakeInfo[newTokenId] = StakeInfo(
            uint256(newStakeAmount),
            uint64(userOldStake.startTime),
            uint64(userOldStake.lockupEndTime),
            0
        );
        nftReceipt.mint(msg.sender, newTokenId);

        emit Unstake(msg.sender, tokenId, amountToUnstake, userOldStake.withdrawAllowedTime);
        emit Stake(
            msg.sender,
            newTokenId,
            newStakeAmount,
            userOldStake.startTime,
            userOldStake.lockupEndTime
        );
        return newTokenId;
    }

    /// @inheritdoc IStaking
    function unstake(uint256 tokenId) external whenNotPaused nonReentrant {
        StakeInfo storage userStake = _stakeInfo[tokenId];
        if (block.timestamp < userStake.lockupEndTime) revert TooEarlyForUnstake();
        if (userStake.withdrawAllowedTime != 0) revert AlreadyUnstaked();
        if (!_tokenIds[msg.sender].contains(tokenId)) revert NotStakeOwner(tokenId);

        userStake.withdrawAllowedTime = uint64(block.timestamp + withdrawCooldown);

        emit Unstake(msg.sender, tokenId, userStake.amount, userStake.withdrawAllowedTime);
    }

    /// @inheritdoc IStaking
    function withdraw(uint256 tokenId) external nonReentrant {
        bool _unlockedAll = unlockedAll;
        if (paused() && !_unlockedAll) revert EnforcedPause();

        StakeInfo memory userStake = _stakeInfo[tokenId];

        if (!_unlockedAll) {
            if (
                block.timestamp < userStake.withdrawAllowedTime ||
                userStake.withdrawAllowedTime == 0
            ) revert NotUnstakedYet();
        }
        if (!_tokenIds[msg.sender].remove(tokenId)) revert NotStakeOwner(tokenId);

        delete _stakeInfo[tokenId];

        totalUserStaked[msg.sender] -= userStake.amount;
        totalStaked -= userStake.amount;

        nftReceipt.burn(tokenId);
        stakeToken.safeTransfer(msg.sender, userStake.amount);

        emit Withdraw(msg.sender, tokenId, userStake.amount);
    }

    /* VIEW FUNCTIONS */

    /// @inheritdoc IStaking
    function getUserStakes(address user) external view returns (StakeInfoWithId[] memory) {
        uint256[] memory tokenIds = _tokenIds[user].values();

        StakeInfoWithId[] memory _stakes = new StakeInfoWithId[](tokenIds.length);
        for (uint256 i = 0; i < tokenIds.length; i++) {
            _stakes[i] = StakeInfoWithId(
                tokenIds[i],
                _stakeInfo[tokenIds[i]].amount,
                _stakeInfo[tokenIds[i]].startTime,
                _stakeInfo[tokenIds[i]].lockupEndTime,
                _stakeInfo[tokenIds[i]].withdrawAllowedTime
            );
        }
        return _stakes;
    }

    /// @inheritdoc IStaking
    function stakeInfo(uint256 tokenId) external view returns (StakeInfo memory) {
        return _stakeInfo[tokenId];
    }

    /* ADMIN FUNCTIONS */

    /// @inheritdoc IStaking
    function setAllowedDuration(
        uint256 _duration,
        bool _allowed
    ) external onlyRole(CONTRACT_MANAGER_ROLE) {
        _setAllowedDuration(_duration, _allowed);
    }

    /// @dev Sets new allowed duration (or disables existing one)
    function _setAllowedDuration(uint256 _duration, bool _allowed) internal {
        allowedDurations[_duration] = _allowed;
        emit UpdateAllowedDuration(_duration, _allowed);
    }

    /// @inheritdoc IStaking
    function setMinStakeAmount(
        uint256 _newMinStakeAmount
    ) external onlyRole(CONTRACT_MANAGER_ROLE) {
        minStakeAmount = _newMinStakeAmount;
        emit UpdateMinStakeAmount(_newMinStakeAmount);
    }

    /// @inheritdoc IStaking
    function setWithdrawCooldown(
        uint256 _newWithdrawCooldown
    ) external onlyRole(CONTRACT_MANAGER_ROLE) {
        if (_newWithdrawCooldown > MAX_WITHDRAW_COOLDOWN) revert MaxWithdrawCooldown();

        withdrawCooldown = _newWithdrawCooldown;
        emit UpdateWithdrawCooldown(_newWithdrawCooldown);
    }

    /// @inheritdoc IStaking
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @inheritdoc IStaking
    function unpause() external onlyRole(UNPAUSER_ROLE) {
        if (unlockedAll) revert Unlocked();
        _unpause();
    }

    /// @inheritdoc IStaking
    function emergencyUnlock() external whenPaused onlyRole(EMERGENCY_MANAGER_ROLE) {
        unlockedAll = true;
        emit EmergencyUnlock();
    }
}
