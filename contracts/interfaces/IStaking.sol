// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {INftReceipt} from "./INftReceipt.sol";


interface IStaking {
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

    event Stake(
        address staker,
        uint256 stakeId,
        uint256 amount,
        uint256 startTime,
        uint256 lockupEndTime
    );

    event Relock(address staker, uint256 stakeId, uint256 duration);
    event Unstake(address staker, uint256 stakeId, uint256 amount);
    event Withdraw(address staker, uint256 stakeId, uint256 amount);

    event UpdateAllowedDuration(uint256 duration, bool allowed);
    event UpdateMinStakeAmount(uint256 newMinStakeAmount);
    event UpdateWithdrawCooldown(uint256 newWithdrawCooldown);
    event EmergencyUnlock();

    error ZeroAddress();
    error NotAllowedAmount(uint256 amount);
    error NotAllowedDuration(uint256 duration);
    error TooEarlyForUnstake();
    error TooEarlyForRelock();
    error NotUnstakedYet();
    error AlreadyUnstaked();
    error NonPartialUnstake();
    error NotStakeOwner(uint256 id);
    error MaxWithdrawCooldown();
    error Unlocked();

    function stakeToken() external view returns (IERC20);
    function nftReceipt() external view returns (INftReceipt);
    function lastId() external view returns (uint256);
    function totalStaked() external view returns (uint256);
    function minStakeAmount() external view returns (uint256);
    function withdrawCooldown() external view returns (uint256);
    function unlockedAll() external view returns (bool);
    function allowedDurations(uint256) external view returns (bool);
    function totalUserStaked(address) external view returns (uint256);
    // function stakeInfo(uint256) external view returns (StakeInfo memory);


    function stake(uint256 amount, uint256 duration) external returns (uint256);

    function relock(
        uint256 tokenId,
        uint256 newLockDuration,
        uint256 newLockAmount
    ) external returns (uint256);


    function relock(uint256 tokenId, uint256 newLockDuration) external returns (uint256);

    function unstake(uint256 tokenId, uint256 amountToUnstake) external returns (uint256);

    function unstake(uint256 tokenId) external;

    function withdraw(uint256 tokenId) external;

    /**
     * @notice Returns array of all users stakes
     * @param user The account address of staker
     */
    function getUserStakes(address user) external view returns (StakeInfoWithId[] memory);
}
