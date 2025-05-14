// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

error ZeroAddress();
error NotAllowedAmount(uint256 amount);
error NotAllowedDuration(uint256 duration);
error AlreadyUnstaked();
error TooEarlyForRestake();
error NotUnstakedYet();

contract Staking is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    event Stake(address staker, uint256 stakeId, uint256 amount, uint256 duration);
    event EarlyUnstake(address staker, uint256 stakedAmount, uint256 penalty);
    event Unstake(address staker, uint256 stakeId);
    event Withdraw(address staker, uint256 stakeId, uint256 amount, uint256 duration);
    event UpdateAllowedDuration(uint256 duration, bool allowed);
    event UpdateMinStakeAmount(uint256 newMinStakeAmount);
    event UpdateWithdrawCooldown(uint256 newWithdrawCooldown);

    /// @notice Token to stake and receive rewards
    IERC20 public stakeToken;

    /// @notice NFT receipt contract (represents receipt of staking)
    IERC721 public nftReceipt;

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
    
    mapping (uint256 duration => bool allowed) public allowedDurations;

    // cumulative amount of all user stakes (never decreases)
    mapping(address account => uint256) public totalUserStaked;

    mapping(address account => StakeInfo[]) public userStakeInfo;


    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _stakeToken, address _nftReceipt) initializer public {
        if (_stakeToken == address(0) || _nftReceipt == address(0)) revert ZeroAddress();
        __Ownable_init(msg.sender);

        stakeToken = IERC20(_stakeToken);
        nftReceipt = IERC721(_nftReceipt);

        allowedDurations[30 days] = true;
        allowedDurations[60 days] = true;
        allowedDurations[90 days] = true;
    }


    function setAllowedDuration(uint256 _duration, bool _allowed) external onlyOwner {
        allowedDurations[_duration] = _allowed;
        emit UpdateAllowedDuration(_duration, _allowed);

    }


    function setMinStakeAmount(uint256 _newMinStakeAmount) external onlyOwner {
        minStakeAmount = _newMinStakeAmount;
        emit UpdateMinStakeAmount(_newMinStakeAmount);
    }


    function setWithdrawCooldown(uint256 _newWithdrawCooldown) external onlyOwner {
        withdrawCooldown = _newWithdrawCooldown;
        // @todo add max threshold

        emit UpdateWithdrawCooldown(_newWithdrawCooldown);
    }

    /**
     * @notice Deposits tokens into contract and creates new stake for `msg.sender`
     * @dev The `amount` must be approved before deposit
     * @param amount - The amount to stake
     */
    function stake(uint256 amount, uint256 duration) external nonReentrant {
        if (!allowedDurations[duration]) revert NotAllowedDuration(duration);
        if (amount < minStakeAmount) revert NotAllowedAmount(amount);

        totalUserStaked[msg.sender] += amount;
        totalStaked += amount;

        userStakeInfo[msg.sender].push(StakeInfo(
            uint256(amount),
            uint64(block.timestamp),
            uint64(duration),
            0
        ));


        // @todo mint NFT


        stakeToken.transferFrom(msg.sender, address(this), amount);
        emit Stake(msg.sender, userStakeInfo[msg.sender].length - 1, amount, duration);
    }

    function restake(uint256 id, uint256 duration) external nonReentrant {
        if (!allowedDurations[duration]) revert NotAllowedDuration(duration);

        StakeInfo memory userOldStake = userStakeInfo[msg.sender][id];
        if (block.timestamp < userOldStake.startTime + userOldStake.duration) revert TooEarlyForRestake();

        // @todo burn old NFT 

        userStakeInfo[msg.sender][id] = userStakeInfo[msg.sender][userStakeInfo[msg.sender].length - 1];
        userStakeInfo[msg.sender].pop();


        // @todo mint NFT

        userStakeInfo[msg.sender].push(StakeInfo(
            uint256(userOldStake.amount),
            uint64(block.timestamp),
            uint64(duration),
            0
        ));
        emit Unstake(msg.sender, id);
        emit Withdraw(msg.sender, id, userOldStake.amount, userOldStake.duration);
        emit Stake(msg.sender, userStakeInfo[msg.sender].length - 1, userOldStake.amount, duration);
    }

    /**
     * @notice 
     * @param id - The stake index (for first stake use 0)
     */
    function unstake(uint256 id) external nonReentrant {
        StakeInfo storage userStake = userStakeInfo[msg.sender][id];
        if (userStake.withdrawTime != 0) revert AlreadyUnstaked();
        
        userStake.withdrawTime = uint64(block.timestamp + withdrawCooldown);

        emit Unstake(msg.sender, id);
    }


    function withdraw(uint256 id) external nonReentrant {
        StakeInfo memory userStake = userStakeInfo[msg.sender][id];
        if (userStake.withdrawTime == 0) revert NotUnstakedYet();

        userStakeInfo[msg.sender][id] = userStakeInfo[msg.sender][userStakeInfo[msg.sender].length - 1];
        userStakeInfo[msg.sender].pop();

        // @todo burn NFT

        totalUserStaked[msg.sender] -= userStake.amount;
        totalStaked -= userStake.amount;
        stakeToken.transfer(msg.sender, userStake.amount);

        emit Withdraw(msg.sender, id, userStake.amount, userStake.duration);
    }


    /**
     * @notice Returns array of all users stakes
     * @param user The account address of staker 
     */
    function getUserStakes(address user) external view returns(StakeInfo[] memory) {
        return userStakeInfo[user];
    }


}
