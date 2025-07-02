import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { SimpleMerkleTree } from "@openzeppelin/merkle-tree";
import { expect } from "chai";
import { ethers } from "hardhat";
import { DAY_SEC } from "../constants";

describe("Unit-tests for the RewardAllocation contract", () => {
    it("Deploy test", async () => {
        const env = await loadFixture(prepareEnvWithoutInitialization);

        expect(await env.rewardAllocationContract.allRootsLength()).equals(0);

        expect(await env.rewardAllocationContract.paused()).equals(false);

        expect(
            await env.rewardAllocationContract.getRoleMemberCount(
                env.DEFAULT_ADMIN_ROLE,
            ),
        ).equals(0);
        expect(
            await env.rewardAllocationContract.getRoleMemberCount(
                env.REWARD_ALLOCATOR_ROLE,
            ),
        ).equals(0);
        expect(
            await env.rewardAllocationContract.getRoleMemberCount(
                env.FUNDS_MANAGER_ROLE,
            ),
        ).equals(0);
        expect(
            await env.rewardAllocationContract.getRoleMemberCount(
                env.PAUSER_ROLE,
            ),
        ).equals(0);
        expect(
            await env.rewardAllocationContract.getRoleMemberCount(
                env.UNPAUSER_ROLE,
            ),
        ).equals(0);

        await expect(
            env.rewardAllocationImplementation.initialize(ethers.ZeroAddress),
        ).revertedWithCustomError(
            env.rewardAllocationImplementation,
            "InvalidInitialization",
        );
    });

    describe("{initialize} function", () => {
        it("Core functionality", async () => {
            const env = await loadFixture(prepareEnvWithoutInitialization);

            await env.rewardAllocationContract.initialize(env.admin);

            expect(
                await env.rewardAllocationContract.getRoleMemberCount(
                    env.DEFAULT_ADMIN_ROLE,
                ),
            ).equals(1);
            expect(
                await env.rewardAllocationContract.getRoleMemberCount(
                    env.REWARD_ALLOCATOR_ROLE,
                ),
            ).equals(0);
            expect(
                await env.rewardAllocationContract.getRoleMemberCount(
                    env.FUNDS_MANAGER_ROLE,
                ),
            ).equals(0);
            expect(
                await env.rewardAllocationContract.getRoleMemberCount(
                    env.PAUSER_ROLE,
                ),
            ).equals(0);
            expect(
                await env.rewardAllocationContract.getRoleMemberCount(
                    env.UNPAUSER_ROLE,
                ),
            ).equals(0);

            expect(
                await env.rewardAllocationContract.getRoleMember(
                    env.DEFAULT_ADMIN_ROLE,
                    0,
                ),
            ).equals(env.admin);
        });

        describe("Reverts", () => {
            it("Zero address", async () => {
                const env = await loadFixture(prepareEnvWithoutInitialization);

                await expect(
                    env.rewardAllocationContract.initialize(ethers.ZeroAddress),
                ).revertedWithCustomError(
                    env.rewardAllocationContract,
                    "RewardAllocation__ZeroAddress",
                );
            });
        });
    });

    describe("{claim} function", () => {
        it("Core functionality", async () => {
            const env = await loadFixture(prepareEnvWithAllocation);

            await time.increaseTo(env.allocationStartTimestamp);

            await expect(
                env.rewardAllocationContract
                    .connect(env.alice)
                    .claim(
                        env.allocationRoot,
                        env.aliceAllocationAmount,
                        env.aliceProof,
                    ),
            )
                .emit(env.rewardAllocationContract, "RewardClaimed")
                .withArgs(
                    env.allocationRoot,
                    env.alice,
                    env.aliceAllocationAmount,
                );

            expect(
                await env.rewardAllocationContract.hasClaimedLeaf(
                    env.allocationRoot,
                    env.aliceLeaf,
                ),
            ).true;

            expect(
                await env.rewardAllocationContract.totalOverallClaimableAmountPerToken(
                    env.allocationToken,
                ),
            ).equals(env.totalAllocationAmount - env.aliceAllocationAmount);

            expect(await env.allocationToken.balanceOf(env.alice)).equals(
                env.aliceAllocationAmount,
            );
            expect(
                await env.allocationToken.balanceOf(
                    env.rewardAllocationContract,
                ),
            ).equals(env.totalAllocationAmount - env.aliceAllocationAmount);
        });

        it("Two claims", async () => {
            const env = await loadFixture(prepareEnvWithAllocation);

            await time.increaseTo(env.allocationStartTimestamp);

            await env.rewardAllocationContract
                .connect(env.alice)
                .claim(
                    env.allocationRoot,
                    env.aliceAllocationAmount,
                    env.aliceProof,
                );

            await expect(
                env.rewardAllocationContract
                    .connect(env.bob)
                    .claim(
                        env.allocationRoot,
                        env.bobAllocationAmount,
                        env.bobProof,
                    ),
            )
                .emit(env.rewardAllocationContract, "RewardClaimed")
                .withArgs(env.allocationRoot, env.bob, env.bobAllocationAmount);

            expect(
                await env.rewardAllocationContract.hasClaimedLeaf(
                    env.allocationRoot,
                    env.bobLeaf,
                ),
            ).true;

            expect(
                await env.rewardAllocationContract.totalOverallClaimableAmountPerToken(
                    env.allocationToken,
                ),
            ).equals(
                env.totalAllocationAmount -
                    env.aliceAllocationAmount -
                    env.bobAllocationAmount,
            );

            expect(await env.allocationToken.balanceOf(env.bob)).equals(
                env.bobAllocationAmount,
            );
            expect(
                await env.allocationToken.balanceOf(
                    env.rewardAllocationContract,
                ),
            ).equals(
                env.totalAllocationAmount -
                    env.aliceAllocationAmount -
                    env.bobAllocationAmount,
            );
        });

        it("Claim the same user, but different leafs", async () => {
            const env = await loadFixture(prepareEnvWithAllocation);

            await time.increaseTo(env.allocationStartTimestamp);

            await env.rewardAllocationContract
                .connect(env.alice)
                .claim(
                    env.allocationRoot,
                    env.aliceAllocationAmount,
                    env.aliceProof,
                );

            await expect(
                env.rewardAllocationContract
                    .connect(env.alice)
                    .claim(
                        env.allocationRoot,
                        env.aliceAllocationAmount2,
                        env.aliceProof2,
                    ),
            )
                .emit(env.rewardAllocationContract, "RewardClaimed")
                .withArgs(
                    env.allocationRoot,
                    env.alice,
                    env.aliceAllocationAmount2,
                );

            expect(
                await env.rewardAllocationContract.hasClaimedLeaf(
                    env.allocationRoot,
                    env.aliceLeaf,
                ),
            ).true;
            expect(
                await env.rewardAllocationContract.hasClaimedLeaf(
                    env.allocationRoot,
                    env.aliceLeaf2,
                ),
            ).true;

            expect(
                await env.rewardAllocationContract.totalOverallClaimableAmountPerToken(
                    env.allocationToken,
                ),
            ).equals(
                env.totalAllocationAmount -
                    env.aliceAllocationAmount -
                    env.aliceAllocationAmount2,
            );

            expect(await env.allocationToken.balanceOf(env.alice)).equals(
                env.aliceAllocationAmount + env.aliceAllocationAmount2,
            );
            expect(
                await env.allocationToken.balanceOf(
                    env.rewardAllocationContract,
                ),
            ).equals(
                env.totalAllocationAmount -
                    env.aliceAllocationAmount -
                    env.aliceAllocationAmount2,
            );
        });

        describe("Reverts", () => {
            it("Zero amount", async () => {
                const env = await loadFixture(prepareEnvWithAllocation);

                await expect(
                    env.rewardAllocationContract.claim(
                        env.allocationRoot,
                        0n,
                        env.aliceProof,
                    ),
                ).revertedWithCustomError(
                    env.rewardAllocationContract,
                    "RewardAllocation__ZeroAmount",
                );
            });

            it("No root", async () => {
                const env = await loadFixture(prepareEnvWithAllocation);

                const newRoot = ethers.keccak256(env.allocationRoot);

                await expect(
                    env.rewardAllocationContract.claim(
                        newRoot,
                        env.aliceAllocationAmount,
                        env.aliceProof,
                    ),
                )
                    .revertedWithCustomError(
                        env.rewardAllocationContract,
                        "RewardAllocation__ThisRootDoesNotExist",
                    )
                    .withArgs(newRoot);
            });

            it("Emergency withdrawn token", async () => {
                const env = await loadFixture(prepareEnvWithAllocation);

                await env.rewardAllocationContract.connect(env.pauser).pause();
                await env.rewardAllocationContract
                    .connect(env.fundsManager)
                    .emergencyWithdraw(env.allocationToken, env.alice.address);
                await env.rewardAllocationContract
                    .connect(env.unpauser)
                    .unpause();

                await expect(
                    env.rewardAllocationContract.claim(
                        env.allocationRoot,
                        env.aliceAllocationAmount,
                        env.aliceProof,
                    ),
                )
                    .revertedWithCustomError(
                        env.rewardAllocationContract,
                        "RewardAllocation__ThisTokenIsEmergencyWithdrawn",
                    )
                    .withArgs(env.allocationToken);
            });

            it("Not started yet", async () => {
                const env = await loadFixture(prepareEnvWithAllocation);

                await expect(
                    env.rewardAllocationContract.claim(
                        env.allocationRoot,
                        env.aliceAllocationAmount,
                        env.aliceProof,
                    ),
                )
                    .revertedWithCustomError(
                        env.rewardAllocationContract,
                        "RewardAllocation__ClaimPeriodNotYetActive",
                    )
                    .withArgs(
                        env.allocationRoot,
                        env.allocationStartTimestamp,
                        (await time.latest()) + 1,
                    );
            });

            it("Double claim the same leaf", async () => {
                const env = await loadFixture(prepareEnvWithAllocation);

                await time.increaseTo(env.allocationStartTimestamp);

                await env.rewardAllocationContract
                    .connect(env.alice)
                    .claim(
                        env.allocationRoot,
                        env.aliceAllocationAmount,
                        env.aliceProof,
                    );

                await expect(
                    env.rewardAllocationContract
                        .connect(env.alice)
                        .claim(
                            env.allocationRoot,
                            env.aliceAllocationAmount,
                            env.aliceProof,
                        ),
                )
                    .revertedWithCustomError(
                        env.rewardAllocationContract,
                        "RewardAllocation__RewardAlreadyClaimedForThisAllocation",
                    )
                    .withArgs(
                        env.allocationRoot,
                        env.alice,
                        env.aliceAllocationAmount,
                        env.aliceLeaf,
                    );
            });

            it("Invalid merkle proof", async () => {
                const env = await loadFixture(prepareEnvWithAllocation);

                await time.increaseTo(env.allocationStartTimestamp);

                await expect(
                    env.rewardAllocationContract
                        .connect(env.alice)
                        .claim(
                            env.allocationRoot,
                            env.aliceAllocationAmount,
                            env.bobProof,
                        ),
                )
                    .revertedWithCustomError(
                        env.rewardAllocationContract,
                        "RewardAllocation__InvalidMerkleProof",
                    )
                    .withArgs(
                        env.allocationRoot,
                        ethers.solidityPackedKeccak256(
                            ["string", "address", "uint256"],
                            [
                                "rl",
                                env.alice.address,
                                env.aliceAllocationAmount,
                            ],
                        ),
                        env.bobProof,
                    );
            });

            it("Wrong allocated amount (less than actual claim amount)", async () => {
                const env = await loadFixture(prepareEnv);

                const allocatedAmount = ethers.WeiPerEther;

                const values = [["rl", env.alice.address, allocatedAmount]].map(
                    (value) => {
                        return ethers.solidityPackedKeccak256(
                            ["string", "address", "uint256"],
                            value,
                        );
                    },
                );

                const tree = SimpleMerkleTree.of(values);

                const aliceProof = tree.getProof(0);

                const wrongAllocatedAmount = allocatedAmount - 1n;

                await env.token1.mint(wrongAllocatedAmount);
                await env.token1.transfer(
                    env.rewardAllocationContract,
                    wrongAllocatedAmount,
                );

                const allocationStartTimestamp =
                    (await time.latest()) + DAY_SEC;

                await env.rewardAllocationContract
                    .connect(env.rewardAllocator)
                    .addAllocation(
                        tree.root,
                        env.token1,
                        wrongAllocatedAmount,
                        0,
                    );

                await expect(
                    env.rewardAllocationContract
                        .connect(env.alice)
                        .claim(tree.root, allocatedAmount, aliceProof),
                )
                    .revertedWithCustomError(
                        env.rewardAllocationContract,
                        "RewardAllocation__ClaimedExceedsAllocated",
                    )
                    .withArgs(tree.root, allocatedAmount, wrongAllocatedAmount);
            });

            it("Paused", async () => {
                const env = await loadFixture(prepareEnvWithAllocation);

                await env.rewardAllocationContract.connect(env.pauser).pause();

                await expect(
                    env.rewardAllocationContract.claim(
                        env.allocationRoot,
                        0n,
                        env.aliceProof,
                    ),
                ).revertedWithCustomError(
                    env.rewardAllocationContract,
                    "EnforcedPause",
                );
            });
        });
    });

    describe("{addAllocation} function", () => {
        it("Core functionality", async () => {
            const env = await loadFixture(prepareEnvWithAllocationParameters);

            await expect(
                env.rewardAllocationContract
                    .connect(env.rewardAllocator)
                    .addAllocation(
                        env.allocationRoot,
                        env.allocationToken,
                        env.totalAllocationAmount,
                        env.allocationStartTimestamp,
                    ),
            )
                .emit(env.rewardAllocationContract, "AllocationAdded")
                .withArgs(
                    env.allocationRoot,
                    env.allocationToken,
                    env.totalAllocationAmount,
                    env.allocationStartTimestamp,
                );

            const allocationInfo = await env.rewardAllocationContract.allocInfo(
                env.allocationRoot,
            );
            expect(allocationInfo.token).equals(env.allocationToken);
            expect(allocationInfo.allocatedAmount).equals(
                env.totalAllocationAmount,
            );
            expect(allocationInfo.claimedAmount).equals(0);
            expect(allocationInfo.startTimestamp).equals(
                env.allocationStartTimestamp,
            );

            const allRoots = await env.rewardAllocationContract.allRoots();
            expect(allRoots.length).equals(1);
            expect(allRoots[0]).equals(env.allocationRoot);

            expect(await env.rewardAllocationContract.allRootsLength()).equals(
                1,
            );
            expect(await env.rewardAllocationContract.allRootsAt(0)).equals(
                env.allocationRoot,
            );

            expect(
                await env.rewardAllocationContract.totalOverallClaimableAmountPerToken(
                    env.allocationToken,
                ),
            ).equals(env.totalAllocationAmount);
        });

        describe("Reverts", () => {
            it("Zero token or amount", async () => {
                const env = await loadFixture(prepareEnv);

                await expect(
                    env.rewardAllocationContract
                        .connect(env.rewardAllocator)
                        .addAllocation(
                            ethers.ZeroHash,
                            ethers.ZeroAddress,
                            0n,
                            0,
                        ),
                ).revertedWithCustomError(
                    env.rewardAllocationContract,
                    "RewardAllocation__ZeroAddress",
                );
                await expect(
                    env.rewardAllocationContract
                        .connect(env.rewardAllocator)
                        .addAllocation(ethers.ZeroHash, env.token1, 0n, 0),
                ).revertedWithCustomError(
                    env.rewardAllocationContract,
                    "RewardAllocation__ZeroAmount",
                );
            });

            it("Emergency withdrawn token", async () => {
                const env = await loadFixture(prepareEnvWithAllocation);

                await env.rewardAllocationContract.connect(env.pauser).pause();
                await env.rewardAllocationContract
                    .connect(env.fundsManager)
                    .emergencyWithdraw(env.allocationToken, env.alice.address);
                await env.rewardAllocationContract
                    .connect(env.unpauser)
                    .unpause();

                await expect(
                    env.rewardAllocationContract
                        .connect(env.rewardAllocator)
                        .addAllocation(
                            env.allocationRoot,
                            env.allocationToken,
                            env.aliceAllocationAmount,
                            0,
                        ),
                )
                    .revertedWithCustomError(
                        env.rewardAllocationContract,
                        "RewardAllocation__ThisTokenIsEmergencyWithdrawn",
                    )
                    .withArgs(env.allocationToken);
            });

            it("Double add", async () => {
                const env = await loadFixture(prepareEnvWithAllocation);

                await expect(
                    env.rewardAllocationContract
                        .connect(env.rewardAllocator)
                        .addAllocation(
                            env.allocationRoot,
                            env.allocationToken,
                            env.aliceAllocationAmount,
                            0,
                        ),
                )
                    .revertedWithCustomError(
                        env.rewardAllocationContract,
                        "RewardAllocation__ThisRootAlreadyExists",
                    )
                    .withArgs(env.allocationRoot);
            });

            it("Not enough balance", async () => {
                const env = await loadFixture(
                    prepareEnvWithAllocationParameters,
                );

                await expect(
                    env.rewardAllocationContract
                        .connect(env.rewardAllocator)
                        .addAllocation(
                            env.allocationRoot,
                            env.allocationToken,
                            env.totalAllocationAmount + 1n,
                            0,
                        ),
                )
                    .revertedWithCustomError(
                        env.rewardAllocationContract,
                        "RewardAllocation__InsufficientContractBalance",
                    )
                    .withArgs(
                        env.allocationToken,
                        env.totalAllocationAmount,
                        env.totalAllocationAmount + 1n,
                    );
            });

            it("Wrong caller", async () => {
                const env = await loadFixture(
                    prepareEnvWithAllocationParameters,
                );

                await expect(
                    env.rewardAllocationContract
                        .connect(env.alice)
                        .addAllocation(
                            env.allocationRoot,
                            env.allocationToken,
                            env.aliceAllocationAmount,
                            env.allocationStartTimestamp,
                        ),
                )
                    .revertedWithCustomError(
                        env.rewardAllocationContract,
                        "AccessControlUnauthorizedAccount",
                    )
                    .withArgs(env.alice, env.REWARD_ALLOCATOR_ROLE);
            });
        });
    });

    describe("{cancelAllocation} function", () => {
        it("Core functionality", async () => {
            const env = await loadFixture(prepareEnvWithAllocation);

            await expect(
                env.rewardAllocationContract
                    .connect(env.rewardAllocator)
                    .cancelAllocation(env.allocationRoot),
            )
                .emit(env.rewardAllocationContract, "AllocationCancelled")
                .withArgs(
                    env.allocationRoot,
                    env.allocationToken,
                    env.totalAllocationAmount,
                );

            expect(await env.rewardAllocationContract.allRootsLength()).equals(
                0,
            );
            expect(
                await env.rewardAllocationContract.totalOverallClaimableAmountPerToken(
                    env.allocationToken,
                ),
            ).equals(0);

            expect(
                await env.rewardAllocationContract.isTokenEmergencyWithdrawn(
                    env.allocationToken,
                ),
            ).false;

            const allocationInfo = await env.rewardAllocationContract.allocInfo(
                env.allocationRoot,
            );
            expect(allocationInfo.token).equals(ethers.ZeroAddress);
            expect(allocationInfo.allocatedAmount).equals(0);
            expect(allocationInfo.claimedAmount).equals(0);
            expect(allocationInfo.startTimestamp).equals(0);
        });

        describe("Reverts", () => {
            it("No root", async () => {
                const env = await loadFixture(prepareEnv);

                await expect(
                    env.rewardAllocationContract
                        .connect(env.rewardAllocator)
                        .cancelAllocation(ethers.ZeroHash),
                )
                    .revertedWithCustomError(
                        env.rewardAllocationContract,
                        "RewardAllocation__ThisRootDoesNotExist",
                    )
                    .withArgs(ethers.ZeroHash);
            });

            it("Already claimed", async () => {
                const env = await loadFixture(prepareEnvWithAllocation);

                await time.increaseTo(env.allocationStartTimestamp);

                await env.rewardAllocationContract
                    .connect(env.alice)
                    .claim(
                        env.allocationRoot,
                        env.aliceAllocationAmount,
                        env.aliceProof,
                    );

                await expect(
                    env.rewardAllocationContract
                        .connect(env.rewardAllocator)
                        .cancelAllocation(env.allocationRoot),
                )
                    .revertedWithCustomError(
                        env.rewardAllocationContract,
                        "RewardAllocation__ThisRootIsNotCancellable",
                    )
                    .withArgs(env.allocationRoot);
            });

            it("Token is emergency withdrawn", async () => {
                const env = await loadFixture(prepareEnvWithAllocation);

                await env.rewardAllocationContract.connect(env.pauser).pause();
                await env.rewardAllocationContract
                    .connect(env.fundsManager)
                    .emergencyWithdraw(env.allocationToken, env.alice.address);
                await env.rewardAllocationContract
                    .connect(env.unpauser)
                    .unpause();

                await expect(
                    env.rewardAllocationContract
                        .connect(env.rewardAllocator)
                        .cancelAllocation(env.allocationRoot),
                )
                    .revertedWithCustomError(
                        env.rewardAllocationContract,
                        "RewardAllocation__ThisTokenIsEmergencyWithdrawn",
                    )
                    .withArgs(env.allocationToken);
            });

            it("Wrong caller", async () => {
                const env = await loadFixture(prepareEnv);

                await expect(
                    env.rewardAllocationContract
                        .connect(env.alice)
                        .cancelAllocation(ethers.ZeroHash),
                )
                    .revertedWithCustomError(
                        env.rewardAllocationContract,
                        "AccessControlUnauthorizedAccount",
                    )
                    .withArgs(env.alice, env.REWARD_ALLOCATOR_ROLE);
            });
        });
    });

    describe("{pause} and {unpause} functions", () => {
        it("Core functionality", async () => {
            const env = await loadFixture(prepareEnv);

            expect(await env.rewardAllocationContract.paused()).equals(false);

            await env.rewardAllocationContract.connect(env.pauser).pause();

            expect(await env.rewardAllocationContract.paused()).equals(true);

            await env.rewardAllocationContract.connect(env.unpauser).unpause();

            expect(await env.rewardAllocationContract.paused()).equals(false);
        });

        describe("Reverts", () => {
            it("Wrong caller", async () => {
                const env = await loadFixture(prepareEnv);

                await expect(
                    env.rewardAllocationContract.connect(env.alice).pause(),
                )
                    .revertedWithCustomError(
                        env.rewardAllocationContract,
                        "AccessControlUnauthorizedAccount",
                    )
                    .withArgs(env.alice, env.PAUSER_ROLE);

                await expect(
                    env.rewardAllocationContract.connect(env.alice).unpause(),
                )
                    .revertedWithCustomError(
                        env.rewardAllocationContract,
                        "AccessControlUnauthorizedAccount",
                    )
                    .withArgs(env.alice, env.UNPAUSER_ROLE);
            });
        });
    });

    describe("{withdrawSurplusTokens} function", () => {
        it("Core functionality", async () => {
            const env = await loadFixture(prepareEnvWithAllocation);

            const surplusAmountToken1 = (ethers.WeiPerEther * 3n) / 2n;
            await env.token1.mint(surplusAmountToken1);
            await env.token1.transfer(
                env.rewardAllocationContract,
                surplusAmountToken1,
            );

            const surplusAmountToken2 = (ethers.WeiPerEther * 8n) / 5n;
            await env.token2.mint(surplusAmountToken2);
            await env.token2.transfer(
                env.rewardAllocationContract,
                surplusAmountToken2,
            );

            const withdrawAmountToken1 = surplusAmountToken1 / 2n;

            await env.rewardAllocationContract.connect(env.pauser).pause();

            await expect(
                env.rewardAllocationContract
                    .connect(env.fundsManager)
                    .withdrawSurplusTokens(
                        env.token1,
                        env.alice,
                        withdrawAmountToken1,
                    ),
            )
                .emit(env.rewardAllocationContract, "SurplusTokensWithdrawn")
                .withArgs(env.token1, env.alice, withdrawAmountToken1);

            const withdrawAmountToken2 = surplusAmountToken2 / 5n;

            await expect(
                env.rewardAllocationContract
                    .connect(env.fundsManager)
                    .withdrawSurplusTokens(
                        env.token2,
                        env.bob,
                        withdrawAmountToken2,
                    ),
            )
                .emit(env.rewardAllocationContract, "SurplusTokensWithdrawn")
                .withArgs(env.token2, env.bob, withdrawAmountToken2);

            expect(await env.token1.balanceOf(env.alice)).equals(
                withdrawAmountToken1,
            );
            expect(
                await env.token1.balanceOf(env.rewardAllocationContract),
            ).equals(
                env.totalAllocationAmount +
                    surplusAmountToken1 -
                    withdrawAmountToken1,
            );

            expect(await env.token2.balanceOf(env.bob)).equals(
                withdrawAmountToken2,
            );
            expect(
                await env.token2.balanceOf(env.rewardAllocationContract),
            ).equals(surplusAmountToken2 - withdrawAmountToken2);

            expect(
                await env.rewardAllocationContract.isTokenEmergencyWithdrawn(
                    env.token1,
                ),
            ).false;
            expect(
                await env.rewardAllocationContract.isTokenEmergencyWithdrawn(
                    env.token2,
                ),
            ).false;

            expect(
                await env.rewardAllocationContract.totalOverallClaimableAmountPerToken(
                    env.token1,
                ),
            ).equals(env.totalAllocationAmount);
            expect(
                await env.rewardAllocationContract.totalOverallClaimableAmountPerToken(
                    env.token2,
                ),
            ).equals(0);
        });

        describe("Reverts", () => {
            it("Not paused", async () => {
                const env = await loadFixture(prepareEnv);

                await expect(
                    env.rewardAllocationContract
                        .connect(env.fundsManager)
                        .withdrawSurplusTokens(env.token1, env.alice, 1n),
                ).revertedWithCustomError(
                    env.rewardAllocationContract,
                    "ExpectedPause",
                );
            });

            it("Zero addresses and amount", async () => {
                const env = await loadFixture(prepareEnv);

                await env.rewardAllocationContract.connect(env.pauser).pause();
                await expect(
                    env.rewardAllocationContract
                        .connect(env.fundsManager)
                        .withdrawSurplusTokens(
                            ethers.ZeroAddress,
                            env.alice,
                            0n,
                        ),
                ).revertedWithCustomError(
                    env.rewardAllocationContract,
                    "RewardAllocation__ZeroAddress",
                );
                await expect(
                    env.rewardAllocationContract
                        .connect(env.fundsManager)
                        .withdrawSurplusTokens(
                            env.token1,
                            ethers.ZeroAddress,
                            0n,
                        ),
                ).revertedWithCustomError(
                    env.rewardAllocationContract,
                    "RewardAllocation__ZeroAddress",
                );
                await expect(
                    env.rewardAllocationContract
                        .connect(env.fundsManager)
                        .withdrawSurplusTokens(env.token1, env.alice, 0n),
                ).revertedWithCustomError(
                    env.rewardAllocationContract,
                    "RewardAllocation__ZeroAmount",
                );
            });

            it("Token is emergency withdrawn", async () => {
                const env = await loadFixture(prepareEnvWithAllocation);

                await env.rewardAllocationContract.connect(env.pauser).pause();
                await env.rewardAllocationContract
                    .connect(env.fundsManager)
                    .emergencyWithdraw(env.allocationToken, env.alice.address);

                await expect(
                    env.rewardAllocationContract
                        .connect(env.fundsManager)
                        .withdrawSurplusTokens(
                            env.allocationToken,
                            env.alice,
                            1n,
                        ),
                )
                    .revertedWithCustomError(
                        env.rewardAllocationContract,
                        "RewardAllocation__ThisTokenIsEmergencyWithdrawn",
                    )
                    .withArgs(env.allocationToken);
            });

            it("Not enough surplus tokens", async () => {
                const env = await loadFixture(prepareEnvWithAllocation);

                const surplusAmountToken1 = (ethers.WeiPerEther * 3n) / 2n;
                await env.token1.mint(surplusAmountToken1);
                await env.token1.transfer(
                    env.rewardAllocationContract,
                    surplusAmountToken1,
                );

                await env.rewardAllocationContract.connect(env.pauser).pause();

                await expect(
                    env.rewardAllocationContract
                        .connect(env.fundsManager)
                        .withdrawSurplusTokens(
                            env.allocationToken,
                            env.alice,
                            surplusAmountToken1 + 1n,
                        ),
                )
                    .revertedWithCustomError(
                        env.rewardAllocationContract,
                        "RewardAllocation__NotEnoughSurplusTokens",
                    )
                    .withArgs(
                        env.allocationToken,
                        surplusAmountToken1,
                        surplusAmountToken1 + 1n,
                    );
            });

            it("Wrong caller", async () => {
                const env = await loadFixture(prepareEnv);

                await env.rewardAllocationContract.connect(env.pauser).pause();

                await expect(
                    env.rewardAllocationContract
                        .connect(env.alice)
                        .withdrawSurplusTokens(env.token1, env.alice, 1n),
                )
                    .revertedWithCustomError(
                        env.rewardAllocationContract,
                        "AccessControlUnauthorizedAccount",
                    )
                    .withArgs(env.alice, env.FUNDS_MANAGER_ROLE);
            });
        });
    });

    describe("{emergencyWithdraw} function", () => {
        it("Core functionality", async () => {
            const env = await loadFixture(prepareEnvWithAllocation);

            const surplusAmount = ethers.WeiPerEther * 3n;
            await env.allocationToken.mint(surplusAmount);
            await env.allocationToken.transfer(
                env.rewardAllocationContract,
                surplusAmount,
            );

            await env.rewardAllocationContract.connect(env.pauser).pause();

            await expect(
                env.rewardAllocationContract
                    .connect(env.fundsManager)
                    .emergencyWithdraw(env.allocationToken, env.alice.address),
            )
                .emit(env.rewardAllocationContract, "TokensEmergencyWithdrawn")
                .withArgs(
                    env.allocationToken,
                    env.alice,
                    env.totalAllocationAmount + surplusAmount,
                );

            expect(await env.allocationToken.balanceOf(env.alice)).equals(
                env.totalAllocationAmount + surplusAmount,
            );
            expect(
                await env.allocationToken.balanceOf(
                    env.rewardAllocationContract,
                ),
            ).equals(0);

            expect(
                await env.rewardAllocationContract.isTokenEmergencyWithdrawn(
                    env.allocationToken,
                ),
            ).true;

            expect(
                await env.rewardAllocationContract.totalOverallClaimableAmountPerToken(
                    env.allocationToken,
                ),
            ).equals(0);
        });

        it("Zero balance", async () => {
            const env = await loadFixture(prepareEnvWithAllocation);

            await env.rewardAllocationContract.connect(env.pauser).pause();

            await expect(
                env.rewardAllocationContract
                    .connect(env.fundsManager)
                    .emergencyWithdraw(env.token2, env.alice.address),
            ).not.emit(
                env.rewardAllocationContract,
                "TokensEmergencyWithdrawn",
            );

            expect(await env.token2.balanceOf(env.alice)).equals(0);
            expect(
                await env.token2.balanceOf(env.rewardAllocationContract),
            ).equals(0);

            expect(
                await env.rewardAllocationContract.isTokenEmergencyWithdrawn(
                    env.token2,
                ),
            ).false;

            expect(
                await env.rewardAllocationContract.totalOverallClaimableAmountPerToken(
                    env.token2,
                ),
            ).equals(0);
        });

        it("Token is already emergency withdrawn", async () => {
            const env = await loadFixture(prepareEnvWithAllocation);

            await env.rewardAllocationContract.connect(env.pauser).pause();

            await env.rewardAllocationContract
                .connect(env.fundsManager)
                .emergencyWithdraw(env.allocationToken, env.alice.address);

            const balance = await env.allocationToken.balanceOf(env.alice);
            await env.allocationToken
                .connect(env.alice)
                .transfer(env.rewardAllocationContract, balance);

            await expect(
                env.rewardAllocationContract
                    .connect(env.fundsManager)
                    .emergencyWithdraw(env.allocationToken, env.alice.address),
            )
                .emit(env.rewardAllocationContract, "TokensEmergencyWithdrawn")
                .withArgs(env.allocationToken, env.alice, balance);

            expect(await env.allocationToken.balanceOf(env.alice)).equals(
                balance,
            );
            expect(
                await env.allocationToken.balanceOf(
                    env.rewardAllocationContract,
                ),
            ).equals(0);

            expect(
                await env.rewardAllocationContract.isTokenEmergencyWithdrawn(
                    env.allocationToken,
                ),
            ).true;

            expect(
                await env.rewardAllocationContract.totalOverallClaimableAmountPerToken(
                    env.allocationToken,
                ),
            ).equals(0);
        });

        describe("Reverts", () => {
            it("Not paused", async () => {
                const env = await loadFixture(prepareEnv);

                await expect(
                    env.rewardAllocationContract
                        .connect(env.fundsManager)
                        .emergencyWithdraw(
                            ethers.ZeroAddress,
                            env.alice.address,
                        ),
                ).revertedWithCustomError(
                    env.rewardAllocationContract,
                    "ExpectedPause",
                );
            });

            it("Zero address", async () => {
                const env = await loadFixture(prepareEnv);

                await env.rewardAllocationContract.connect(env.pauser).pause();

                await expect(
                    env.rewardAllocationContract
                        .connect(env.fundsManager)
                        .emergencyWithdraw(
                            ethers.ZeroAddress,
                            env.alice.address,
                        ),
                ).revertedWithCustomError(
                    env.rewardAllocationContract,
                    "RewardAllocation__ZeroAddress",
                );
                await expect(
                    env.rewardAllocationContract
                        .connect(env.fundsManager)
                        .emergencyWithdraw(env.token1, ethers.ZeroAddress),
                ).revertedWithCustomError(
                    env.rewardAllocationContract,
                    "RewardAllocation__ZeroAddress",
                );
            });

            it("Wrong caller", async () => {
                const env = await loadFixture(prepareEnv);

                await env.rewardAllocationContract.connect(env.pauser).pause();

                await expect(
                    env.rewardAllocationContract
                        .connect(env.alice)
                        .emergencyWithdraw(env.token1, env.alice.address),
                )
                    .revertedWithCustomError(
                        env.rewardAllocationContract,
                        "AccessControlUnauthorizedAccount",
                    )
                    .withArgs(env.alice, env.FUNDS_MANAGER_ROLE);
            });
        });
    });
});

async function prepareEnvWithAllocation() {
    const env = await loadFixture(prepareEnvWithAllocationParameters);

    await env.rewardAllocationContract
        .connect(env.rewardAllocator)
        .addAllocation(
            env.allocationRoot,
            env.allocationToken,
            env.totalAllocationAmount,
            env.allocationStartTimestamp,
        );

    return {
        ...env,
    };
}

async function prepareEnvWithAllocationParameters() {
    const env = await loadFixture(prepareEnv);

    const allocationToken = env.token1;

    const aliceAllocationAmount = ethers.WeiPerEther;
    const aliceAllocationAmount2 = aliceAllocationAmount * 4n;
    const bobAllocationAmount = ethers.WeiPerEther * 3n;
    const carolAllocationAmount = ethers.WeiPerEther / 2n;

    const totalAllocationAmount =
        aliceAllocationAmount +
        aliceAllocationAmount2 +
        bobAllocationAmount +
        carolAllocationAmount;

    const values = [
        ["rl", env.alice.address, aliceAllocationAmount],
        ["rl", env.alice.address, aliceAllocationAmount2],
        ["rl", env.bob.address, bobAllocationAmount],
        ["rl", env.carol.address, carolAllocationAmount],
    ].map((value) => {
        return ethers.solidityPackedKeccak256(
            ["string", "address", "uint256"],
            value,
        );
    });

    const tree = SimpleMerkleTree.of(values);

    const aliceProof = tree.getProof(0);
    const aliceProof2 = tree.getProof(1);
    const bobProof = tree.getProof(2);
    const carolProof = tree.getProof(3);

    const aliceLeaf = values[0];
    const aliceLeaf2 = values[1];
    const bobLeaf = values[2];
    const carolLeaf = values[3];

    const allocationStartTimestamp = (await time.latest()) + DAY_SEC;

    await allocationToken.mint(totalAllocationAmount);

    await allocationToken.transfer(
        env.rewardAllocationContract,
        totalAllocationAmount,
    );

    return {
        ...env,

        aliceAllocationAmount,
        aliceAllocationAmount2,
        bobAllocationAmount,
        carolAllocationAmount,

        tree,
        allocationRoot: tree.root,

        allocationToken,
        totalAllocationAmount,
        allocationStartTimestamp,

        aliceProof,
        aliceProof2,
        bobProof,
        carolProof,

        aliceLeaf,
        aliceLeaf2,
        bobLeaf,
        carolLeaf,
    };
}

async function prepareEnv() {
    const env = await loadFixture(prepareEnvWithoutInitialization);

    await env.rewardAllocationContract.initialize(env.admin);

    await env.rewardAllocationContract
        .connect(env.admin)
        .grantRole(env.REWARD_ALLOCATOR_ROLE, env.rewardAllocator);
    await env.rewardAllocationContract
        .connect(env.admin)
        .grantRole(env.FUNDS_MANAGER_ROLE, env.fundsManager);
    await env.rewardAllocationContract
        .connect(env.admin)
        .grantRole(env.PAUSER_ROLE, env.pauser);
    await env.rewardAllocationContract
        .connect(env.admin)
        .grantRole(env.UNPAUSER_ROLE, env.unpauser);

    return {
        ...env,
    };
}

async function prepareEnvWithoutInitialization() {
    const [
        deployer,
        admin,
        rewardAllocator,
        fundsManager,
        pauser,
        unpauser,
        alice,
        bob,
        carol,
    ] = await ethers.getSigners();

    const erc20MockFactory = await ethers.getContractFactory("ERC20Mock");
    const token1 = await erc20MockFactory.deploy();
    const token2 = await erc20MockFactory.deploy();

    const rewardAllocationFactory =
        await ethers.getContractFactory("RewardAllocation");
    const rewardAllocationImplementation =
        await rewardAllocationFactory.deploy();

    const transparentUpgradeableProxyFactory = await ethers.getContractFactory(
        "TransparentUpgradeableProxy",
    );
    const rewardAllocationProxy =
        await transparentUpgradeableProxyFactory.deploy(
            rewardAllocationImplementation,
            deployer,
            "0x",
        );
    const rewardAllocationContract = await ethers.getContractAt(
        "RewardAllocation",
        rewardAllocationProxy,
    );

    const DEFAULT_ADMIN_ROLE =
        await rewardAllocationContract.DEFAULT_ADMIN_ROLE();
    const REWARD_ALLOCATOR_ROLE =
        await rewardAllocationContract.REWARD_ALLOCATOR_ROLE();
    const FUNDS_MANAGER_ROLE =
        await rewardAllocationContract.FUNDS_MANAGER_ROLE();
    const PAUSER_ROLE = await rewardAllocationContract.PAUSER_ROLE();
    const UNPAUSER_ROLE = await rewardAllocationContract.UNPAUSER_ROLE();

    return {
        deployer,
        admin,
        rewardAllocator,
        fundsManager,
        pauser,
        unpauser,
        alice,
        bob,
        carol,

        rewardAllocationImplementation,
        rewardAllocationContract,

        DEFAULT_ADMIN_ROLE,
        REWARD_ALLOCATOR_ROLE,
        FUNDS_MANAGER_ROLE,
        PAUSER_ROLE,
        UNPAUSER_ROLE,

        token1,
        token2,
    };
}
