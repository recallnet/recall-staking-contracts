// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "./IFuulProject.sol";

interface IFuulManager {
    struct CurrencyTokenLimit {
        uint256 claimLimitPerCooldown;
        uint256 cumulativeClaimPerCooldown;
        uint256 claimCooldownPeriodStarted;
    }

    struct ClaimCheck {
        address projectAddress;
        address currency;
        uint256 amount;
        uint256[] tokenIds;
        uint256[] amounts;
    }

    struct AttributionEntity {
        address projectAddress;
        IFuulProject.Attribution[] projectAttributions;
    }

    /*╔═════════════════════════════╗
      ║           EVENTS            ║
      ╚═════════════════════════════╝*/

    event ClaimCooldownUpdated(uint256 value);
    event TokenLimitAdded(address indexed token, uint256 value);
    event TokenLimitUpdated(address indexed token, uint256 value);

    /*╔═════════════════════════════╗
      ║           ERRORS            ║
      ╚═════════════════════════════╝*/

    error InvalidArgument();
    error LimitAlreadySet();
    error OverTheLimit();
    error ZeroAddress();
    error Unauthorized();

    /*╔═════════════════════════════╗
      ║       PUBLIC VARIABLES      ║
      ╚═════════════════════════════╝*/

    function claimCooldown() external view returns (uint256 period);

    function usersClaims(
        address user,
        address currency
    ) external view returns (uint256);

    /*╔═════════════════════════════╗
      ║       CLAIM VARIABLES       ║
      ╚═════════════════════════════╝*/

    function setClaimCooldown(uint256 period) external;

    /*╔═════════════════════════════╗
      ║       TOKEN CURRENCIES      ║
      ╚═════════════════════════════╝*/

    function currencyLimits(
        address currencyToken
    ) external view returns (uint256, uint256, uint256);

    function addCurrencyLimit(
        address tokenAddress,
        uint256 claimLimitPerCooldown
    ) external;

    function setCurrencyTokenLimit(
        address tokenAddress,
        uint256 limit
    ) external;

    /*╔═════════════════════════════╗
      ║            PAUSE            ║
      ╚═════════════════════════════╝*/

    function pauseAll() external;

    function unpauseAll() external;

    function isPaused() external view returns (bool);

    /*╔═════════════════════════════╗
      ║      ATTRIBUTE AND CLAIM    ║
      ╚═════════════════════════════╝*/

    function attributeConversions(
        AttributionEntity[] memory attributions,
        address attributorFeeCollector
    ) external;

    function claim(ClaimCheck[] calldata claimChecks) external;
}
