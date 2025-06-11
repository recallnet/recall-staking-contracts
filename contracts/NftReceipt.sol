// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";

import {
    ERC721EnumerableUpgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import {
    AccessControlEnumerableUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/extensions/AccessControlEnumerableUpgradeable.sol";

import {INftReceipt} from "./interfaces/INftReceipt.sol";

contract NftReceipt is
    ERC721EnumerableUpgradeable,
    AccessControlEnumerableUpgradeable,
    INftReceipt
{
    /* GLOBAL VARIABLES */

    bytes32 public constant override SET_NFT_METADATA_ROLE = keccak256("SET_NFT_METADATA_ROLE");

    /// @inheritdoc INftReceipt
    address public override staking;

    /// @inheritdoc INftReceipt
    string public override baseURIString;

    /* MODIFIERS */

    modifier onlyStaking() {
        if (msg.sender != staking) {
            revert NftReceipt__OnlyStaking();
        }
        _;
    }

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

    /// @inheritdoc INftReceipt
    function initialize(address defaultAdmin) external override initializer {
        __AccessControlEnumerable_init();
        __ERC721_init("Recall Staking NFT Receipt", "RSNFTR");

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    /* EXTERNAL FUNCTIONS */

    /// @inheritdoc INftReceipt
    function mint(address to, uint256 tokenId) external override onlyStaking {
        _mint(to, tokenId);
    }

    /// @inheritdoc INftReceipt
    function burn(uint256 tokenId) external override onlyStaking {
        _burn(tokenId);
    }

    /* ADMIN FUNCTIONS */

    /// @inheritdoc INftReceipt
    function setStaking(address _staking) external override {
        // @note called only once, during deployment
        if (staking != address(0)) {
            revert NftReceipt__StakingAlreadySet();
        }

        staking = _staking;
    }

    /// @inheritdoc INftReceipt
    function setBaseURI(
        string memory newBaseURIString
    ) external override onlyRole(SET_NFT_METADATA_ROLE) {
        baseURIString = newBaseURIString;

        emit BaseURIStringChanged({newBaseURIString: newBaseURIString});
    }

    /* EXTERNAL VIEW FUNCTIONS */

    /// @inheritdoc INftReceipt
    function tokensOfOwner(address owner) external view returns (uint256[] memory) {
        uint256 ownerBalance = balanceOf(owner);

        uint256[] memory tokenIds = new uint256[](ownerBalance);
        for (uint256 i = 0; i < ownerBalance; i++) {
            tokenIds[i] = tokenOfOwnerByIndex(owner, i);
        }

        return tokenIds;
    }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        return string.concat(baseURIString, Strings.toHexString({value: tokenId}));
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        virtual
        override(IERC165, ERC721EnumerableUpgradeable, AccessControlEnumerableUpgradeable)
        returns (bool)
    {
        return
            ERC721EnumerableUpgradeable.supportsInterface(interfaceId) ||
            AccessControlEnumerableUpgradeable.supportsInterface(interfaceId);
    }

    /* INTERNAL FUNCTIONS */

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);

        if (to != address(0) && from != address(0)) {
            revert NftReceipt__TransfersNotAllowed();
        }

        return super._update(to, tokenId, auth);
    }
}
