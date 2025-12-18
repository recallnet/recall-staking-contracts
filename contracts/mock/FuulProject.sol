// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "@openzeppelin/contracts/utils/Address.sol";

import "../interfaces/IFuulFactory.sol";
import "../interfaces/IFuulProject.sol";

contract FuulProject is
    IFuulProject,
    AccessControlEnumerable,
    ERC721Holder,
    ERC1155Holder,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;
    using Address for address payable;

    // Checks if contract is initialized
    bool private initialized;

    // Factory contract address
    address public immutable fuulFactory;

    // Address that will receive client fees (client that created the project)
    address public clientFeeCollector;

    // Roles for allowed addresses to send events through our SDK (not used in the contract)
    bytes32 public constant EVENTS_SIGNER_ROLE =
        keccak256("EVENTS_SIGNER_ROLE");

    // Mapping attribution proofs with already processed
    mapping(bytes32 => bool) public attributionProofs;

    // URI that points to a file with project information (image, name, description, attribution conditions, etc)
    string public projectInfoURI;

    // Timestamp for the last application to remove budget
    uint256 public lastRemovalApplication;

    // Mapping currency with amount
    mapping(address => uint256) public budgets;

    // Mapping owner address to currency to earnings
    mapping(address => mapping(address => uint256)) public availableToClaim;

    // Mapping currency with fees when rewarding NFTs. Using mappings to be able to withdraw after fee currency changes
    mapping(address => uint256) public nftFeeBudget;

    // {FuulFactory} instance
    IFuulFactory private immutable fuulFactoryInstance;

    /**
     * @dev Modifier to check if the project can remove funds. Reverts with an {OutsideRemovalWindow} error.
     */
    modifier canRemove() {
        canRemoveFunds();
        _;
    }

    /**
     * @dev Modifier to check if the uint amount is zero.
     */
    modifier nonZeroAmount(uint256 amount) {
        _nonZeroAmount(amount);
        _;
    }

    /**
     * @dev Internal function for {nonZeroAmount} modifier. Reverts with a {ZeroAmount} error.
     */
    function _nonZeroAmount(uint256 amount) internal pure {
        if (amount == 0) {
            revert ZeroAmount();
        }
    }

    /*╔═════════════════════════════╗
      ║         CONSTRUCTOR         ║
      ╚═════════════════════════════╝*/

    /**
     * @dev Sets the value for `fuulFactory`.
     * This value is immutable.
     */
    constructor() {
        fuulFactory = _msgSender();

        fuulFactoryInstance = IFuulFactory(fuulFactory);
    }

    /**
     * @dev Initializes the contract when the Factory deploys a new clone.
     *
     * Grants roles for project admin, the address allowed to send events
     * through the SDK, the URI with the project information and the address
     * that will receive the client fees.

     */
    function initialize(
        address projectAdmin,
        address projectEventSignerAddress,
        string calldata projectURI,
        address clientCreator
    ) external {
        if (fuulFactory != _msgSender() || initialized) {
            revert Forbidden();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, projectAdmin);

        _grantRole(EVENTS_SIGNER_ROLE, projectEventSignerAddress);

        _setProjectURI(projectURI);

        clientFeeCollector = clientCreator;
        initialized = true;
    }

    /*╔═════════════════════════════╗
      ║        PROJECT INFO         ║
      ╚═════════════════════════════╝*/

    /**
     * @dev Internal function that sets `projectInfoURI` as the information for the project.
     *
     * Requirements:
     *
     * - `projectURI` must not be an empty string.
     */
    function _setProjectURI(string memory projectURI) internal {
        if (bytes(projectURI).length == 0) {
            revert EmptyURI();
        }

        projectInfoURI = projectURI;
    }

    /**
     * @dev Sets `projectInfoURI` as the information for the project.
     *
     * Emits {ProjectInfoUpdated}.
     *
     * Requirements:
     *
     * - Only admins can call this function.
     */
    function setProjectURI(
        string calldata projectURI
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setProjectURI(projectURI);
        emit ProjectInfoUpdated(projectURI);
    }

    /*╔═════════════════════════════╗
      ║        DEPOSIT BUDGET       ║
      ╚═════════════════════════════╝*/

    /**
     * @dev Deposits fungible tokens.
     * They can be native or ERC20 tokens.
     *
     * Emits {FungibleBudgetDeposited}.
     *
     * Requirements:
     *
     * - `amount` must be greater than zero.
     * - Only admins can deposit.
     * - Token currency must be accepted in {FuulFactory}
     * - Currency must be the address zero (native token) or ERC20.
     */
    function depositFungibleToken(
        address currency,
        uint256 amount
    )
        external
        payable
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
        nonZeroAmount(amount)
    {
        IFuulFactory.TokenType currencyType = _getCurrencyToken(currency);

        uint256 depositedAmount;

        if (currencyType == IFuulFactory.TokenType.NATIVE) {
            if (msg.value != amount) {
                revert IncorrectMsgValue();
            }
            depositedAmount = amount;
        } else if (currencyType == IFuulFactory.TokenType.ERC_20) {
            if (msg.value > 0) {
                revert IncorrectMsgValue();
            }

            uint256 previousBalance = IERC20(currency).balanceOf(address(this));

            IERC20(currency).safeTransferFrom(
                _msgSender(),
                address(this),
                amount
            );

            depositedAmount =
                IERC20(currency).balanceOf(address(this)) -
                previousBalance;
        } else {
            revert InvalidCurrency();
        }

        // Update balance
        budgets[currency] += depositedAmount;

        emit FungibleBudgetDeposited(depositedAmount, currency);
    }

    /**
     * @dev Deposits NFTs.
     *
     * Note: `amounts` parameter is only used when dealing with ERC1155 tokens.
     *
     * Emits {ERC721BudgetDeposited} or {ERC1155BudgetDeposited}.
     *
     * Requirements:
     *
     * - `tokenIds` must not be an empty array.
     * - Only admins can deposit.
     * - Token currency must be accepted in {FuulFactory}
     * - Currency must be an ERC721 or ERC1155.
     */
    function depositNFTToken(
        address currency,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        IFuulFactory.TokenType currencyType = _getCurrencyToken(currency);

        if (currencyType == IFuulFactory.TokenType.ERC_721) {
            uint256 depositedAmount = tokenIds.length;

            _nonZeroAmount(depositedAmount);
            budgets[currency] += depositedAmount;

            _transferERC721Tokens(
                currency,
                _msgSender(),
                address(this),
                tokenIds
            );
            emit ERC721BudgetDeposited(depositedAmount, currency, tokenIds);
        } else if (currencyType == IFuulFactory.TokenType.ERC_1155) {
            uint256 depositedAmount = _getSumFromArray(amounts);
            _nonZeroAmount(depositedAmount);
            budgets[currency] += depositedAmount;
            _transferERC1155Tokens(
                currency,
                _msgSender(),
                address(this),
                tokenIds,
                amounts
            );

            emit ERC1155BudgetDeposited(
                _msgSender(),
                depositedAmount,
                currency,
                tokenIds,
                amounts
            );
        } else {
            revert InvalidCurrency();
        }
    }

    /*╔═════════════════════════════╗
      ║        REMOVE BUDGET        ║
      ╚═════════════════════════════╝*/

    /**
     * @dev Sets timestamp for which users request to remove their budgets.
     *
     * Emits {AppliedToRemove}.
     *
     * Requirements:
     *
     * - Only admins can call this function.
     */
    function applyToRemoveBudget() external onlyRole(DEFAULT_ADMIN_ROLE) {
        lastRemovalApplication = block.timestamp;

        emit AppliedToRemove(lastRemovalApplication);
    }

    /**
     * @dev Returns the window when projects can remove funds.
     * The cooldown period for removing a project's budget begins upon calling the {applyToRemoveBudget} function
     * and ends once the `projectBudgetCooldown` period has elapsed.
     *
     * The period to remove starts when the cooldown is completed, and ends after {removePeriod}.
     *
     * It is a public function for the UI to be able to read and display dates.
     */
    function getBudgetRemovePeriod()
        public
        view
        returns (uint256 cooldown, uint256 removePeriodEnds)
    {
        uint256 lastApplication = lastRemovalApplication;

        if (lastApplication == 0) {
            revert NoRemovalApplication();
        }

        (uint256 budgetCooldown, uint256 removePeriod) = fuulFactoryInstance
            .getBudgetRemoveInfo();

        cooldown = lastApplication + budgetCooldown;
        removePeriodEnds = cooldown + removePeriod;

        return (cooldown, removePeriodEnds);
    }

    /**
     * @dev Returns if the project is inside the removal window.
     * It should be after the cooldown is completed and before the removal period ends.
     * It is a public function for the UI to be able to check if the project can remove.
     */
    function canRemoveFunds() public view returns (bool) {
        (
            uint256 cooldownPeriodEnds,
            uint256 removePeriodEnds
        ) = getBudgetRemovePeriod();

        if (
            block.timestamp < cooldownPeriodEnds ||
            block.timestamp > removePeriodEnds
        ) {
            revert OutsideRemovalWindow();
        }

        return true;
    }

    /**
     * @dev Removes fungible tokens.
     * They can be native or ERC20 tokens.
     *
     * Emits {FungibleBudgetRemoved}.
     *
     * Requirements:
     *
     * - `amount` must be greater than zero.
     * - `amount` must be lower than budget for currency
     * - Only admins can remove.
     * - Must be within the Budget removal window.
     * - Currency must be the address zero (native token) or ERC20.
     */
    function removeFungibleBudget(
        address currency,
        uint256 amount
    )
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
        canRemove
        nonZeroAmount(amount)
    {
        // Update budget - By underflow it indirectly checks that amount <= currentBudget
        budgets[currency] -= amount;

        (IFuulFactory.TokenType currencyType, ) = fuulFactoryInstance
            .acceptedCurrencies(currency);

        if (currencyType == IFuulFactory.TokenType.NATIVE) {
            payable(_msgSender()).sendValue(amount);
        } else if (currencyType == IFuulFactory.TokenType.ERC_20) {
            IERC20(currency).safeTransfer(_msgSender(), amount);
        } else {
            revert InvalidCurrency();
        }

        emit FungibleBudgetRemoved(amount, currency);
    }

    /**
     * @dev Removes NFT tokens.
     * They can be ERC1155 or ERC721 tokens.
     * `amounts` parameter is only used when dealing with ERC1155 tokens.
     *
     * Emits {ERC721BudgetRemoved} or {ERC1155BudgetRemoved}.
     *
     * Requirements:
     *
     * - `amount` must be greater than zero.
     * - `amount` must be lower than budget for currency
     * - Only admins can remove.
     * - Must be within the Budget removal window.
     * - Currency must be an ERC721 or ERC1155.
     */
    function removeNFTBudget(
        address currency,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant canRemove {
        (IFuulFactory.TokenType currencyType, ) = fuulFactoryInstance
            .acceptedCurrencies(currency);

        if (currencyType == IFuulFactory.TokenType.ERC_721) {
            uint256 removeAmount = tokenIds.length;
            _nonZeroAmount(removeAmount);

            // Update budget - By underflow it indirectly checks that amount <= budget
            budgets[currency] -= removeAmount;

            _transferERC721Tokens(
                currency,
                address(this),
                _msgSender(),
                tokenIds
            );

            emit ERC721BudgetRemoved(removeAmount, currency, tokenIds);
        } else if (currencyType == IFuulFactory.TokenType.ERC_1155) {
            uint256 removeAmount = _getSumFromArray(amounts);
            _nonZeroAmount(removeAmount);

            // Update budget - By underflow it indirectly checks that amount <= budget
            budgets[currency] -= removeAmount;
            _transferERC1155Tokens(
                currency,
                address(this),
                _msgSender(),
                tokenIds,
                amounts
            );

            emit ERC1155BudgetRemoved(
                _msgSender(),
                removeAmount,
                currency,
                tokenIds,
                amounts
            );
        } else {
            revert InvalidCurrency();
        }
    }

    /*╔═════════════════════════════╗
      ║        NFT FEE BUDGET       ║
      ╚═════════════════════════════╝*/

    /**
     * @dev Deposits budget to pay for fees when rewarding NFTs.
     * The currency is defined in the {FuulFactory} contract.
     *
     * Emits {FeeBudgetDeposited}.
     *
     * Requirements:
     *
     * - `amount` must be greater than zero.
     * - Only admins can deposit.
     */
    function depositFeeBudget(
        uint256 amount
    )
        external
        payable
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
        nonZeroAmount(amount)
    {
        address currency = fuulFactoryInstance.nftFeeCurrency();
        uint256 depositedAmount;

        if (currency == address(0)) {
            if (msg.value != amount) {
                revert IncorrectMsgValue();
            }
            depositedAmount = amount;
        } else {
            if (msg.value > 0) {
                revert IncorrectMsgValue();
            }

            uint256 previousBalance = IERC20(currency).balanceOf(address(this));

            IERC20(currency).safeTransferFrom(
                _msgSender(),
                address(this),
                amount
            );

            depositedAmount =
                IERC20(currency).balanceOf(address(this)) -
                previousBalance;
        }

        // Update balance
        nftFeeBudget[currency] += depositedAmount;

        emit FeeBudgetDeposited(_msgSender(), depositedAmount, currency);
    }

    /**
     * @dev Removes fee budget for NFT rewards.
     *
     * Emits {FeeBudgetRemoved}.
     *
     * Notes: Currency is an argument because if the default is
     * changed in {FuulProject}, projects will still be able to remove.
     *
     * Requirements:
     *
     * - `amount` must be greater than zero.
     * - `amount` must be lower than fee budget.
     * - Only admins can remove.
     * - Must be within the Budget removal window.
     */
    function removeFeeBudget(
        address currency,
        uint256 amount
    )
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
        canRemove
        nonZeroAmount(amount)
    {
        // Update budget - By underflow it indirectly checks that amount <= nftFeeBudget
        nftFeeBudget[currency] -= amount;

        if (currency == address(0)) {
            payable(_msgSender()).sendValue(amount);
        } else {
            IERC20(currency).safeTransfer(_msgSender(), amount);
        }

        emit FeeBudgetRemoved(_msgSender(), amount, currency);
    }

    /*╔═════════════════════════════╗
      ║         ATTRIBUTION         ║
      ╚═════════════════════════════╝*/

    /**
     * @dev Internal function to calculate fees and amounts for fungible token reward.
     */

    function _calculateAmountsForFungibleToken(
        IFuulFactory.FeesInformation memory feesInfo,
        uint256 amountToPartner,
        uint256 amountToEndUser
    )
        internal
        pure
        returns (
            uint256[3] memory fees,
            uint256 netAmountToPartner,
            uint256 netAmountToEndUser
        )
    {
        uint256 totalAmount = amountToPartner + amountToEndUser;

        // Calculate the percentage to partners
        uint256 partnerPercentage = (100 * amountToPartner) / totalAmount;

        // Get all fees
        fees = [
            (feesInfo.protocolFee * totalAmount) / 10000,
            (feesInfo.clientFee * totalAmount) / 10000,
            (feesInfo.attributorFee * totalAmount) / 10000
        ];

        // Get net amounts
        uint256 netTotal = (totalAmount - fees[0] - fees[1] - fees[2]);
        netAmountToPartner = (netTotal * partnerPercentage) / 100;

        netAmountToEndUser = netTotal - netAmountToPartner;

        return (fees, netAmountToPartner, netAmountToEndUser);
    }

    /**
     * @dev Internal function to calculate fees for non fungible token reward.
     *
     */
    function _calculateFeesForNFT(
        IFuulFactory.FeesInformation memory feesInfo
    ) internal pure returns (uint256[3] memory fees) {
        uint256 totalAmount = feesInfo.nftFixedFeeAmount;
        fees = [
            (feesInfo.protocolFee * totalAmount) / 10000,
            (feesInfo.clientFee * totalAmount) / 10000,
            (feesInfo.attributorFee * totalAmount) / 10000
        ];

        return fees;
    }

    /**
     * @dev Attributes: removes amounts from budget and adds them to corresponding partners, users and fee collectors.
     *
     * Emits {Attributed}.
     *
     * Notes:
     * - When rewards are fungible tokens, fees will be a percentage of the payment and it will be substracted from the payment.
     * - When rewards are NFTs, fees will be a fixed amount and the `nftFeeBudget` will be used.
     *
     * Requirements:
     *
     * - Currency budgets have to be greater than amounts attributed.
     * - The sum of `amountToPartner` and `amountToEndUser` for each `Attribution` must be greater than zero.
     * - Only `MANAGER_ROLE` in {FuulFactory} addresses can call this function. This is checked through the `getFeesInformation` in {FuulFactory}.
     * - Proof must not exist (be previously attributed).
     * - {FuulManager} must not be paused. This is checked through The `attributeConversions` function in {FuulManager}.
     * - Currency token must be accepted in {FuulFactory}
     */

    function attributeConversions(
        Attribution[] calldata attributions,
        address attributorFeeCollector
    ) external nonReentrant {
        // Using this function to get all the necessary info from {FuulFactory} from one call
        IFuulFactory.FeesInformation memory feesInfo = fuulFactoryInstance
            .attributionFeeHelper(_msgSender());

        for (uint256 i = 0; i < attributions.length; ) {
            Attribution memory attribution = attributions[i];

            if (attributionProofs[attribution.proof]) {
                revert AlreadyAttributed();
            }

            if (
                keccak256(
                    abi.encodePacked(
                        attribution.proofWithoutProject,
                        address(this)
                    )
                ) != attribution.proof
            ) {
                revert InvalidProof();
            }

            address currency = attribution.currency;

            IFuulFactory.TokenType currencyType = _getCurrencyToken(currency);

            attributionProofs[attribution.proof] = true;

            uint256 totalAmount = attribution.amountToPartner +
                attribution.amountToEndUser;

            _nonZeroAmount(totalAmount);

            // Calculate fees and amounts

            uint256[3] memory fees;
            uint256 amountToPartner;
            uint256 amountToEndUser;
            address feeCurrency;

            if (
                currencyType == IFuulFactory.TokenType.NATIVE ||
                currencyType == IFuulFactory.TokenType.ERC_20
            ) {
                (
                    fees,
                    amountToPartner,
                    amountToEndUser
                ) = _calculateAmountsForFungibleToken(
                    feesInfo,
                    attribution.amountToPartner,
                    attribution.amountToEndUser
                );

                feeCurrency = currency;
            } else if (
                currencyType == IFuulFactory.TokenType.ERC_721 ||
                currencyType == IFuulFactory.TokenType.ERC_1155
            ) {
                // It is not necessary to check if it's an NFT address. If it has budget and it is not a fungible, then it's an NFT
                fees = _calculateFeesForNFT(feesInfo);
                amountToPartner = attribution.amountToPartner;
                amountToEndUser = attribution.amountToEndUser;

                feeCurrency = feesInfo.nftFeeCurrency;

                // Remove from fees budget
                nftFeeBudget[feeCurrency] -= (fees[0] + fees[1] + fees[2]);
            } else {
                revert InvalidCurrency();
            }

            // Update budget balance
            budgets[currency] -= totalAmount;

            // Update protocol balance
            availableToClaim[feesInfo.protocolFeeCollector][
                feeCurrency
            ] += fees[0];

            // Update client balance
            availableToClaim[clientFeeCollector][feeCurrency] += fees[1];

            // Update attributor balance
            availableToClaim[attributorFeeCollector][feeCurrency] += fees[2];

            // Update partner balance
            availableToClaim[attribution.partner][currency] += amountToPartner;

            // Update end user balance
            availableToClaim[attribution.endUser][currency] += amountToEndUser;

            // Emit Event
            emit Attributed(
                currency,
                totalAmount,
                [
                    feesInfo.protocolFeeCollector,
                    clientFeeCollector,
                    attributorFeeCollector,
                    attribution.partner,
                    attribution.endUser
                ],
                [fees[0], fees[1], fees[2], amountToPartner, amountToEndUser],
                attribution.proof
            );

            // Using unchecked to the next element in the loop optimize gas
            unchecked {
                i++;
            }
        }
    }

    /**
     * @dev Claims: sends funds to `receiver` that has available to claim funds.
     *
     * `tokenIds` parameter is only used when dealing with ERC1155 and ERC721 tokens.
     * `amounts` parameter is only used when dealing with ERC1155 tokens.
     *
     * Requirements:
     *
     * - `receiver` must have available funds to claim for {currency}.
     * - Only `MANAGER_ROLE` in {FuulFactory} addresses can call this function.
     * - {FuulManager} must not be paused. This is checked through The `claim` function in {FuulManager}.
     */

    function claimFromProject(
        address currency,
        address receiver,
        uint256 amount,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) external nonReentrant {
        fuulFactoryInstance.hasManagerRole(_msgSender());

        // It fails with underflow if amount < avaiable to claim
        availableToClaim[receiver][currency] -= amount;

        (IFuulFactory.TokenType currencyType, ) = fuulFactoryInstance
            .acceptedCurrencies(currency);

        if (currencyType == IFuulFactory.TokenType.NATIVE) {
            payable(receiver).sendValue(amount);
        } else if (currencyType == IFuulFactory.TokenType.ERC_20) {
            IERC20(currency).safeTransfer(receiver, amount);
        } else if (currencyType == IFuulFactory.TokenType.ERC_721) {
            uint256 tokenIdsLength = tokenIds.length;

            // Check that the amount of tokenIds to claim is equal to the available amount
            if (amount != tokenIdsLength) {
                revert InvalidArgument();
            }

            _transferERC721Tokens(currency, address(this), receiver, tokenIds);
        } else if (currencyType == IFuulFactory.TokenType.ERC_1155) {
            // Check that the sum of the amounts of tokenIds to claim is equal to the available amount

            if (amount != _getSumFromArray(amounts)) {
                revert InvalidArgument();
            }

            _transferERC1155Tokens(
                currency,
                address(this),
                receiver,
                tokenIds,
                amounts
            );
        } else {
            revert InvalidCurrency();
        }

        emit Claimed(receiver, currency, amount, tokenIds, amounts);
    }

    /*╔═════════════════════════════╗
      ║   INTERNAL TRANSFER TOKENS  ║
      ╚═════════════════════════════╝*/

    /**
     * @dev Helper function to transfer ERC721 tokens.
     */
    function _transferERC721Tokens(
        address tokenAddress,
        address senderAddress,
        address receiverAddress,
        uint256[] calldata tokenIds
    ) internal {
        for (uint256 i = 0; i < tokenIds.length; ) {
            IERC721(tokenAddress).safeTransferFrom(
                senderAddress,
                receiverAddress,
                tokenIds[i]
            );

            // Using unchecked to the next element in the loop optimize gas
            unchecked {
                i++;
            }
        }
    }

    /**
     * @dev Helper function to transfer ERC1155 tokens.
     */
    function _transferERC1155Tokens(
        address tokenAddress,
        address senderAddress,
        address receiverAddress,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) internal {
        // Transfer from does not allow to send more funds than balance
        IERC1155(tokenAddress).safeBatchTransferFrom(
            senderAddress,
            receiverAddress,
            tokenIds,
            amounts,
            ""
        );
    }

    /*╔═════════════════════════════╗
      ║            OTHER            ║
      ╚═════════════════════════════╝*/

    /**
     * @dev Gets token info from {FuulFactory}.
     */
    function _getCurrencyToken(
        address currency
    ) internal view returns (IFuulFactory.TokenType currencyType) {
        bool isAccepted;

        (currencyType, isAccepted) = fuulFactoryInstance.acceptedCurrencies(
            currency
        );

        if (!isAccepted) {
            revert IFuulFactory.TokenCurrencyNotAccepted();
        }

        return currencyType;
    }

    /**
     * @dev Helper function to sum all amounts inside the array.
     */
    function _getSumFromArray(
        uint256[] calldata amounts
    ) internal pure returns (uint256 result) {
        for (uint256 i = 0; i < amounts.length; ) {
            result += amounts[i];

            // Using unchecked to the next element in the loop optimize gas
            unchecked {
                i++;
            }
        }

        return result;
    }

    /*╔═════════════════════════════╗
      ║          OVERRIDES          ║
      ╚═════════════════════════════╝*/

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        virtual
        override(AccessControlEnumerable, ERC1155Holder)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
