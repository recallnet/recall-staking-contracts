// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

interface INftReceipt {
    function mint(address to, uint256 tokenId) external;
    function burn(uint256 tokenId) external;
}
