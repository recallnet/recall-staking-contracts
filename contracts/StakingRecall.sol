// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol"; // @todo replace with NFT receipt interface

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {
    AccessControlUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {
    ReentrancyGuardUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

error ZeroAddress();
error NotAllowedAmount(uint256 amount);
error NotAllowedDuration(uint256 duration);
error AlreadyUnstaked();
error TooEarlyForRestake();
error NotUnstakedYet();
error NotStakeOwner(uint256 id);

error InvalidArraysLength();

// @todo add Pause
contract Staking is Initializable, AccessControlUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    event Stake(address staker, uint256 stakeId, uint256 amount, uint256 duration);
    event Restake(address staker, uint256 stakeId, uint256 duration);
    event Unstake(address staker, uint256 stakeId);
    event Withdraw(address staker, uint256 stakeId, uint256 amount, uint256 duration);

    event UpdateAllowedDuration(uint256 duration, bool allowed);
    event UpdateMinStakeAmount(uint256 newMinStakeAmount);
    event UpdateWithdrawCooldown(uint256 newWithdrawCooldown);

    /// @notice Token to stake
    IERC20 public stakeToken;

    /// @notice NFT receipt contract (represents receipt of each stake)
    IERC721 public nftReceipt;

    /// @notice Last stake id
    uint256 public lastId;

    /// @notice Total staked amount
    uint256 public totalStaked;

    /// @notice Minimum stake amount
    uint256 public minStakeAmount;

    /// @notice Cooldown period for withdrawing stake
    uint256 public withdrawCooldown;

    struct StakeInfo {
        uint256 amount;
        uint64 startTime;
        uint64 duration;
        uint64 withdrawTime;
    }

    mapping(uint256 duration => bool allowed) public allowedDurations;

    // cumulative amount of all user stakes (never decreases)
    mapping(address account => uint256) public totalUserStaked;

    mapping(uint256 id => StakeInfo stake) public stakeInfo;

    mapping(address account => uint256[] ids) public userIds;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _stakeToken, address _nftReceipt) public initializer {
        if (_stakeToken == address(0) || _nftReceipt == address(0)) revert ZeroAddress();
        __AccessControl_init();

        stakeToken = IERC20(_stakeToken);
        nftReceipt = IERC721(_nftReceipt);

        allowedDurations[30 days] = true;
        allowedDurations[60 days] = true;
        allowedDurations[90 days] = true;
    }

    /**
     * @notice Deposits tokens into contract and creates new stake for `msg.sender`
     * @dev The `amount` must be approved before deposit
     * @param amount - The amount to stake
     * @param duration - The duration of the stake in seconds
     */
    function stake(uint256 amount, uint256 duration) public nonReentrant {
        if (!allowedDurations[duration]) revert NotAllowedDuration(duration);
        if (amount == 0 || amount < minStakeAmount) revert NotAllowedAmount(amount);

        totalUserStaked[msg.sender] += amount;
        totalStaked += amount;

        uint256 _lastId = lastId;
        ++lastId;

        userIds[msg.sender].push(_lastId);
        stakeInfo[_lastId] = StakeInfo(
            uint256(amount),
            uint64(block.timestamp),
            uint64(duration),
            0
        );

        nftReceipt.mint(msg.sender, _lastId);
        stakeToken.transferFrom(msg.sender, address(this), amount);

        emit Stake(msg.sender, _lastId, amount, duration);
    }

    function multiStake(
        uint256[] calldata amounts,
        uint256[] calldata durations
    ) external nonReentrant {
        if (amounts.length != durations.length) revert InvalidArraysLength();
        for (uint256 i = 0; i < amounts.length; ++i) {
            stake(amounts[i], durations[i]);
        }
    }

    function restake(uint256 id, uint256 duration) public nonReentrant {
        if (!allowedDurations[duration]) revert NotAllowedDuration(duration);
        if (!nftReceipt.ownerOf(id) == msg.sender) revert NotStakeOwner(id);

        StakeInfo storage userStake = stakeInfo[id];
        if (block.timestamp < userStake.startTime + userStake.duration) revert TooEarlyForRestake();

        userStake.startTime = uint64(block.timestamp);
        userStake.duration = uint64(duration);

        emit Restake(msg.sender, id, duration);
    }

    function multiRestake(
        uint256[] calldata ids,
        uint256[] calldata durations
    ) external nonReentrant {
        if (ids.length != durations.length) revert InvalidArraysLength();
        for (uint256 i = 0; i < ids.length; ++i) {
            restake(ids[i], durations[i]);
        }
    }

    /**
     * @notice
     * @param id - The stake index (for first stake use 0)
     */
    function unstake(uint256 id) public nonReentrant {
        StakeInfo storage userStake = stakeInfo[id];
        if (userStake.withdrawTime != 0) revert AlreadyUnstaked();
        if (!nftReceipt.ownerOf(id) == msg.sender) revert NotStakeOwner(id);

        userStake.withdrawTime = uint64(block.timestamp + withdrawCooldown);

        emit Unstake(msg.sender, id);
    }

    function multiUnstake(uint256[] calldata ids) external nonReentrant {
        for (uint256 i = 0; i < ids.length; ++i) {
            unstake(ids[i]);
        }
    }

    function withdraw(uint256 id) public nonReentrant {
        StakeInfo memory userStake = stakeInfo[id];
        if (userStake.withdrawTime == 0) revert NotUnstakedYet();

        totalUserStaked[msg.sender] -= userStake.amount;
        totalStaked -= userStake.amount;

        uint256[] storage _userIds = userIds[msg.sender];
        for (uint256 i = 0; i < _userIds.length; ++i) {
            if (_userIds[i] == id) {
                _userIds[i] = _userIds[_userIds.length - 1];
                _userIds.pop();
                break;
            }
        }

        nftReceipt.burn(id);
        stakeToken.transfer(msg.sender, userStake.amount);

        emit Withdraw(msg.sender, id, userStake.amount, userStake.duration);
    }

    function multiWithdraw(uint256[] calldata ids) external nonReentrant {
        for (uint256 i = 0; i < ids.length; ++i) {
            withdraw(ids[i]);
        }
    }

    /**
     * @notice Returns array of all users stakes
     * @param user The account address of staker
     */
    function getUserStakes(address user) external view returns (StakeInfo[] memory) {
        uint256[] memory _userIds = userIds[user];

        StakeInfo[] memory _stakes = new StakeInfo[](_userIds.length);
        for (uint256 i = 0; i < _userIds.length; i++) {
            _stakes[i] = stakeInfo[_userIds[i]];
        }
        return _stakes;
    }


    function setAllowedDuration(
        uint256 _duration,
        bool _allowed
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        allowedDurations[_duration] = _allowed;
        emit UpdateAllowedDuration(_duration, _allowed);
    }

    function setMinStakeAmount(uint256 _newMinStakeAmount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minStakeAmount = _newMinStakeAmount;
        emit UpdateMinStakeAmount(_newMinStakeAmount);
    }

    function setWithdrawCooldown(
        uint256 _newWithdrawCooldown
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        withdrawCooldown = _newWithdrawCooldown;
        // @todo add max threshold

        emit UpdateWithdrawCooldown(_newWithdrawCooldown);
    }
}
