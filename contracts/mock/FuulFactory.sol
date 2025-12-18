// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

import "./FuulProject.sol";
import "../interfaces/IFuulFactory.sol";
import "../interfaces/IFuulManager.sol";

contract FuulFactory is IFuulFactory, AccessControlEnumerable {
    // Manager role
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    // Tracker of the number of projects created
    uint256 private _projectCount;

    // Implementation contract address
    address immutable fuulProjectImplementation;

    // Address that will collect protocol fees
    address public protocolFeeCollector;

    // Currency paid for NFT fixed fees
    address public nftFeeCurrency;

    // Fixed fee for NFT rewards
    uint256 public nftFixedFeeAmount = 1 ether;

    // Protocol fee percentage. 1 => 0.01%
    uint256 public protocolFee = 0;

    // Client fee. 1 => 0.01%
    uint256 public clientFee = 200;

    // Attributor fee. 1 => 0.01%
    uint256 public attributorFee = 600;

    // Amount of time that must elapse between a project's application to remove funds from its budget and the actual removal of those funds.
    uint256 public projectBudgetCooldown = 30 days;

    // Period of time that a project can remove funds after cooldown. If they don't remove in this period, they will have to apply to remove again.
    uint256 public projectRemoveBudgetPeriod = 30 days;

    // Mapping token addresses with token information
    mapping(address => CurrencyToken) public acceptedCurrencies;

    /**
     * @dev Sets the values for `fuulManager`, `fuulProjectImplementation` and the initial values for `protocolFeeCollector` and `nftFeeCurrency`.
     * It grants the DEFAULT_ADMIN_ROLE to the deployer.
     *
     * `fuulProjectImplementation` value is immutable: it can only be set once during
     * construction.
     */
    constructor(
        address fuulManager,
        address initialProtocolFeeCollector,
        address initialNftFeeCurrency,
        address acceptedERC20CurrencyToken
    ) {
        if (
            fuulManager == address(0) ||
            initialProtocolFeeCollector == address(0) ||
            acceptedERC20CurrencyToken == address(0)
        ) {
            revert ZeroAddress();
        }

        fuulProjectImplementation = address(new FuulProject());

        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(MANAGER_ROLE, fuulManager);

        protocolFeeCollector = initialProtocolFeeCollector;
        nftFeeCurrency = initialNftFeeCurrency;

        _addCurrencyToken(address(0), TokenType(0));
        _addCurrencyToken(acceptedERC20CurrencyToken, TokenType(1));
    }

    /*╔═════════════════════════════╗
      ║        CREATE PROJECT       ║
      ╚═════════════════════════════╝*/

    /**
     * @dev Creates a new Project. It deploys a new clone of the implementation
     * and initializes it.
     * The `projectId` follows the number of projects created.
     *
     * Emits {ProjectCreated}.
     *
     * Requirements:
     *
     * - `_projectAdmin` and `_projectEventSigner` must not be the zero address.
     * - `_projectInfoURI` must not be an empty string.
     */
    function createFuulProject(
        address projectAdmin,
        address projectEventSigner,
        string calldata projectInfoURI,
        address clientFeeCollector
    ) external {
        if (
            projectAdmin == address(0) ||
            projectEventSigner == address(0) ||
            clientFeeCollector == address(0)
        ) {
            revert ZeroAddress();
        }

        address clone = Clones.clone(fuulProjectImplementation);
        FuulProject(clone).initialize(
            projectAdmin,
            projectEventSigner,
            projectInfoURI,
            clientFeeCollector
        );

        _projectCount++;

        emit ProjectCreated(
            totalProjectsCreated(),
            address(clone),
            projectEventSigner,
            projectInfoURI,
            clientFeeCollector
        );
    }

    /**
     * @dev Returns the number of total projects created.
     */
    function totalProjectsCreated() public view returns (uint256) {
        return _projectCount;
    }

    /*╔═════════════════════════════╗
      ║        MANAGER ROLE         ║
      ╚═════════════════════════════╝*/

    /**
     * @dev Returns if an address has `MANAGER_ROLE`.
     */
    function hasManagerRole(address account) public view returns (bool) {
        if (!hasRole(MANAGER_ROLE, account)) {
            revert Unauthorized();
        }
        return true;
    }

    /*╔═════════════════════════════╗
      ║        FEES VARIABLES       ║
      ╚═════════════════════════════╝*/

    /**
     * @dev Returns all fees in one function.
     */
    function getAllFees() public view returns (FeesInformation memory) {
        return (
            FeesInformation({
                protocolFee: protocolFee,
                attributorFee: attributorFee,
                clientFee: clientFee,
                protocolFeeCollector: protocolFeeCollector,
                nftFixedFeeAmount: nftFixedFeeAmount,
                nftFeeCurrency: nftFeeCurrency
            })
        );
    }

    /**
     * @dev Returns all fees for attribution and checks that the sender has `MANAGER_ROLE`.
     *
     * Note:
     * The function purpose is to check and return all necessary data
     * to the {FuulProject} in one call when attributing.
     *
     * Even though the sender is a parameter, in {FuulProject} is _msgSender() so it cannot be manipulated.
     */
    function attributionFeeHelper(
        address sender
    ) external view returns (FeesInformation memory) {
        // Checking sender only for {FuulProject} attribution to make only one call
        hasManagerRole(sender);
        return getAllFees();
    }

    /**
     * @dev Sets the protocol fees for each attribution.
     *
     * Requirements:
     *
     * - `value` must be different from the current one.
     * - Only admins can call this function.
     */
    function setProtocolFee(
        uint256 value
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (value == protocolFee) {
            revert IFuulManager.InvalidArgument();
        }

        protocolFee = value;

        emit ProtocolFeeUpdated(value);
    }

    /**
     * @dev Sets the fees for the client that was used to create the project.
     *
     * Requirements:
     *
     * - `value` must be different from the current one.
     * - Only admins can call this function.
     */
    function setClientFee(uint256 value) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (value == clientFee) {
            revert IFuulManager.InvalidArgument();
        }

        clientFee = value;
        emit ClientFeeUpdated(value);
    }

    /**
     * @dev Sets the fees for the attributor.
     *
     * Requirements:
     *
     * - `value` must be different from the current one.
     * - Only admins can call this function.
     */
    function setAttributorFee(
        uint256 value
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (value == attributorFee) {
            revert IFuulManager.InvalidArgument();
        }

        attributorFee = value;
        emit AttributorFeeUpdated(value);
    }

    /**
     * @dev Sets the fixed fee amount for NFT rewards.
     *
     * Requirements:
     *
     * - `value` must be different from the current one.
     * - Only admins can call this function.
     */
    function setNftFixedFeeAmount(
        uint256 value
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (value == nftFixedFeeAmount) {
            revert IFuulManager.InvalidArgument();
        }

        nftFixedFeeAmount = value;
        emit NftFixedFeeUpdated(value);
    }

    /**
     * @dev Sets the currency that will be used to pay NFT rewards fees.
     *
     * Requirements:
     *
     * - `value` must be different from the current one.
     * - Only admins can call this function.
     */
    function setNftFeeCurrency(
        address newCurrency
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newCurrency == nftFeeCurrency) {
            revert IFuulManager.InvalidArgument();
        }

        nftFeeCurrency = newCurrency;
        emit NftFeeCurrencyUpdated(newCurrency);
    }

    /**
     * @dev Sets the protocol fee collector address.
     *
     * Requirements:
     *
     * - `value` must be different from the current one.
     * - Only admins can call this function.
     */
    function setProtocolFeeCollector(
        address newCollector
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newCollector == protocolFeeCollector) {
            revert IFuulManager.InvalidArgument();
        }

        protocolFeeCollector = newCollector;
        emit ProtocolFeeCollectorUpdated(newCollector);
    }

    /*╔═════════════════════════════╗
      ║       TOKEN CURRENCIES      ║
      ╚═════════════════════════════╝*/

    /**
     * @dev Adds a currency token.
     * See {_addCurrencyToken}
     *
     * Requirements:
     *
     * - Only admins can call this function.
     * - Token not accepted
     */
    function addCurrencyToken(
        address tokenAddress,
        TokenType tokenType
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (acceptedCurrencies[tokenAddress].isAccepted) {
            revert TokenCurrencyAlreadyAccepted();
        }
        _addCurrencyToken(tokenAddress, tokenType);
    }

    /**
     * @dev Adds a currency token.
     *
     */
    function _addCurrencyToken(
        address tokenAddress,
        TokenType tokenType
    ) internal {
        if (tokenAddress != address(0) && tokenType == TokenType.NATIVE) {
            revert InvalidTokenType();
        }

        acceptedCurrencies[tokenAddress] = CurrencyToken({
            tokenType: tokenType,
            isAccepted: true
        });

        emit CurrencyAdded(tokenAddress, tokenType);
    }

    /**
     * @dev Removes a currency token.
     *
     * Notes:
     * - Projects will not be able to deposit with the currency token.
     * - We don't remove the `currencyToken` object because users will still be able to claim/remove it
     *
     * Requirements:
     *
     * - `tokenAddress` must be accepted.
     * - Only admins can call this function.
     */
    function removeCurrencyToken(
        address tokenAddress
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        CurrencyToken storage currency = acceptedCurrencies[tokenAddress];

        if (!currency.isAccepted) {
            revert TokenCurrencyNotAccepted();
        }

        currency.isAccepted = false;
        emit CurrencyRemoved(tokenAddress, currency.tokenType);
    }

    /*╔═════════════════════════════╗
      ║       REMOVE VARIABLES      ║
      ╚═════════════════════════════╝*/

    /**
     * @dev Sets the period for `projectBudgetCooldown`.
     *
     * Requirements:
     *
     * - `period` must be different from the current one.
     * - Only admins can call this function.
     */
    function setProjectBudgetCooldown(
        uint256 period
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (period == projectBudgetCooldown || period == 0) {
            revert IFuulManager.InvalidArgument();
        }

        projectBudgetCooldown = period;

        emit ProjectCooldownUpdated(period);
    }

    /**
     * @dev Sets the period for `projectRemoveBudgetPeriod`.
     *
     * Requirements:
     *
     * - `period` must be different from the current one.
     * - `period` must be greater than 5 days.
     * - Only admins can call this function.
     */
    function setProjectRemoveBudgetPeriod(
        uint256 period
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (period == projectRemoveBudgetPeriod || period < 5 days) {
            revert IFuulManager.InvalidArgument();
        }

        projectRemoveBudgetPeriod = period;
        emit ProjectRemovePeriodUpdated(period);
    }

    /**
     * @dev Returns removal info. The function purpose is to call only once from {FuulProject} when needing this info.
     */
    function getBudgetRemoveInfo()
        external
        view
        returns (uint256 cooldown, uint256 removeWindow)
    {
        return (projectBudgetCooldown, projectRemoveBudgetPeriod);
    }
}
