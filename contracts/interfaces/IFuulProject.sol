// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/extensions/IAccessControlEnumerable.sol";

interface IFuulProject is IAccessControlEnumerable {
    /*╔═════════════════════════════╗
      ║           STRUCT            ║
      ╚═════════════════════════════╝*/

    // Attribution
    struct Attribution {
        address currency;
        address partner;
        address endUser;
        uint256 amountToPartner;
        uint256 amountToEndUser;
        bytes32 proof;
        bytes32 proofWithoutProject;
    }

    /*╔═════════════════════════════╗
      ║           EVENTS            ║
      ╚═════════════════════════════╝*/

    event ProjectInfoUpdated(string projectInfoURI);

    event FungibleBudgetDeposited(uint256 amount, address indexed currency);

    event ERC721BudgetDeposited(
        uint256 amount,
        address indexed currency,
        uint256[] tokenIds
    );

    event ERC1155BudgetDeposited(
        address indexed account,
        uint256 amount,
        address indexed currency,
        uint256[] tokenIds,
        uint256[] amounts
    );

    event FungibleBudgetRemoved(uint256 amount, address indexed currency);

    event ERC721BudgetRemoved(
        uint256 amount,
        address indexed currency,
        uint256[] tokenIds
    );

    event ERC1155BudgetRemoved(
        address indexed account,
        uint256 amount,
        address indexed currency,
        uint256[] tokenIds,
        uint256[] amounts
    );

    event Claimed(
        address indexed account,
        address indexed currency,
        uint256 amount,
        uint256[] rewardTokenIds,
        uint256[] amounts
    );

    // Array Order: protocol, client, attributor, partner, end user

    event Attributed(
        address indexed currency,
        uint256 totalAmount,
        address[5] receivers,
        uint256[5] amounts,
        bytes32 proof
    );

    event FeeBudgetDeposited(
        address indexed account,
        uint256 amount,
        address indexed currency
    );

    event FeeBudgetRemoved(
        address indexed account,
        uint256 amount,
        address indexed currency
    );

    event AppliedToRemove(uint256 timestamp);

    /*╔═════════════════════════════╗
      ║           ERRORS            ║
      ╚═════════════════════════════╝*/

    error ManagerIsPaused();
    error EmptyURI();
    error NoRemovalApplication();
    error IncorrectMsgValue();
    error OutsideRemovalWindow();
    error ZeroAmount();
    error AlreadyAttributed();
    error InvalidProof();
    error Forbidden();
    error InvalidCurrency();
    error InvalidArgument();

    /*╔═════════════════════════════╗
      ║       PUBLIC VARIABLES      ║
      ╚═════════════════════════════╝*/

    function fuulFactory() external view returns (address);

    function availableToClaim(
        address account,
        address currency
    ) external view returns (uint256);

    /*╔═════════════════════════════╗
      ║        PROJECT INFO         ║
      ╚═════════════════════════════╝*/

    function projectInfoURI() external view returns (string memory);

    function setProjectURI(string memory projectURI) external;

    function clientFeeCollector() external view returns (address);

    /*╔═════════════════════════════╗
      ║           DEPOSIT           ║
      ╚═════════════════════════════╝*/

    function depositFungibleToken(
        address currency,
        uint256 amount
    ) external payable;

    function depositNFTToken(
        address currency,
        uint256[] memory rewardTokenIds,
        uint256[] memory amounts
    ) external;

    /*╔═════════════════════════════╗
      ║           REMOVE            ║
      ╚═════════════════════════════╝*/

    function lastRemovalApplication() external view returns (uint256);

    function applyToRemoveBudget() external;

    function getBudgetRemovePeriod() external view returns (uint256, uint256);

    function canRemoveFunds() external view returns (bool insideRemovalWindow);

    function removeFungibleBudget(address currency, uint256 amount) external;

    function removeNFTBudget(
        address currency,
        uint256[] memory rewardTokenIds,
        uint256[] memory amounts
    ) external;

    /*╔═════════════════════════════╗
      ║          ATTRIBUTE          ║
      ╚═════════════════════════════╝*/

    function attributeConversions(
        Attribution[] calldata attributions,
        address attributorFeeCollector
    ) external;

    function attributionProofs(bytes32 proof) external view returns (bool);

    /*╔═════════════════════════════╗
      ║            CLAIM            ║
      ╚═════════════════════════════╝*/

    function claimFromProject(
        address currency,
        address receiver,
        uint256 amount,
        uint256[] memory tokenIds,
        uint256[] memory amounts
    ) external;
}
