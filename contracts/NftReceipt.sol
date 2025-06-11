// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {
    ERC721EnumerableUpgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";

import {INftReceipt} from "./interfaces/INftReceipt.sol";

contract NftReceipt is ERC721EnumerableUpgradeable, INftReceipt {
    /* GLOBAL VARIABLES */

    /// @inheritdoc INftReceipt
    address public override staking;

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
    function initialize() external override initializer {
        __ERC721_init("Recall Staking NFT Receipt", "RSNFTR");
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

    /// @inheritdoc INftReceipt
    function setStaking(address _staking) external override {
        // @note called only once, during deployment
        if (staking != address(0)) {
            revert NftReceipt__StakingAlreadySet();
        }

        staking = _staking;
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
