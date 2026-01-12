// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/**
 * @title IFuulAirdropDistributor
 * @dev Interface for the FuulAirdropDistributor contract that handles
 * merkle-proof based airdrop claims with optional staking integration.
 */
interface IFuulAirdropDistributor {
    // Events
    event Claimed(
        address indexed account,
        uint256 amount,
        uint256 claimedAmount,
        uint8 season
    );

    event MerkleRootUpdated(bytes32 distributorMerkleRoot);

    event MinimumTokenAmountForFeeUpdated(uint256 newAmount);

    event NativeFeeAmountUpdated(uint256 newAmount);

    event SignatureVerificationDisabled();

    event SignatureVerificationEnabled();

    event StakingContractUpdated(address newStakingContract);

    event StakingDurationPenaltyUpdated(
        uint256 duration,
        uint256 newPenalty,
        bool isEnabled
    );

    event TokensRemoved(
        address indexed to,
        uint256 indexed amount,
        address indexed tokenCurrency
    );

    // Errors
    error AlreadyClaimed();
    error FailedCall();
    error IncorrectMsgValue();
    error InvalidCurrency();
    error InvalidDuration();
    error InvalidFee();
    error InvalidProof();
    error InvalidSignature();
    error SignatureRequired();
    error StakingAmountMismatch();
    error StakingFailed();
    error StakingToZeroAddressNotAllowed();
    error Unauthorized();
    error ZeroAddress();
    error ZeroAmount();

    /**
     * @dev Claims tokens from the airdrop with optional staking.
     * @param _proof The merkle proof for the claim
     * @param _to The recipient address
     * @param _amount The total allocated amount
     * @param _season The airdrop season
     * @param _duration The staking duration (0 for no staking)
     * @param _signature The verification signature (if required)
     */
    function claim(
        bytes32[] calldata _proof,
        address _to,
        uint256 _amount,
        uint8 _season,
        uint256 _duration,
        bytes calldata _signature
    ) external payable;

    /**
     * @dev Returns the merkle root for the distribution.
     * @return The merkle root bytes32
     */
    function distributorMerkleRoot() external view returns (bytes32);

    /**
     * @dev Returns the currency token address.
     * @return The ERC20 token address
     */
    function currency() external view returns (address);

    /**
     * @dev Returns the staking contract address.
     * @return The staking contract address
     */
    function stakingContract() external view returns (address);

    /**
     * @dev Returns the native fee amount required for claims.
     * @return The fee amount in wei
     */
    function nativeFeeAmount() external view returns (uint256);

    /**
     * @dev Returns the minimum token amount required to pay fee.
     * @return The minimum token amount
     */
    function minimumTokenAmountForFee() external view returns (uint256);

    /**
     * @dev Returns whether signature verification is required.
     * @return True if signature is required
     */
    function isSignatureRequired() external view returns (bool);

    /**
     * @dev Returns the penalty percentage for a given staking duration.
     * @param duration The staking duration in seconds
     * @return The penalty percentage in basis points
     */
    function stakingDurationPenalty(
        uint256 duration
    ) external view returns (uint256);

    /**
     * @dev Returns whether a duration is valid for staking.
     * @param duration The staking duration to check
     * @return True if the duration is valid
     */
    function validDurations(uint256 duration) external view returns (bool);

    /**
     * @dev Returns whether a claim hash has been used.
     * @param claimHash The claim hash to check
     * @return True if the claim has been made
     */
    function usersClaims(bytes32 claimHash) external view returns (bool);

    /**
     * @dev Returns the total amount claimed by a user.
     * @param user The user address
     * @return The total claimed amount
     */
    function usersClaimedAmount(address user) external view returns (uint256);

    /**
     * @dev Updates the merkle root for the distribution.
     * @param _newMerkleRoot The new merkle root
     */
    function updateDistribution(bytes32 _newMerkleRoot) external;

    /**
     * @dev Updates the staking contract address.
     * @param _newStakingContract The new staking contract address
     */
    function setStakingContract(address _newStakingContract) external;

    /**
     * @dev Updates the native fee amount.
     * @param _newAmount The new fee amount
     */
    function updateNativeFeeAmount(uint256 _newAmount) external;

    /**
     * @dev Updates the minimum token amount for fee.
     * @param _newAmount The new minimum amount
     */
    function updateMinimumTokenAmountForFee(uint256 _newAmount) external;

    /**
     * @dev Updates a staking duration penalty.
     * @param _duration The staking duration
     * @param _newPenalty The new penalty percentage
     * @param _isEnabled Whether the duration is enabled
     */
    function updateStakingDurationPenalty(
        uint256 _duration,
        uint256 _newPenalty,
        bool _isEnabled
    ) external;

    /**
     * @dev Sets signature verification requirement.
     * @param _isSignatureRequired Whether signature is required
     */
    function setSignatureVerification(bool _isSignatureRequired) external;

    /**
     * @dev Removes tokens from the contract.
     * @param _to The recipient address
     * @param _amount The amount to remove
     * @param _tokenCurrency The token address (address(0) for native)
     */
    function removeTokens(
        address _to,
        uint256 _amount,
        address _tokenCurrency
    ) external;

    /**
     * @dev Pauses the contract.
     */
    function pause() external;

    /**
     * @dev Unpauses the contract.
     */
    function unpause() external;

    /**
     * @dev Returns the percentage denominator for calculations.
     * @return The denominator value (10000 = 100%)
     */
    function PERCENTAGE_DENOMINATOR() external view returns (uint256);
}
