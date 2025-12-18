// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

interface IFuulFactory {
    struct FeesInformation {
        uint256 protocolFee;
        uint256 attributorFee;
        uint256 clientFee;
        address protocolFeeCollector;
        uint256 nftFixedFeeAmount;
        address nftFeeCurrency;
    }

    enum TokenType {
        NATIVE,
        ERC_20,
        ERC_721,
        ERC_1155
    }

    struct CurrencyToken {
        TokenType tokenType;
        bool isAccepted;
    }

    /*╔═════════════════════════════╗
      ║           EVENTS            ║
      ╚═════════════════════════════╝*/
    event ProjectCreated(
        uint256 projectId,
        address indexed deployedAddress,
        address indexed eventSigner,
        string projectInfoURI,
        address clientFeeCollector
    );

    event ProtocolFeeUpdated(uint256 value);
    event ClientFeeUpdated(uint256 value);
    event AttributorFeeUpdated(uint256 value);
    event NftFixedFeeUpdated(uint256 value);
    event NftFeeCurrencyUpdated(address newCurrency);
    event ProtocolFeeCollectorUpdated(address indexed newCollector);
    event CurrencyAdded(address indexed newCurrency, TokenType tokenType);
    event CurrencyRemoved(address indexed newCurrency, TokenType tokenType);
    event ProjectCooldownUpdated(uint256 value);
    event ProjectRemovePeriodUpdated(uint256 value);

    /*╔═════════════════════════════╗
      ║           ERRORS            ║
      ╚═════════════════════════════╝*/

    error ZeroAddress();
    error TokenCurrencyAlreadyAccepted();
    error TokenCurrencyNotAccepted();
    error Unauthorized();
    error InvalidTokenType();

    /*╔═════════════════════════════╗
      ║        CREATE PROJECT       ║
      ╚═════════════════════════════╝*/

    function createFuulProject(
        address projectAdmin,
        address projectEventSigner,
        string calldata projectInfoURI,
        address clientFeeCollector
    ) external;

    function totalProjectsCreated() external view returns (uint256);

    /*╔═════════════════════════════╗
      ║        MANAGER ROLE         ║
      ╚═════════════════════════════╝*/

    function hasManagerRole(address account) external view returns (bool);

    /*╔═════════════════════════════╗
      ║        FEES VARIABLES       ║
      ╚═════════════════════════════╝*/

    function protocolFee() external view returns (uint256 fees);

    function protocolFeeCollector() external view returns (address);

    function getAllFees() external view returns (FeesInformation memory);

    function attributionFeeHelper(
        address sender
    ) external view returns (FeesInformation memory);

    function clientFee() external view returns (uint256 fees);

    function attributorFee() external view returns (uint256 fees);

    function nftFeeCurrency() external view returns (address);

    function setProtocolFee(uint256 value) external;

    function setClientFee(uint256 value) external;

    function setAttributorFee(uint256 value) external;

    function setNftFixedFeeAmount(uint256 value) external;

    function setNftFeeCurrency(address newCurrency) external;

    /*╔═════════════════════════════╗
      ║       TOKEN CURRENCIES      ║
      ╚═════════════════════════════╝*/

    function acceptedCurrencies(
        address tokenAddress
    ) external view returns (TokenType tokenType, bool isAccepted);

    function addCurrencyToken(
        address tokenAddress,
        TokenType tokenType
    ) external;

    function removeCurrencyToken(address tokenAddress) external;

    /*╔═════════════════════════════╗
      ║       REMOVE VARIABLES      ║
      ╚═════════════════════════════╝*/

    function projectBudgetCooldown() external view returns (uint256 period);

    function getBudgetRemoveInfo()
        external
        view
        returns (uint256 cooldown, uint256 removeWindow);

    function setProjectBudgetCooldown(uint256 period) external;

    function setProjectRemoveBudgetPeriod(uint256 period) external;
}
