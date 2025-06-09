// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {
    MulticallUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/MulticallUpgradeable.sol";

import {
    AccessControlEnumerableUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/extensions/AccessControlEnumerableUpgradeable.sol";
import {
    ReentrancyGuardUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {
    PausableUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

import {IRewardAllocation} from "./interfaces/IRewardAllocation.sol";

contract RewardAllocation is
    AccessControlEnumerableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    MulticallUpgradeable,
    IRewardAllocation
{
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.Bytes32Set;

    /* GLOBAL VARIABLES */

    /// @inheritdoc IRewardAllocation
    bytes32 public constant override REWARD_ALLOCATOR_ROLE = keccak256("REWARD_ALLOCATOR_ROLE");

    /// @inheritdoc IRewardAllocation
    bytes32 public constant override FUNDS_MANAGER_ROLE = keccak256("FUNDS_MANAGER_ROLE");

    /// @inheritdoc IRewardAllocation
    bytes32 public constant override PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @inheritdoc IRewardAllocation
    bytes32 public constant override UNPAUSER_ROLE = keccak256("UNPAUSER_ROLE");

    /// @inheritdoc IRewardAllocation
    mapping(bytes32 root => mapping(address user => bool)) public override hasClaimed;

    /// @inheritdoc IRewardAllocation
    mapping(address token => uint256) public override totalOverallClaimableAmountPerToken;

    /// @inheritdoc IRewardAllocation
    mapping(address token => bool) public override isTokenEmergencyWithdrawn;

    /// @dev Set to store all active Merkle roots for efficient iteration and existence checks.
    EnumerableSet.Bytes32Set private _allRoots;

    /// @dev Mapping from a Merkle root to its detailed allocation information.
    mapping(bytes32 root => AllocationInfo) private _allocInfo;

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

    /// @inheritdoc IRewardAllocation
    function initialize(address defaultAdmin) external override initializer {
        if (defaultAdmin == address(0)) {
            revert RewardAllocation__ZeroAddress();
        }

        __AccessControlEnumerable_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    /* EXTERNAL USER FUNCTIONS */

    /// @inheritdoc IRewardAllocation
    function claim(
        bytes32 root,
        uint256 claimAmount,
        bytes32[] memory proof
    ) external override nonReentrant whenNotPaused {
        if (claimAmount == 0) {
            revert RewardAllocation__ZeroAmount();
        }

        AllocationInfo storage allocation = _allocInfo[root];

        address token = allocation.token;
        if (token == address(0)) {
            revert RewardAllocation__ThisRootDoesNotExist(root);
        }
        if (isTokenEmergencyWithdrawn[token]) {
            revert RewardAllocation__ThisTokenIsEmergencyWithdrawn(token);
        }
        if (block.timestamp < allocation.startTimestamp) {
            revert RewardAllocation__ClaimPeriodNotYetActive({
                root: root,
                startTimestamp: allocation.startTimestamp,
                blockTimestamp: block.timestamp
            });
        }
        if (hasClaimed[root][msg.sender]) {
            revert RewardAllocation__RewardAlreadyClaimedForThisAllocation({
                root: root,
                user: msg.sender
            });
        }

        bytes32 leaf = keccak256(abi.encodePacked("rl", msg.sender, claimAmount));

        if (!MerkleProof.verify({proof: proof, root: root, leaf: leaf})) {
            revert RewardAllocation__InvalidMerkleProof({root: root, leaf: leaf, proof: proof});
        }

        allocation.claimedAmount += claimAmount;
        if (allocation.claimedAmount > allocation.allocatedAmount) {
            revert RewardAllocation__ClaimedExceedsAllocated({
                root: root,
                claimedAmount: allocation.claimedAmount,
                allocatedAmount: allocation.allocatedAmount
            });
        }

        hasClaimed[root][msg.sender] = true;
        totalOverallClaimableAmountPerToken[token] -= claimAmount;

        IERC20(token).safeTransfer(msg.sender, claimAmount);

        emit RewardClaimed(root, msg.sender, claimAmount);
    }

    /* EXTERNAL ADMIN FUNCTIONS */

    /// @inheritdoc IRewardAllocation
    function addAllocation(
        bytes32 root,
        address token,
        uint256 allocatedAmount,
        uint256 startTimestamp
    ) external override onlyRole(REWARD_ALLOCATOR_ROLE) nonReentrant {
        if (token == address(0)) {
            revert RewardAllocation__ZeroAddress();
        }
        if (allocatedAmount == 0) {
            revert RewardAllocation__ZeroAmount();
        }

        if (isTokenEmergencyWithdrawn[token]) {
            revert RewardAllocation__ThisTokenIsEmergencyWithdrawn(token);
        }
        if (_allocInfo[root].token != address(0)) {
            revert RewardAllocation__ThisRootAlreadyExists(root);
        }

        uint256 tokenBalance = IERC20(token).balanceOf(address(this));
        uint256 requiredTokenBalance = totalOverallClaimableAmountPerToken[token] + allocatedAmount;
        if (tokenBalance < requiredTokenBalance) {
            revert RewardAllocation__InsufficientContractBalance({
                token: token,
                tokenBalance: tokenBalance,
                requiredTokenBalance: requiredTokenBalance
            });
        }
        totalOverallClaimableAmountPerToken[token] = requiredTokenBalance;

        _allocInfo[root] = AllocationInfo({
            token: token,
            allocatedAmount: allocatedAmount,
            claimedAmount: 0,
            startTimestamp: startTimestamp
        });

        _allRoots.add(root);

        emit AllocationAdded({
            root: root,
            token: token,
            allocatedAmount: allocatedAmount,
            startTimestamp: startTimestamp
        });
    }

    /// @inheritdoc IRewardAllocation
    function cancelAllocation(
        bytes32 root
    ) external override onlyRole(REWARD_ALLOCATOR_ROLE) nonReentrant {
        AllocationInfo storage allocation = _allocInfo[root];

        address token = allocation.token;
        if (token == address(0)) {
            revert RewardAllocation__ThisRootDoesNotExist(root);
        }
        if (allocation.claimedAmount != 0) {
            revert RewardAllocation__ThisRootIsNotCancellable(root);
        }
        if (isTokenEmergencyWithdrawn[token]) {
            revert RewardAllocation__ThisTokenIsEmergencyWithdrawn(token);
        }

        uint256 amountToUncommit = allocation.allocatedAmount;

        totalOverallClaimableAmountPerToken[token] -= amountToUncommit;

        delete _allocInfo[root];

        _allRoots.remove(root);

        emit AllocationCancelled({root: root, token: token, uncommittedAmount: amountToUncommit});
    }

    /// @inheritdoc IRewardAllocation
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @inheritdoc IRewardAllocation
    function unpause() external onlyRole(UNPAUSER_ROLE) {
        _unpause();
    }

    /// @inheritdoc IRewardAllocation
    function withdrawSurplusTokens(
        address token,
        address to,
        uint256 withdrawAmount
    ) external override onlyRole(FUNDS_MANAGER_ROLE) nonReentrant {
        if (token == address(0)) {
            revert RewardAllocation__ZeroAddress();
        }
        if (to == address(0)) {
            revert RewardAllocation__ZeroAddress();
        }
        if (withdrawAmount == 0) {
            revert RewardAllocation__ZeroAmount();
        }
        if (isTokenEmergencyWithdrawn[token]) {
            revert RewardAllocation__ThisTokenIsEmergencyWithdrawn(token);
        }

        uint256 tokenBalance = IERC20(token).balanceOf(address(this));
        uint256 tokenSurplus = tokenBalance - totalOverallClaimableAmountPerToken[token];
        if (withdrawAmount > tokenSurplus) {
            revert RewardAllocation__NotEnoughSurplusTokens({
                token: token,
                surplusTokens: tokenSurplus,
                withdrawAmount: withdrawAmount
            });
        }

        IERC20(token).safeTransfer(to, withdrawAmount);

        emit SurplusTokensWithdrawn(token, to, withdrawAmount);
    }

    /// @inheritdoc IRewardAllocation
    function emergencyWithdraw(
        address token,
        address to
    ) external override onlyRole(FUNDS_MANAGER_ROLE) nonReentrant {
        if (token == address(0)) {
            revert RewardAllocation__ZeroAddress();
        }
        if (to == address(0)) {
            revert RewardAllocation__ZeroAddress();
        }
        if (isTokenEmergencyWithdrawn[token]) {
            revert RewardAllocation__ThisTokenIsEmergencyWithdrawn(token);
        }

        uint256 tokenBalance = IERC20(token).balanceOf(address(this));
        if (tokenBalance == 0) {
            return;
        }

        delete totalOverallClaimableAmountPerToken[token];

        isTokenEmergencyWithdrawn[token] = true;

        IERC20(token).safeTransfer(to, tokenBalance);

        emit TokensEmergencyWithdrawn(token, to, tokenBalance);
    }

    /* EXTERNAL VIEW FUNCTIONS */

    /// @inheritdoc IRewardAllocation
    function allRoots() external view override returns (bytes32[] memory) {
        return _allRoots.values();
    }

    /// @inheritdoc IRewardAllocation
    function allRootsLength() external view override returns (uint256) {
        return _allRoots.length();
    }

    /// @inheritdoc IRewardAllocation
    function allRootsAt(uint256 index) external view override returns (bytes32) {
        return _allRoots.at(index);
    }

    /// @inheritdoc IRewardAllocation
    function allocInfo(bytes32 root) external view override returns (AllocationInfo memory) {
        return _allocInfo[root];
    }
}
