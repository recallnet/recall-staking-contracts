// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {
    IAccessControlEnumerable
} from "@openzeppelin/contracts/access/extensions/IAccessControlEnumerable.sol";
import {
    IERC721Enumerable
} from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";

interface INftReceipt is IAccessControlEnumerable, IERC721Enumerable {
    /* ERRORS */

    /**
     * @notice Thrown when an attempt is made to set the staking contract address
     * after it has already been set.
     * The staking address is immutable after the initial setting.
     */
    error NftReceipt__StakingAlreadySet();

    /**
     * @notice Thrown when a function protected by the `onlyStaking` modifier
     * is called by an address other than the designated staking contract.
     */
    error NftReceipt__OnlyStaking();

    /**
     * @notice Thrown on any attempt to transfer an NFT from one address to another.
     * These NFT receipts are non-transferable and can only be minted to or burned from an owner's address.
     */
    error NftReceipt__TransfersNotAllowed();

    /* EVENTS */

    /**
     * @notice Emitted when the base URI string is updated.
     * @param newBaseURIString The new base URI string.
     */
    event BaseURIStringChanged(string newBaseURIString);

    /* INITIALIZER */

    /**
     * @notice Initializes the contract, setting the name and symbol for the NFT collection.
     * This function is intended to be called only once, typically during the proxy deployment.
     */
    function initialize(address defaultAdmin) external;

    /* GLOBAL VARIABLES */

    /**
     * @notice Returns the role identifier required to set the NFT metadata, such as the base URI.
     * @return The bytes32 value of the role.
     */
    function SET_NFT_METADATA_ROLE() external view returns (bytes32);

    /**
     * @notice Returns the address of the main staking contract.
     * @return The address of the authorized staking contract.
     */
    function staking() external view returns (address);

    /**
     * @notice Returns the base URI string used to construct the token URI.
     * @dev The final token URI is constructed by concatenating this base URI with the token ID.
     * @return The current base URI string.
     */
    function baseURIString() external view returns (string memory);

    /* FUNCTIONS */

    /**
     * @notice Mints a new NFT receipt and assigns it to a specified owner.
     * @dev This can only be called by the `staking` contract.
     * @param to The address to which the new NFT will be minted.
     * @param tokenId The unique identifier for the new NFT.
     */
    function mint(address to, uint256 tokenId) external;

    /**
     * @notice Burns (destroys) an existing NFT receipt.
     * @dev This can only be called by the `staking` contract.
     * @param tokenId The unique identifier of the NFT to be burned.
     */
    function burn(uint256 tokenId) external;

    /* ADMIN FUNCTIONS */

    /**
     * @notice Sets the address of the staking contract.
     * @dev This function is designed to be called only once, right after deployment,
     * to prevent unauthorized changes.
     * @param _staking The address of the staking contract.
     */
    function setStaking(address _staking) external;

    /**
     * @notice Sets the base URI string for the token metadata.
     * @dev Requires the caller to have the `SET_NFT_METADATA_ROLE`.
     * @param newBaseURIString The new base URI string to be set.
     */
    function setBaseURI(string memory newBaseURIString) external;

    /* VIEW FUNCTIONS */

    /**
     * @notice Retrieves a list of all token IDs owned by a specific address.
     * @param owner The address to query for token ownership.
     * @return An array of `uint256` token IDs.
     */
    function tokensOfOwner(address owner) external view returns (uint256[] memory);
}
