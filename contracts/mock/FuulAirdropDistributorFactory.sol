// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

import "./FuulAirdropDistributor.sol";
import "../interfaces/IFuulAirdropDistributorFactory.sol";

/**
 * @title FuulAirdropDistributorFactory
 * @dev Mock implementation of the FuulAirdropDistributorFactory contract for local development.
 * Creates and tracks merkle-proof based airdrop distributors with staking integration.
 */
contract FuulAirdropDistributorFactory is
    IFuulAirdropDistributorFactory,
    AccessControlEnumerable
{
    // Implementation contract address for cloning
    address public immutable distributorImplementation;

    // Tracker of the number of distributors created
    uint256 private _distributorCount;

    // Mapping of distributor ID to address
    mapping(uint256 => address) public distributors;

    /**
     * @dev Constructor deploys the implementation contract and grants admin role.
     */
    constructor() {
        distributorImplementation = address(new FuulAirdropDistributor());
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    /**
     * @dev Creates a new airdrop distributor contract.
     * @param params The initialization parameters for the distributor
     * @return distributorAddress The address of the newly created distributor
     */
    function createDistributor(
        DistributorInitParams calldata params
    ) external returns (address distributorAddress) {
        if (params.admin == address(0) || params.currency == address(0)) {
            revert ZeroAddress();
        }

        if (params.distributorMerkleRoot == bytes32(0)) {
            revert InvalidMerkleRoot();
        }

        // Clone the implementation
        distributorAddress = Clones.clone(distributorImplementation);

        // Initialize the clone
        FuulAirdropDistributor(payable(distributorAddress)).initialize(
            params.admin,
            params.pauser,
            params.verifier,
            params.nativeFeeAmount,
            params.distributorMerkleRoot,
            params.currency,
            params.stakingContract,
            params.durationPenalty
        );

        // Track the distributor
        _distributorCount++;
        distributors[_distributorCount] = distributorAddress;

        emit DistributorCreated(
            _distributorCount,
            distributorAddress,
            params.admin,
            params.currency
        );

        return distributorAddress;
    }

    /**
     * @dev Returns the total number of distributors created.
     * @return The total count of distributors
     */
    function totalDistributorsCreated() external view returns (uint256) {
        return _distributorCount;
    }

    /**
     * @dev Returns the distributor address by ID.
     * @param distributorId The ID of the distributor
     * @return The distributor contract address
     */
    function getDistributor(
        uint256 distributorId
    ) external view returns (address) {
        return distributors[distributorId];
    }
}
