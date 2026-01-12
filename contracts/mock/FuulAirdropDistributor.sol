// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "../interfaces/IFuulAirdropDistributor.sol";
import "../interfaces/IFuulAirdropDistributorFactory.sol";
import "../interfaces/IStaking.sol";

/**
 * @title FuulAirdropDistributor
 * @dev Mock implementation of the FuulAirdropDistributor contract for local development.
 * Handles merkle-proof based airdrop claims with optional staking integration.
 */
contract FuulAirdropDistributor is
    IFuulAirdropDistributor,
    AccessControlEnumerable,
    Pausable,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;
    using Address for address payable;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // Role definitions
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UNPAUSER_ROLE = keccak256("UNPAUSER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    // Percentage denominator (10000 = 100%)
    uint256 public constant PERCENTAGE_DENOMINATOR = 10000;

    // Initialization flag
    bool private initialized;

    // Merkle root for distribution verification
    bytes32 public distributorMerkleRoot;

    // Token being distributed
    address public currency;

    // Staking contract for stake-and-claim
    address public stakingContract;

    // Native fee for claims
    uint256 public nativeFeeAmount;

    // Minimum token amount to require fee
    uint256 public minimumTokenAmountForFee;

    // Whether signature verification is required
    bool public isSignatureRequired;

    // Mapping of staking duration to penalty percentage
    mapping(uint256 => uint256) public stakingDurationPenalty;

    // Mapping of valid staking durations
    mapping(uint256 => bool) public validDurations;

    // Mapping of claim hashes to claimed status
    mapping(bytes32 => bool) public usersClaims;

    // Mapping of user addresses to total claimed amount
    mapping(address => uint256) public usersClaimedAmount;

    /**
     * @dev Empty constructor for clone pattern
     */
    constructor() {}

    /**
     * @dev Initializes the distributor contract.
     * @param _admin Admin address
     * @param _pauser Pauser address
     * @param _verifier Verifier address for signature verification
     * @param _nativeFeeAmount Native token fee for claims
     * @param _distributorMerkleRoot Merkle root for distribution
     * @param _currency ERC20 token address
     * @param _stakingContract Staking contract address
     * @param _durationPenalty Array of duration-penalty pairs
     */
    function initialize(
        address _admin,
        address _pauser,
        address _verifier,
        uint256 _nativeFeeAmount,
        bytes32 _distributorMerkleRoot,
        address _currency,
        address _stakingContract,
        IFuulAirdropDistributorFactory.DurationPenalty[] calldata _durationPenalty
    ) external {
        require(!initialized, "Already initialized");
        initialized = true;

        if (_admin == address(0) || _currency == address(0)) {
            revert ZeroAddress();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);

        if (_pauser != address(0)) {
            _grantRole(PAUSER_ROLE, _pauser);
            _grantRole(UNPAUSER_ROLE, _pauser);
        }

        if (_verifier != address(0)) {
            _grantRole(VERIFIER_ROLE, _verifier);
            isSignatureRequired = true;
        }

        nativeFeeAmount = _nativeFeeAmount;
        distributorMerkleRoot = _distributorMerkleRoot;
        currency = _currency;
        stakingContract = _stakingContract;

        // Set up duration penalties
        for (uint256 i = 0; i < _durationPenalty.length; ) {
            uint256 duration = _durationPenalty[i].duration;
            uint256 penalty = _durationPenalty[i].penalty;

            stakingDurationPenalty[duration] = penalty;
            validDurations[duration] = true;

            emit StakingDurationPenaltyUpdated(duration, penalty, true);

            unchecked {
                i++;
            }
        }

        // Duration 0 is always valid (no staking)
        validDurations[0] = true;
    }

    /**
     * @dev Claims tokens from the airdrop with optional staking.
     */
    function claim(
        bytes32[] calldata _proof,
        address _to,
        uint256 _amount,
        uint8 _season,
        uint256 _duration,
        bytes calldata _signature
    ) external payable nonReentrant whenNotPaused {
        if (_to == address(0)) {
            revert ZeroAddress();
        }
        if (_amount == 0) {
            revert ZeroAmount();
        }

        // Validate duration
        if (_duration != 0 && !validDurations[_duration]) {
            revert InvalidDuration();
        }

        // Check staking requirements
        if (_duration != 0 && stakingContract == address(0)) {
            revert StakingToZeroAddressNotAllowed();
        }

        // Verify signature if required
        if (isSignatureRequired) {
            if (_signature.length == 0) {
                revert SignatureRequired();
            }
            _verifySignature(_to, _amount, _season, _duration, _signature);
        }

        // Generate claim hash
        bytes32 claimHash = keccak256(
            abi.encodePacked(_to, _amount, _season)
        );

        // Check if already claimed
        if (usersClaims[claimHash]) {
            revert AlreadyClaimed();
        }

        // Verify merkle proof
        bytes32 leaf = keccak256(
            bytes.concat(keccak256(abi.encode(_to, _amount, _season)))
        );
        if (!MerkleProof.verify(_proof, distributorMerkleRoot, leaf)) {
            revert InvalidProof();
        }

        // Check and collect fee
        if (_amount >= minimumTokenAmountForFee && nativeFeeAmount > 0) {
            if (msg.value != nativeFeeAmount) {
                revert IncorrectMsgValue();
            }
        }

        // Mark as claimed
        usersClaims[claimHash] = true;

        // Calculate claim amount after penalty
        uint256 claimedAmount = _amount;
        if (_duration != 0) {
            uint256 penalty = stakingDurationPenalty[_duration];
            uint256 penaltyAmount = (_amount * penalty) / PERCENTAGE_DENOMINATOR;
            claimedAmount = _amount - penaltyAmount;
        } else {
            // No staking - apply maximum penalty (from duration 0)
            uint256 penalty = stakingDurationPenalty[0];
            if (penalty > 0) {
                uint256 penaltyAmount = (_amount * penalty) / PERCENTAGE_DENOMINATOR;
                claimedAmount = _amount - penaltyAmount;
            }
        }

        // Update claimed amount
        usersClaimedAmount[_to] += claimedAmount;

        // Transfer or stake
        if (_duration != 0) {
            // Approve staking contract
            IERC20(currency).approve(stakingContract, claimedAmount);

            // Stake on behalf of user using stake(address, uint256, uint256)
            try IStaking(stakingContract).stake(_to, claimedAmount, _duration) {
                // Staking successful
            } catch {
                revert StakingFailed();
            }
        } else {
            // Direct transfer
            IERC20(currency).safeTransfer(_to, claimedAmount);
        }

        emit Claimed(_to, _amount, claimedAmount, _season);
    }

    /**
     * @dev Verifies the signature for a claim.
     */
    function _verifySignature(
        address _to,
        uint256 _amount,
        uint8 _season,
        uint256 _duration,
        bytes calldata _signature
    ) internal view {
        bytes32 messageHash = keccak256(
            abi.encodePacked(_to, _amount, _season, _duration, address(this))
        );
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(_signature);

        if (!hasRole(VERIFIER_ROLE, signer)) {
            revert InvalidSignature();
        }
    }

    /*╔═════════════════════════════╗
      ║       ADMIN FUNCTIONS       ║
      ╚═════════════════════════════╝*/

    /**
     * @dev Updates the merkle root for the distribution.
     */
    function updateDistribution(
        bytes32 _newMerkleRoot
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        distributorMerkleRoot = _newMerkleRoot;
        emit MerkleRootUpdated(_newMerkleRoot);
    }

    /**
     * @dev Updates the staking contract address.
     */
    function setStakingContract(
        address _newStakingContract
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        stakingContract = _newStakingContract;
        emit StakingContractUpdated(_newStakingContract);
    }

    /**
     * @dev Updates the native fee amount.
     */
    function updateNativeFeeAmount(
        uint256 _newAmount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        nativeFeeAmount = _newAmount;
        emit NativeFeeAmountUpdated(_newAmount);
    }

    /**
     * @dev Updates the minimum token amount for fee.
     */
    function updateMinimumTokenAmountForFee(
        uint256 _newAmount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minimumTokenAmountForFee = _newAmount;
        emit MinimumTokenAmountForFeeUpdated(_newAmount);
    }

    /**
     * @dev Updates a staking duration penalty.
     */
    function updateStakingDurationPenalty(
        uint256 _duration,
        uint256 _newPenalty,
        bool _isEnabled
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        stakingDurationPenalty[_duration] = _newPenalty;
        validDurations[_duration] = _isEnabled;
        emit StakingDurationPenaltyUpdated(_duration, _newPenalty, _isEnabled);
    }

    /**
     * @dev Sets signature verification requirement.
     */
    function setSignatureVerification(
        bool _isSignatureRequired
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        isSignatureRequired = _isSignatureRequired;
        if (_isSignatureRequired) {
            emit SignatureVerificationEnabled();
        } else {
            emit SignatureVerificationDisabled();
        }
    }

    /**
     * @dev Removes tokens from the contract.
     */
    function removeTokens(
        address _to,
        uint256 _amount,
        address _tokenCurrency
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_to == address(0)) {
            revert ZeroAddress();
        }
        if (_amount == 0) {
            revert ZeroAmount();
        }

        if (_tokenCurrency == address(0)) {
            // Native token
            payable(_to).sendValue(_amount);
        } else {
            // ERC20 token
            IERC20(_tokenCurrency).safeTransfer(_to, _amount);
        }

        emit TokensRemoved(_to, _amount, _tokenCurrency);
    }

    /**
     * @dev Pauses the contract.
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpauses the contract.
     */
    function unpause() external onlyRole(UNPAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev Allows the contract to receive native tokens.
     */
    receive() external payable {}
}
