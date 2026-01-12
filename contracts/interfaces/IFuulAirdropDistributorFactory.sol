// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/**
 * @title IFuulAirdropDistributorFactory
 * @dev Interface for the FuulAirdropDistributorFactory contract that creates
 * merkle-proof based airdrop distributors with staking integration.
 */
interface IFuulAirdropDistributorFactory {
    /**
     * @dev Struct representing a staking duration and its associated penalty.
     * @param duration The staking duration in seconds
     * @param penalty The penalty percentage (basis points, where 10000 = 100%)
     */
    struct DurationPenalty {
        uint256 duration;
        uint256 penalty;
    }

    /**
     * @dev Struct containing initialization parameters for creating a new distributor.
     * @param admin The admin address for the distributor
     * @param pauser The pauser address for the distributor
     * @param verifier The verifier address for signature verification
     * @param nativeFeeAmount The native token fee amount required for claims
     * @param distributorMerkleRoot The merkle root for the airdrop distribution
     * @param currency The ERC20 token address for the airdrop
     * @param stakingContract The staking contract address
     * @param durationPenalty Array of duration-penalty pairs for staking options
     */
    struct DistributorInitParams {
        address admin;
        address pauser;
        address verifier;
        uint256 nativeFeeAmount;
        bytes32 distributorMerkleRoot;
        address currency;
        address stakingContract;
        DurationPenalty[] durationPenalty;
    }

    // Events
    event DistributorCreated(
        uint256 indexed distributorId,
        address indexed distributorAddress,
        address indexed admin,
        address currency
    );

    // Errors
    error ZeroAddress();
    error InvalidMerkleRoot();
    error InvalidDurationPenalty();

    /**
     * @dev Creates a new airdrop distributor contract.
     * @param params The initialization parameters for the distributor
     * @return The address of the newly created distributor
     */
    function createDistributor(
        DistributorInitParams calldata params
    ) external returns (address);

    /**
     * @dev Returns the total number of distributors created.
     * @return The total count of distributors
     */
    function totalDistributorsCreated() external view returns (uint256);

    /**
     * @dev Returns the distributor implementation address.
     * @return The implementation contract address
     */
    function distributorImplementation() external view returns (address);
}
