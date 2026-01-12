// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "../interfaces/IFuulManager.sol";
import "../interfaces/IFuulProject.sol";
import "../interfaces/IFuulFactory.sol";

/**
 * @title FuulManager
 * @dev Mock implementation of FuulManager for local development and testing.
 * Manages attribution and claims across FuulProject contracts.
 */
contract FuulManager is
    IFuulManager,
    AccessControlEnumerable,
    Pausable,
    ReentrancyGuard
{
    // Factory contract address
    address public fuulFactory;

    // Cooldown period between claims for a user
    uint256 public claimCooldown = 1 days;

    // Mapping user address => currency => last claim timestamp
    mapping(address => mapping(address => uint256)) public usersClaims;

    // Mapping currency => limit information
    mapping(address => CurrencyTokenLimit) private _currencyLimits;

    /**
     * @dev Modifier to check if factory is set
     */
    modifier factorySet() {
        require(fuulFactory != address(0), "FuulManager: factory not set");
        _;
    }

    /**
     * @dev Constructor sets up admin role
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    /**
     * @dev Sets the factory address. Can only be called once by admin.
     */
    function setFactory(
        address _fuulFactory
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_fuulFactory == address(0)) {
            revert ZeroAddress();
        }
        if (fuulFactory != address(0)) {
            revert InvalidArgument();
        }
        fuulFactory = _fuulFactory;
    }

    /*╔═════════════════════════════╗
      ║       CLAIM VARIABLES       ║
      ╚═════════════════════════════╝*/

    /**
     * @dev Sets the cooldown period between claims
     */
    function setClaimCooldown(
        uint256 period
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (period == claimCooldown) {
            revert InvalidArgument();
        }
        claimCooldown = period;
        emit ClaimCooldownUpdated(period);
    }

    /*╔═════════════════════════════╗
      ║       TOKEN CURRENCIES      ║
      ╚═════════════════════════════╝*/

    /**
     * @dev Returns currency limit information
     */
    function currencyLimits(
        address currencyToken
    ) external view returns (uint256, uint256, uint256) {
        CurrencyTokenLimit storage limit = _currencyLimits[currencyToken];
        return (
            limit.claimLimitPerCooldown,
            limit.cumulativeClaimPerCooldown,
            limit.claimCooldownPeriodStarted
        );
    }

    /**
     * @dev Adds a currency limit for claims
     */
    function addCurrencyLimit(
        address tokenAddress,
        uint256 claimLimitPerCooldown
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_currencyLimits[tokenAddress].claimLimitPerCooldown != 0) {
            revert LimitAlreadySet();
        }

        _currencyLimits[tokenAddress] = CurrencyTokenLimit({
            claimLimitPerCooldown: claimLimitPerCooldown,
            cumulativeClaimPerCooldown: 0,
            claimCooldownPeriodStarted: block.timestamp
        });

        emit TokenLimitAdded(tokenAddress, claimLimitPerCooldown);
    }

    /**
     * @dev Updates a currency limit for claims
     */
    function setCurrencyTokenLimit(
        address tokenAddress,
        uint256 limit
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_currencyLimits[tokenAddress].claimLimitPerCooldown == 0) {
            revert InvalidArgument();
        }

        _currencyLimits[tokenAddress].claimLimitPerCooldown = limit;
        emit TokenLimitUpdated(tokenAddress, limit);
    }

    /*╔═════════════════════════════╗
      ║            PAUSE            ║
      ╚═════════════════════════════╝*/

    /**
     * @dev Pauses all operations
     */
    function pauseAll() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpauses all operations
     */
    function unpauseAll() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Returns if the contract is paused
     */
    function isPaused() external view returns (bool) {
        return paused();
    }

    /*╔═════════════════════════════╗
      ║      ATTRIBUTE AND CLAIM    ║
      ╚═════════════════════════════╝*/

    /**
     * @dev Attributes conversions to multiple projects
     * @param attributions Array of attribution entities with project addresses and attributions
     * @param attributorFeeCollector Address that receives attributor fees
     */
    function attributeConversions(
        AttributionEntity[] memory attributions,
        address attributorFeeCollector
    ) external nonReentrant whenNotPaused factorySet {
        // Verify caller has manager role in factory
        IFuulFactory(fuulFactory).hasManagerRole(_msgSender());

        for (uint256 i = 0; i < attributions.length; ) {
            AttributionEntity memory entity = attributions[i];

            // Call attributeConversions on each project
            IFuulProject(entity.projectAddress).attributeConversions(
                entity.projectAttributions,
                attributorFeeCollector
            );

            unchecked {
                i++;
            }
        }
    }

    /**
     * @dev Claims rewards from multiple projects
     * @param claimChecks Array of claim checks with project addresses and claim details
     */
    function claim(
        ClaimCheck[] calldata claimChecks
    ) external nonReentrant whenNotPaused factorySet {
        address receiver = _msgSender();

        for (uint256 i = 0; i < claimChecks.length; ) {
            ClaimCheck calldata check = claimChecks[i];

            // Check and update currency limits if set
            CurrencyTokenLimit storage limit = _currencyLimits[check.currency];
            if (limit.claimLimitPerCooldown > 0) {
                // Reset cumulative if cooldown period has passed
                if (
                    block.timestamp >=
                    limit.claimCooldownPeriodStarted + claimCooldown
                ) {
                    limit.cumulativeClaimPerCooldown = 0;
                    limit.claimCooldownPeriodStarted = block.timestamp;
                }

                // Check if claim would exceed limit
                if (
                    limit.cumulativeClaimPerCooldown + check.amount >
                    limit.claimLimitPerCooldown
                ) {
                    revert OverTheLimit();
                }

                limit.cumulativeClaimPerCooldown += check.amount;
            }

            // Update user claims timestamp
            usersClaims[receiver][check.currency] = block.timestamp;

            // Call claimFromProject on the project
            IFuulProject(check.projectAddress).claimFromProject(
                check.currency,
                receiver,
                check.amount,
                check.tokenIds,
                check.amounts
            );

            unchecked {
                i++;
            }
        }
    }
}
