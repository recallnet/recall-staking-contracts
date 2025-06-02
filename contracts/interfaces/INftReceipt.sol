// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface INftReceipt {
    function mint(address to, uint256 tokenId) external;
    function burn(address from, uint256 tokenId) external;
}
