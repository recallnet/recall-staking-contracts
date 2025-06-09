import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { WeiPerEther, ZeroAddress } from "ethers";
import { ethers } from "hardhat";
import { DAY_SEC } from "../constants";

describe("Unit-tests for the Staking contract", () => {
    describe("Deployment", () => {
        it("Deploy staking contract (without initialization)", async () => {
            const env = await loadFixture(prepareEnvWithoutInitialization);

            expect(await env.stakingContract.stakeToken()).to.equal(
                ZeroAddress,
            );

            expect(await env.stakingContract.nftReceipt()).to.equal(
                ZeroAddress,
            );

            expect(await env.stakingContract.lastId()).to.equal(0);

            expect(await env.stakingContract.totalStaked()).to.equal(0);

            expect(await env.stakingContract.minStakeAmount()).to.equal(0);

            expect(await env.stakingContract.withdrawCooldown()).to.equal(0);

            expect(await env.stakingContract.unlockedAll()).to.equal(false);

            expect(
                await env.stakingContract.allowedDurations(30 * DAY_SEC),
            ).to.equal(false);
            expect(
                await env.stakingContract.allowedDurations(60 * DAY_SEC),
            ).to.equal(false);
            expect(
                await env.stakingContract.allowedDurations(90 * DAY_SEC),
            ).to.equal(false);

            expect(
                await env.stakingContract.totalUserStaked(env.deployer),
            ).to.equal(0);

            // default admin before initialization
            expect(
                await env.stakingContract.hasRole(
                    await env.stakingContract.DEFAULT_ADMIN_ROLE(),
                    env.defaultAdmin,
                ),
            ).to.equal(false);
        });
    });

    describe("Initialization", () => {
        it("Initialize staking contract", async () => {
            const env = await loadFixture(prepareEnv);

            expect(await env.stakingContract.stakeToken()).to.equal(env.token);
            expect(await env.stakingContract.nftReceipt()).to.equal(
                env.nftReceipt,
            );

            expect(await env.stakingContract.lastId()).to.equal(0);

            expect(await env.stakingContract.totalStaked()).to.equal(0);

            expect(await env.stakingContract.minStakeAmount()).to.equal(0);

            expect(await env.stakingContract.withdrawCooldown()).to.equal(
                30 * DAY_SEC,
            );

            expect(await env.stakingContract.unlockedAll()).to.equal(false);

            expect(
                await env.stakingContract.allowedDurations(30 * DAY_SEC),
            ).to.equal(true);
            expect(
                await env.stakingContract.allowedDurations(60 * DAY_SEC),
            ).to.equal(true);
            expect(
                await env.stakingContract.allowedDurations(90 * DAY_SEC),
            ).to.equal(true);

            expect(
                await env.stakingContract.totalUserStaked(env.deployer),
            ).to.equal(0);

            // default admin after initialization
            const DEFAULT_ADMIN_ROLE =
                await env.stakingContract.DEFAULT_ADMIN_ROLE();
            expect(
                await env.stakingContract.hasRole(
                    DEFAULT_ADMIN_ROLE,
                    env.defaultAdmin,
                ),
            ).to.equal(true);
        });

        describe("Reverts", () => {
            it("In case of zero address of token", async () => {
                const env = await loadFixture(prepareEnvWithoutInitialization);
                await expect(
                    env.stakingContract.initialize(
                        ZeroAddress,
                        env.nftReceipt,
                        env.defaultAdmin,
                    ),
                ).revertedWithCustomError(env.stakingContract, "ZeroAddress");
            });

            it("In case of zero address of nftReceipt", async () => {
                const env = await loadFixture(prepareEnvWithoutInitialization);
                await expect(
                    env.stakingContract.initialize(
                        env.token,
                        ZeroAddress,
                        env.defaultAdmin,
                    ),
                ).revertedWithCustomError(env.stakingContract, "ZeroAddress");
            });

            it("In case of zero address of default admin", async () => {
                const env = await loadFixture(prepareEnvWithoutInitialization);
                await expect(
                    env.stakingContract.initialize(
                        env.token,
                        env.nftReceipt,
                        ZeroAddress,
                    ),
                ).revertedWithCustomError(env.stakingContract, "ZeroAddress");
            });
        });
    });

    describe("{stake} function", () => {
        it("Stake for allowed duration of 30 days", async () => {
            const env = await loadFixture(prepareEnv);
            const duration = 30 * DAY_SEC;
            const newTokenId = (await env.stakingContract.lastId()) + 1n;

            await env.token
                .connect(env.alice)
                .approve(env.stakingContract, env.aliceBalance);

            const stakeTime = (await time.latest()) + 30;
            await time.setNextBlockTimestamp(stakeTime);

            const tx = env.stakingContract
                .connect(env.alice)
                .stake(env.aliceBalance, duration);
            await expect(tx).to.changeTokenBalances(
                env.token,
                [env.alice, env.stakingContract],
                [env.aliceBalance * -1n, env.aliceBalance],
            );

            await expect(tx)
                .emit(env.stakingContract, "Stake")
                .withArgs(
                    env.alice.address,
                    newTokenId,
                    env.aliceBalance,
                    stakeTime,
                    stakeTime + duration,
                );

            (await tx).wait();

            expect(await env.stakingContract.lastId()).to.equal(newTokenId);

            const stakeInfo = await env.stakingContract.stakeInfo(newTokenId);
            expect(stakeInfo.amount).to.equal(env.aliceBalance);
            expect(stakeInfo.startTime).to.equal(stakeTime);
            expect(stakeInfo.lockupEndTime).to.equal(stakeTime + duration);
            expect(stakeInfo.withdrawAllowedTime).to.equal(0);

            expect(
                await env.stakingContract.totalUserStaked(env.alice),
            ).to.equal(env.aliceBalance);
            expect(await env.stakingContract.totalStaked()).to.equal(
                env.aliceBalance,
            );

            // nftReceipt
            expect(await env.nftReceipt.ownerOf(newTokenId)).to.equal(
                env.alice,
            );
        });

        it("Stake for allowed duration of 60 days", async () => {
            const env = await loadFixture(prepareEnv);
            const duration = 60 * DAY_SEC;
            const tokenId = (await env.stakingContract.lastId()) + 1n;

            await env.token
                .connect(env.bob)
                .approve(env.stakingContract, env.bobBalance);

            const stakeTime = (await time.latest()) + 30;
            await time.setNextBlockTimestamp(stakeTime);

            const tx = env.stakingContract
                .connect(env.bob)
                .stake(env.bobBalance, duration);

            await expect(tx).to.changeTokenBalances(
                env.token,
                [env.bob, env.stakingContract],
                [env.bobBalance * -1n, env.bobBalance],
            );

            await expect(tx)
                .emit(env.stakingContract, "Stake")
                .withArgs(
                    env.bob,
                    tokenId,
                    env.bobBalance,
                    stakeTime,
                    stakeTime + duration,
                );

            (await tx).wait();

            expect(await env.stakingContract.lastId()).to.equal(tokenId);

            const stakeInfo = await env.stakingContract.stakeInfo(tokenId);
            expect(stakeInfo.amount).to.equal(env.bobBalance);
            expect(stakeInfo.startTime).to.equal(stakeTime);
            expect(stakeInfo.lockupEndTime).to.equal(stakeTime + duration);
            expect(stakeInfo.withdrawAllowedTime).to.equal(0);

            expect(await env.stakingContract.totalUserStaked(env.bob)).to.equal(
                env.bobBalance,
            );
            expect(await env.stakingContract.totalStaked()).to.equal(
                env.bobBalance,
            );

            // nftReceipt
            expect(await env.nftReceipt.ownerOf(tokenId)).to.equal(env.bob);
        });

        describe("Reverts", () => {
            it("Stake with zero amount", async () => {
                const env = await loadFixture(prepareEnv);
                const amount = 0;
                const duration = 30 * DAY_SEC;

                await expect(
                    env.stakingContract
                        .connect(env.alice)
                        .stake(amount, duration),
                ).revertedWithCustomError(
                    env.stakingContract,
                    "NotAllowedAmount",
                );
            });

            it("Stake with zero duration", async () => {
                const env = await loadFixture(prepareEnv);
                const amount = 100;
                let duration = 0;

                await expect(
                    env.stakingContract
                        .connect(env.alice)
                        .stake(amount, duration),
                ).revertedWithCustomError(
                    env.stakingContract,
                    "NotAllowedDuration",
                );

                duration = 100 * DAY_SEC;

                await expect(
                    env.stakingContract
                        .connect(env.alice)
                        .stake(amount, duration),
                ).revertedWithCustomError(
                    env.stakingContract,
                    "NotAllowedDuration",
                );
            });

            it("Stake with duration greater than max duration", async () => {
                const env = await loadFixture(prepareEnv);
                const amount = 100;
                const duration = 90 * DAY_SEC + 1;

                await expect(
                    env.stakingContract
                        .connect(env.alice)
                        .stake(amount, duration),
                ).revertedWithCustomError(
                    env.stakingContract,
                    "NotAllowedDuration",
                );
            });

            it("Stake with amount less than minStakeAmount", async () => {
                const env = await loadFixture(prepareEnvWithGrantedRoles);

                const minStakeAmount = WeiPerEther * 100n;
                await env.stakingContract
                    .connect(env.managerAdmin)
                    .setMinStakeAmount(minStakeAmount);

                const amount = minStakeAmount - 1n;
                const duration = 30 * DAY_SEC;

                await expect(
                    env.stakingContract
                        .connect(env.alice)
                        .stake(amount, duration),
                ).revertedWithCustomError(
                    env.stakingContract,
                    "NotAllowedAmount",
                );
            });

            it("When paused", async () => {
                const env = await loadFixture(prepareEnvWithGrantedRoles);

                await env.stakingContract.connect(env.pauserAdmin).pause();

                const amount = WeiPerEther * 100n;
                const duration = 30 * DAY_SEC;

                await expect(
                    env.stakingContract
                        .connect(env.alice)
                        .stake(amount, duration),
                ).revertedWithCustomError(env.stakingContract, "EnforcedPause");
            });
        });
    });

    describe("{relock} 'partial' function", () => {
        it("Relocks after lockup period", async () => {
            const env = await loadFixture(prepareEnvWithStakes);
            const stakeInfo = await env.stakingContract.stakeInfo(1);
            const nextTime = env.aliceStake0.lockupEndTime + 1000;
            await time.setNextBlockTimestamp(nextTime);

            const tokenId = 1;
            const newAliceDuration = 60 * DAY_SEC;
            const newAliceAmount = env.aliceBalance - 1000n;
            const remainingAmount = env.aliceBalance - newAliceAmount;
            const lastId = await env.stakingContract.lastId();
            const newTokenId = lastId + 1n;

            const tx = env.stakingContract
                .connect(env.alice)
                [
                    "relock(uint256,uint256,uint256)"
                ](tokenId, newAliceDuration, newAliceAmount);

            await expect(tx).to.changeTokenBalances(
                env.token,
                [env.alice, env.stakingContract],
                [0, 0],
            );

            await expect(tx)
                .emit(env.stakingContract, "Relock")
                .withArgs(env.alice.address, tokenId, remainingAmount);
            await expect(tx)
                .emit(env.stakingContract, "Stake")
                .withArgs(
                    env.alice.address,
                    newTokenId,
                    newAliceAmount,
                    nextTime,
                    nextTime + newAliceDuration,
                );

            (await tx).wait();

            expect(await env.stakingContract.lastId()).to.equal(newTokenId);

            const stakeInfo0 = await env.stakingContract.stakeInfo(tokenId);
            expect(stakeInfo0.amount).to.equal(remainingAmount);
            expect(stakeInfo0.startTime).to.equal(env.aliceStake0.startTime);
            expect(stakeInfo0.lockupEndTime).to.equal(
                env.aliceStake0.lockupEndTime,
            );
            expect(stakeInfo0.withdrawAllowedTime).to.equal(0);

            const stakeInfo1 = await env.stakingContract.stakeInfo(newTokenId);
            expect(stakeInfo1.amount).to.equal(newAliceAmount);
            expect(stakeInfo1.startTime).to.equal(nextTime);
            expect(stakeInfo1.lockupEndTime).to.equal(
                nextTime + newAliceDuration,
            );
            expect(stakeInfo1.withdrawAllowedTime).to.equal(0);

            expect(
                await env.stakingContract.totalUserStaked(env.alice),
            ).to.equal(env.aliceBalance);

            expect(await env.stakingContract.totalStaked()).to.equal(
                env.aliceBalance + env.bobBalance + env.carolBalance,
            );

            // nftReceipt
            expect(await env.nftReceipt.ownerOf(tokenId)).to.equal(env.alice);
            expect(await env.nftReceipt.ownerOf(newTokenId)).to.equal(
                env.alice,
            );
        });

        describe("Reverts", () => {
            it("In case non-allowed duration", async () => {
                const env = await loadFixture(prepareEnvWithStakes);
                const tokenId = 1;
                const newLockDuration = 3 * DAY_SEC;
                const newLockAmount = env.aliceBalance / 2n;

                await expect(
                    env.stakingContract
                        .connect(env.alice)
                        [
                            "relock(uint256,uint256,uint256)"
                        ](tokenId, newLockDuration, newLockAmount),
                )
                    .revertedWithCustomError(
                        env.stakingContract,
                        "NotAllowedDuration",
                    )
                    .withArgs(newLockDuration);
            });

            it("In case non-allowed amount", async () => {
                const env = await loadFixture(prepareEnvWithStakes);
                await time.setNextBlockTimestamp(env.aliceStake0.lockupEndTime);

                const newMinStakeAmount = WeiPerEther * 100n;
                await env.stakingContract
                    .connect(env.managerAdmin)
                    .setMinStakeAmount(newMinStakeAmount);

                const tokenId = 1;
                const newLockDuration = 30 * DAY_SEC;
                const newLockAmount = newMinStakeAmount - 1n;

                await expect(
                    env.stakingContract
                        .connect(env.alice)
                        [
                            "relock(uint256,uint256,uint256)"
                        ](tokenId, newLockDuration, newLockAmount),
                )
                    .revertedWithCustomError(
                        env.stakingContract,
                        "NotAllowedAmount",
                    )
                    .withArgs(newLockAmount);

                await expect(
                    env.stakingContract
                        .connect(env.alice)
                        [
                            "relock(uint256,uint256,uint256)"
                        ](tokenId, newLockDuration, 0),
                )
                    .revertedWithCustomError(
                        env.stakingContract,
                        "NotAllowedAmount",
                    )
                    .withArgs(0);
            });

            it("In case of not stake owner", async () => {
                const env = await loadFixture(prepareEnvWithStakes);
                await time.setNextBlockTimestamp(env.aliceStake0.lockupEndTime);

                const tokenId = 1;
                const newLockDuration = 30 * DAY_SEC;
                const newLockAmount = env.aliceBalance / 2n;

                await expect(
                    env.stakingContract
                        .connect(env.bob)
                        [
                            "relock(uint256,uint256,uint256)"
                        ](tokenId, newLockDuration, newLockAmount),
                )
                    .revertedWithCustomError(
                        env.stakingContract,
                        "NotStakeOwner",
                    )
                    .withArgs(tokenId);
            });

            it("In case of too early for relock", async () => {
                const env = await loadFixture(prepareEnvWithStakes);
                await time.setNextBlockTimestamp(
                    env.aliceStake0.lockupEndTime - 1000,
                );

                const tokenId = 1;
                const newLockDuration = 90 * DAY_SEC;
                const newLockAmount = env.aliceBalance / 2n;

                await expect(
                    env.stakingContract
                        .connect(env.alice)
                        [
                            "relock(uint256,uint256,uint256)"
                        ](tokenId, newLockDuration, newLockAmount),
                )
                    .revertedWithCustomError(
                        env.stakingContract,
                        "TooEarlyForRelock",
                    )
                    .withArgs();
            });

            it("In case of already unstaked", async () => {
                const env = await loadFixture(prepareEnvWithStakes);
                await time.setNextBlockTimestamp(env.aliceStake0.lockupEndTime);

                const tokenId = 1;
                const newLockDuration = 30 * DAY_SEC;
                const newLockAmount = env.aliceBalance / 2n;

                await env.stakingContract
                    .connect(env.alice)
                    ["unstake(uint256)"](tokenId);

                await expect(
                    env.stakingContract
                        .connect(env.alice)
                        [
                            "relock(uint256,uint256,uint256)"
                        ](tokenId, newLockDuration, newLockAmount),
                )
                    .revertedWithCustomError(
                        env.stakingContract,
                        "AlreadyUnstaked",
                    )
                    .withArgs();
            });

            it("In case paused contract", async () => {
                const env = await loadFixture(prepareEnvWithStakes);
                await time.setNextBlockTimestamp(env.aliceStake0.lockupEndTime);

                await env.stakingContract.connect(env.pauserAdmin).pause();

                const tokenId = 1;
                const newLockDuration = 30 * DAY_SEC;
                const newLockAmount = env.aliceBalance / 2n;

                await expect(
                    env.stakingContract
                        .connect(env.alice)
                        [
                            "relock(uint256,uint256,uint256)"
                        ](tokenId, newLockDuration, newLockAmount),
                ).revertedWithCustomError(env.stakingContract, "EnforcedPause");
            });
        });
    });

    describe("{relock} 'full' function", () => {
        it("Relocks for allowed duration of 30 days", async () => {
            const env = await loadFixture(prepareEnvWithStakes);
            const newTokenId = (await env.stakingContract.lastId()) + 1n;

            const stakeInfo = await env.stakingContract.stakeInfo(1);
            const nextTime = env.aliceStake0.lockupEndTime + 1000;
            await time.setNextBlockTimestamp(nextTime);

            const tokenId = 1;
            const newLockDuration = 90 * DAY_SEC;

            const tx = env.stakingContract
                .connect(env.alice)
                ["relock(uint256,uint256)"](tokenId, newLockDuration);

            await expect(tx).to.changeTokenBalances(
                env.token,
                [env.alice, env.stakingContract],
                [0, 0],
            );

            await expect(tx)
                .emit(env.stakingContract, "Relock")
                .withArgs(env.alice.address, tokenId, 0);

            await expect(tx)
                .emit(env.stakingContract, "Stake")
                .withArgs(
                    env.alice.address,
                    newTokenId,
                    stakeInfo.amount,
                    nextTime,
                    nextTime + newLockDuration,
                );

            (await tx).wait();

            const stakeInfo0 = await env.stakingContract.stakeInfo(tokenId);
            expect(stakeInfo0.amount).to.equal(0);
            expect(stakeInfo0.startTime).to.equal(0);
            expect(stakeInfo0.lockupEndTime).to.equal(0);
            expect(stakeInfo0.withdrawAllowedTime).to.equal(0);

            const stakeInfo1 = await env.stakingContract.stakeInfo(newTokenId);
            expect(stakeInfo1.amount).to.equal(stakeInfo.amount);
            expect(stakeInfo1.startTime).to.equal(nextTime);
            expect(stakeInfo1.lockupEndTime).to.equal(
                nextTime + newLockDuration,
            );
            expect(stakeInfo1.withdrawAllowedTime).to.equal(0);

            expect(await env.stakingContract.totalUserStaked(env.alice));

            // nftReceipt
            await expect(env.nftReceipt.ownerOf(tokenId))
                .to.be.revertedWithCustomError(
                    env.nftReceipt,
                    "ERC721NonexistentToken",
                )
                .withArgs(tokenId);
            expect(await env.nftReceipt.ownerOf(newTokenId)).to.equal(
                env.alice,
            );
        });

        describe("Reverts", () => {
            it("In case of non-allowed duration", async () => {
                const env = await loadFixture(prepareEnvWithStakes);
                const newLockDuration = 3 * DAY_SEC;

                const stakeInfo = await env.stakingContract.stakeInfo(1);
                const nextTime = env.aliceStake0.lockupEndTime + 1000;
                await time.setNextBlockTimestamp(nextTime);

                await expect(
                    env.stakingContract
                        .connect(env.alice)
                        [
                            "relock(uint256,uint256)"
                        ](1, newLockDuration),
                )
                    .revertedWithCustomError(
                        env.stakingContract,
                        "NotAllowedDuration",
                    )
                    .withArgs(newLockDuration);
            });

            it("In case of non-stake owner", async () => {
                const env = await loadFixture(prepareEnvWithStakes);
                const newLockDuration = 30 * DAY_SEC;

                const stakeInfo = await env.stakingContract.stakeInfo(1);
                const nextTime = env.aliceStake0.lockupEndTime + 1000;
                await time.setNextBlockTimestamp(nextTime);

                await expect(
                    env.stakingContract
                        .connect(env.bob)
                        [
                            "relock(uint256,uint256)"
                        ](1, newLockDuration),
                )
                    .revertedWithCustomError(
                        env.stakingContract,
                        "NotStakeOwner",
                    )
                    .withArgs(1);
            });

            it("in case already unstaked", async () => {
                const env = await loadFixture(prepareEnvWithStakes);
                const newLockDuration = 30 * DAY_SEC;

                const stakeInfo = await env.stakingContract.stakeInfo(1);
                const nextTime = env.aliceStake0.lockupEndTime + 1000;
                await time.setNextBlockTimestamp(nextTime);

                await env.stakingContract
                    .connect(env.alice)
                    ["unstake(uint256)"](1);

                await expect(
                    env.stakingContract
                        .connect(env.alice)
                        [
                            "relock(uint256,uint256)"
                        ](1, newLockDuration),
                )
                    .revertedWithCustomError(
                        env.stakingContract,
                        "AlreadyUnstaked",
                    )
                    .withArgs();
            });

            it("In case of too early for relock", async () => {
                const env = await loadFixture(prepareEnvWithStakes);
                const newLockDuration = 90 * DAY_SEC;

                const stakeInfo = await env.stakingContract.stakeInfo(1);
                const nextTime = env.aliceStake0.lockupEndTime - 1000;
                await time.setNextBlockTimestamp(nextTime);

                await expect(
                    env.stakingContract
                        .connect(env.alice)
                        [
                            "relock(uint256,uint256)"
                        ](1, newLockDuration),
                )
                    .revertedWithCustomError(
                        env.stakingContract,
                        "TooEarlyForRelock",
                    )
                    .withArgs();
            });

            it("In case the contract is paused", async () => {
                const env = await loadFixture(prepareEnvWithStakes);
                const newLockDuration = 30 * DAY_SEC;

                await env.stakingContract.connect(env.pauserAdmin).pause();

                const stakeInfo = await env.stakingContract.stakeInfo(1);
                const nextTime = env.aliceStake0.lockupEndTime + 1000;
                await time.setNextBlockTimestamp(nextTime);

                await expect(
                    env.stakingContract
                        .connect(env.alice)
                        [
                            "relock(uint256,uint256)"
                        ](1, newLockDuration),
                ).revertedWithCustomError(env.stakingContract, "EnforcedPause");
            });
        });
    });

    describe("{unstake} 'partial' function", () => {
        it("Unstake for allowed duration of 30 days", async () => {
            const env = await loadFixture(prepareEnvWithStakes);
            const lastId = await env.stakingContract.lastId();
            const newTokenId = lastId + 1n;

            const withdrawCooldown =
                await env.stakingContract.withdrawCooldown();

            await time.setNextBlockTimestamp(env.aliceStake0.lockupEndTime);
            const tokenId = 1;
            const amountToUnstake = env.aliceStake0.amount - WeiPerEther * 100n;
            const amountRemaining = env.aliceStake0.amount - amountToUnstake;
            const tx = env.stakingContract
                .connect(env.alice)
                ["unstake(uint256,uint256)"](tokenId, amountToUnstake);

            await expect(tx).to.changeTokenBalances(
                env.token,
                [env.alice, env.stakingContract],
                [0, 0],
            );

            await expect(tx)
                .emit(env.stakingContract, "Unstake")
                .withArgs(env.alice, tokenId, amountToUnstake);

            await expect(tx)
                .emit(env.stakingContract, "Stake")
                .withArgs(
                    env.alice,
                    newTokenId,
                    amountRemaining,
                    env.aliceStake0.startTime,
                    env.aliceStake0.lockupEndTime,
                );

            (await tx).wait();

            expect(await env.stakingContract.lastId()).to.equal(newTokenId);

            const stakeInfoOld = await env.stakingContract.stakeInfo(tokenId);
            expect(stakeInfoOld.amount).to.equal(amountToUnstake);
            expect(stakeInfoOld.startTime).to.equal(env.aliceStake0.startTime);
            expect(stakeInfoOld.lockupEndTime).to.equal(
                env.aliceStake0.lockupEndTime,
            );
            expect(stakeInfoOld.withdrawAllowedTime).to.equal(
                BigInt(env.aliceStake0.lockupEndTime) + withdrawCooldown,
            );

            const stakeInfoNew =
                await env.stakingContract.stakeInfo(newTokenId);
            expect(stakeInfoNew.amount).to.equal(amountRemaining);
            expect(stakeInfoNew.startTime).to.equal(env.aliceStake0.startTime);
            expect(stakeInfoNew.lockupEndTime).to.equal(
                env.aliceStake0.lockupEndTime,
            );
            expect(stakeInfoNew.withdrawAllowedTime).to.equal(0);

            expect(
                await env.stakingContract.totalUserStaked(env.alice),
            ).to.equal(env.aliceBalance);
            expect(stakeInfoOld.amount + stakeInfoNew.amount).to.equal(
                env.aliceBalance,
            );
            // nftReceipt
            expect(await env.nftReceipt.ownerOf(tokenId)).to.equal(env.alice);
            expect(await env.nftReceipt.ownerOf(newTokenId)).to.equal(
                env.alice,
            );
        });

        describe("Reverts", () => {
            it("In case of too early for unstake", async () => {
                const env = await loadFixture(prepareEnvWithStakes);
                await time.setNextBlockTimestamp(
                    env.aliceStake0.lockupEndTime - 1000,
                );

                const tokenId = 1;
                const amountToUnstake = env.aliceStake0.amount / 2n;
                await expect(
                    env.stakingContract
                        .connect(env.alice)
                        ["unstake(uint256,uint256)"](tokenId, amountToUnstake),
                ).revertedWithCustomError(
                    env.stakingContract,
                    "TooEarlyForUnstake",
                );
            });

            it("In case not stake owner", async () => {
                const env = await loadFixture(prepareEnvWithStakes);
                await time.increaseTo(env.aliceStake0.lockupEndTime);

                const tokenId = 1;
                const amountToUnstake = env.aliceStake0.amount / 2n;

                await expect(
                    env.stakingContract
                        .connect(env.bob)
                        ["unstake(uint256,uint256)"](tokenId, amountToUnstake),
                )
                    .revertedWithCustomError(
                        env.stakingContract,
                        "NotStakeOwner",
                    )
                    .withArgs(tokenId);

                await expect(
                    env.stakingContract
                        .connect(env.carol)
                        ["unstake(uint256,uint256)"](tokenId, amountToUnstake),
                )
                    .revertedWithCustomError(
                        env.stakingContract,
                        "NotStakeOwner",
                    )
                    .withArgs(tokenId);
            });

            it("In case already unstaked", async () => {
                const env = await loadFixture(prepareEnvWithStakes);
                await time.setNextBlockTimestamp(env.aliceStake0.lockupEndTime);

                const tokenId = 1;
                const amountToUnstake = env.aliceStake0.amount - 1n;
                await env.stakingContract
                    .connect(env.alice)
                    ["unstake(uint256)"](tokenId);

                await expect(
                    env.stakingContract
                        .connect(env.alice)
                        ["unstake(uint256,uint256)"](tokenId, amountToUnstake),
                ).revertedWithCustomError(
                    env.stakingContract,
                    "AlreadyUnstaked",
                );
            });

            it("In case amount equals stake amount", async () => {
                const env = await loadFixture(prepareEnvWithStakes);
                await time.setNextBlockTimestamp(env.aliceStake0.lockupEndTime);

                const tokenId = 1;
                const amountToUnstake = env.aliceStake0.amount;
                await expect(
                    env.stakingContract
                        .connect(env.alice)
                        ["unstake(uint256,uint256)"](tokenId, amountToUnstake),
                ).revertedWithCustomError(
                    env.stakingContract,
                    "NonPartialUnstake",
                );
            });

            it("In case amount exceeds stake amount (with Panic)", async () => {
                const env = await loadFixture(prepareEnvWithStakes);
                await time.setNextBlockTimestamp(env.aliceStake0.lockupEndTime);

                const tokenId = 1;
                const amountToUnstake = env.aliceStake0.amount + 1n;
                await expect(
                    env.stakingContract
                        .connect(env.alice)
                        ["unstake(uint256,uint256)"](tokenId, amountToUnstake),
                ).revertedWithPanic();
            });

            it("When paused", async () => {
                const env = await loadFixture(prepareEnvWithStakes);

                await env.stakingContract.connect(env.pauserAdmin).pause();
                await time.setNextBlockTimestamp(env.aliceStake0.lockupEndTime);

                const tokenId = 1;
                const amountToUnstake = env.aliceStake0.amount - 1n;

                await expect(
                    env.stakingContract
                        .connect(env.bob)
                        ["unstake(uint256,uint256)"](tokenId, amountToUnstake),
                ).revertedWithCustomError(env.stakingContract, "EnforcedPause");
            });
        });
    });

    describe("{unstake} 'full' function", () => {
        it("Unstake entire stake", async () => {
            const env = await loadFixture(prepareEnvWithStakes);
            const withdrawCooldown =
                await env.stakingContract.withdrawCooldown();

            await time.setNextBlockTimestamp(env.aliceStake0.lockupEndTime);

            const tokenId = 1;
            const tx = env.stakingContract
                .connect(env.alice)
                ["unstake(uint256)"](tokenId);

            await expect(tx)
                .emit(env.stakingContract, "Unstake")
                .withArgs(env.alice, tokenId, env.aliceStake0.amount);
            (await tx).wait();

            const stakeInfo = await env.stakingContract.stakeInfo(tokenId);
            expect(stakeInfo.amount).to.equal(env.aliceStake0.amount);
            expect(stakeInfo.startTime).to.equal(env.aliceStake0.startTime);
            expect(stakeInfo.lockupEndTime).to.equal(
                env.aliceStake0.lockupEndTime,
            );
            expect(stakeInfo.withdrawAllowedTime).to.equal(
                BigInt(env.aliceStake0.lockupEndTime) + withdrawCooldown,
            );

            expect(
                await env.stakingContract.totalUserStaked(env.alice),
            ).to.equal(env.aliceStake0.amount);
        });

        describe("Reverts", () => {
            it("In case of too early for unstake", async () => {
                const env = await loadFixture(prepareEnvWithStakes);
                await time.setNextBlockTimestamp(
                    env.aliceStake0.lockupEndTime - 1000,
                );

                const tokenId = 1;
                await expect(
                    env.stakingContract
                        .connect(env.alice)
                        ["unstake(uint256)"](tokenId),
                ).revertedWithCustomError(
                    env.stakingContract,
                    "TooEarlyForUnstake",
                );
            });

            it("In case not stake owner", async () => {
                const env = await loadFixture(prepareEnvWithStakes);
                await time.increaseTo(env.aliceStake0.lockupEndTime);

                const tokenId = 1;
                // bob for alice's stake
                await expect(
                    env.stakingContract
                        .connect(env.bob)
                        ["unstake(uint256)"](tokenId),
                )
                    .revertedWithCustomError(
                        env.stakingContract,
                        "NotStakeOwner",
                    )
                    .withArgs(tokenId);

                // carol for alice's stake
                await expect(
                    env.stakingContract
                        .connect(env.carol)
                        ["unstake(uint256)"](tokenId),
                )
                    .revertedWithCustomError(
                        env.stakingContract,
                        "NotStakeOwner",
                    )
                    .withArgs(tokenId);

                await time.increaseTo(env.bobStake1.lockupEndTime);

                // carol for bob's stake
                const bobTokenId = 3;
                await expect(
                    env.stakingContract
                        .connect(env.carol)
                        ["unstake(uint256)"](bobTokenId),
                )
                    .revertedWithCustomError(
                        env.stakingContract,
                        "NotStakeOwner",
                    )
                    .withArgs(bobTokenId);
            });

            it("When already unstaked (can't unstake again)", async () => {
                const env = await loadFixture(prepareEnvWithStakes);

                const withdrawCooldown =
                    await env.stakingContract.withdrawCooldown();
                const tokenId = 1;

                await time.setNextBlockTimestamp(env.aliceStake0.lockupEndTime);
                await env.stakingContract
                    .connect(env.alice)
                    ["unstake(uint256)"](tokenId);

                await time.setNextBlockTimestamp(
                    BigInt(env.aliceStake0.lockupEndTime) + withdrawCooldown,
                );

                // alice unstakes again
                await expect(
                    env.stakingContract
                        .connect(env.alice)
                        ["unstake(uint256)"](tokenId),
                ).revertedWithCustomError(
                    env.stakingContract,
                    "AlreadyUnstaked",
                );
            });

            it("When paused", async () => {
                const env = await loadFixture(prepareEnvWithStakes);

                await env.stakingContract.connect(env.pauserAdmin).pause();
                await time.setNextBlockTimestamp(env.aliceStake0.lockupEndTime);

                const tokenId = 1;

                await expect(
                    env.stakingContract
                        .connect(env.bob)
                        ["unstake(uint256)"](tokenId),
                ).revertedWithCustomError(env.stakingContract, "EnforcedPause");
            });
        });
    });

    describe("{withdraw} function", () => {
        it("Withdraws stake", async () => {
            const env = await loadFixture(prepareEnvWithStakes);
            const withdrawCooldown =
                await env.stakingContract.withdrawCooldown();
            const tokenId = 1;

            await time.setNextBlockTimestamp(env.aliceStake0.lockupEndTime);
            await env.stakingContract
                .connect(env.alice)
                ["unstake(uint256)"](tokenId);

            await time.setNextBlockTimestamp(
                BigInt(env.aliceStake0.lockupEndTime) + withdrawCooldown,
            );

            const tx = env.stakingContract.connect(env.alice).withdraw(tokenId);

            await expect(tx).to.changeTokenBalances(
                env.token,
                [env.alice, env.stakingContract],
                [env.aliceBalance, -env.aliceBalance],
            );

            await expect(tx)
                .emit(env.stakingContract, "Withdraw")
                .withArgs(env.alice, tokenId, env.aliceBalance);
            (await tx).wait();

            expect(
                await env.stakingContract.totalUserStaked(env.alice),
            ).to.equal(0);
        });

        describe("Reverts", () => {
            it("In case of non-stake owner", async () => {
                const env = await loadFixture(prepareEnvWithUnstakedStakes);
                const withdrawTime = (await env.stakingContract.stakeInfo(1))
                    .withdrawAllowedTime;
                await time.setNextBlockTimestamp(withdrawTime);

                const tokenId = 1;
                await expect(
                    env.stakingContract.connect(env.bob).withdraw(tokenId),
                )
                    .revertedWithCustomError(
                        env.stakingContract,
                        "NotStakeOwner",
                    )
                    .withArgs(tokenId);
            });

            it("In case of not unstaked yet", async () => {
                const env = await loadFixture(prepareEnvWithUnstakedStakes);

                const tokenId = 1;
                await expect(
                    env.stakingContract.connect(env.alice).withdraw(tokenId),
                )
                    .revertedWithCustomError(
                        env.stakingContract,
                        "NotUnstakedYet",
                    )
                    .withArgs();
            });

            it("In case stake already withdrawn", async () => {
                const env = await loadFixture(prepareEnvWithUnstakedStakes);
                const withdrawTime = (await env.stakingContract.stakeInfo(1))
                    .withdrawAllowedTime;
                await time.setNextBlockTimestamp(withdrawTime);

                const tokenId = 1;
                await env.stakingContract.connect(env.alice).withdraw(tokenId);

                await expect(
                    env.stakingContract.connect(env.alice).withdraw(tokenId),
                )
                    .revertedWithCustomError(
                        env.stakingContract,
                        "NotStakeOwner",
                    )
                    .withArgs(tokenId);
            });
        });
    });

    describe("{setAllowedDuration} function", () => {
        it("Sets new allowed duration", async () => {
            const env = await loadFixture(prepareEnvWithGrantedRoles);
            const duration = 85 * DAY_SEC;
            const allowed = true;

            const tx = env.stakingContract
                .connect(env.managerAdmin)
                .setAllowedDuration(duration, allowed);

            await expect(tx)
                .emit(env.stakingContract, "UpdateAllowedDuration")
                .withArgs(duration, allowed);
            (await tx).wait();

            expect(
                await env.stakingContract.allowedDurations(duration),
            ).to.equal(allowed);
        });

        it("Disables existing allowed duration", async () => {
            const env = await loadFixture(prepareEnvWithGrantedRoles);
            const duration = 60 * DAY_SEC;

            expect(
                await env.stakingContract.allowedDurations(duration),
            ).to.equal(true);

            const allowed = false;

            const tx = env.stakingContract
                .connect(env.managerAdmin)
                .setAllowedDuration(duration, allowed);

            await expect(tx)
                .emit(env.stakingContract, "UpdateAllowedDuration")
                .withArgs(duration, allowed);
            (await tx).wait();

            expect(
                await env.stakingContract.allowedDurations(duration),
            ).to.equal(allowed);
        });

        describe("Reverts", () => {
            it("In case of non-admin", async () => {
                const env = await loadFixture(prepareEnvWithGrantedRoles);
                const duration = 60 * DAY_SEC;
                const allowed = false;
                const managerRole =
                    await env.stakingContract.CONTRACT_MANAGER_ROLE();

                await expect(
                    env.stakingContract
                        .connect(env.alice)
                        .setAllowedDuration(duration, allowed),
                )
                    .revertedWithCustomError(
                        env.stakingContract,
                        "AccessControlUnauthorizedAccount",
                    )
                    .withArgs(env.alice, managerRole);
            });
        });
    });

    describe("{setMinStakeAmount} function", () => {
        it("Sets new min stake amount", async () => {
            const env = await loadFixture(prepareEnvWithGrantedRoles);
            const newMinStakeAmount = WeiPerEther * 100n;

            const tx = env.stakingContract
                .connect(env.managerAdmin)
                .setMinStakeAmount(newMinStakeAmount);

            await expect(tx)
                .emit(env.stakingContract, "UpdateMinStakeAmount")
                .withArgs(newMinStakeAmount);
            (await tx).wait();

            expect(await env.stakingContract.minStakeAmount()).to.equal(
                newMinStakeAmount,
            );

            await env.token
                .connect(env.alice)
                .approve(env.stakingContract, env.aliceBalance);

            await expect(
                env.stakingContract
                    .connect(env.alice)
                    .stake(newMinStakeAmount - 1n, 30 * DAY_SEC),
            ).revertedWithCustomError(env.stakingContract, "NotAllowedAmount");
        });

        describe("Reverts", () => {
            it("In case of non-admin", async () => {
                const env = await loadFixture(prepareEnvWithGrantedRoles);
                const newMinStakeAmount = WeiPerEther * 100n;
                const managerRole =
                    await env.stakingContract.CONTRACT_MANAGER_ROLE();

                await expect(
                    env.stakingContract
                        .connect(env.alice)
                        .setMinStakeAmount(newMinStakeAmount),
                )
                    .revertedWithCustomError(
                        env.stakingContract,
                        "AccessControlUnauthorizedAccount",
                    )
                    .withArgs(env.alice, managerRole);
            });
        });
    });

    describe("{setWithdrawCooldown} function", () => {
        it("Sets new withdraw cooldown period", async () => {
            const env = await loadFixture(prepareEnvWithGrantedRoles);
            const newWithdrawCooldown = 65 * DAY_SEC;

            const tx = env.stakingContract
                .connect(env.managerAdmin)
                .setWithdrawCooldown(newWithdrawCooldown);

            await expect(tx)
                .emit(env.stakingContract, "UpdateWithdrawCooldown")
                .withArgs(newWithdrawCooldown);
            (await tx).wait();

            expect(await env.stakingContract.withdrawCooldown()).to.equal(
                newWithdrawCooldown,
            );

            await env.token
                .connect(env.alice)
                .approve(env.stakingContract, env.aliceBalance);

            const currentTime = await time.latest();
            const stakeStartTime = currentTime + 10;
            const stakeDuration = 30 * DAY_SEC;
            await time.setNextBlockTimestamp(stakeStartTime);
            await env.stakingContract
                .connect(env.alice)
                .stake(env.aliceBalance, stakeDuration);

            const tokenId = 1;
            await time.setNextBlockTimestamp(stakeStartTime + stakeDuration);
            await env.stakingContract
                .connect(env.alice)
                ["unstake(uint256)"](tokenId);

            const stakeInfo = await env.stakingContract.stakeInfo(tokenId);
            expect(stakeInfo.withdrawAllowedTime).to.equal(
                stakeStartTime + stakeDuration + newWithdrawCooldown,
            );
        });

        describe("Reverts", () => {
            it("In case of non-admin", async () => {
                const env = await loadFixture(prepareEnvWithGrantedRoles);
                const newWithdrawCooldown = 65 * DAY_SEC;
                const managerRole =
                    await env.stakingContract.CONTRACT_MANAGER_ROLE();

                await expect(
                    env.stakingContract
                        .connect(env.alice)
                        .setWithdrawCooldown(newWithdrawCooldown),
                )
                    .revertedWithCustomError(
                        env.stakingContract,
                        "AccessControlUnauthorizedAccount",
                    )
                    .withArgs(env.alice, managerRole);
            });

            it("In case of too high withdraw cooldown", async () => {
                const env = await loadFixture(prepareEnvWithGrantedRoles);
                const maxWithdrawCooldown =
                    await env.stakingContract.MAX_WITHDRAW_COOLDOWN();
                const newWithdrawCooldown = maxWithdrawCooldown + 1n;

                await expect(
                    env.stakingContract
                        .connect(env.managerAdmin)
                        .setWithdrawCooldown(newWithdrawCooldown),
                )
                    .revertedWithCustomError(
                        env.stakingContract,
                        "MaxWithdrawCooldown",
                    )
                    .withArgs();
            });
        });
    });

    describe("{emergencyUnlock} function", () => {
        it("Unlocks all stakes and terminates staking functionality", async () => {
            const env = await loadFixture(prepareEnvWithStakes);
            expect(await env.stakingContract.unlockedAll()).to.equal(false);

            await env.stakingContract.connect(env.pauserAdmin).pause();
            const unlockTx = env.stakingContract
                .connect(env.emergencyAdmin)
                .emergencyUnlock();
            await expect(unlockTx).to.emit(
                env.stakingContract,
                "EmergencyUnlock",
            );
            (await unlockTx).wait();

            expect(await env.stakingContract.unlockedAll()).to.equal(true);

            // alice can withdraw
            let tokenId = 1;
            let tx = env.stakingContract.connect(env.alice).withdraw(tokenId);

            await expect(tx).to.changeTokenBalances(
                env.token,
                [env.alice, env.stakingContract],
                [env.aliceBalance, -env.aliceBalance],
            );

            await expect(tx)
                .emit(env.stakingContract, "Withdraw")
                .withArgs(env.alice, tokenId, env.aliceBalance);
            (await tx).wait();

            // bob can withdraw
            tokenId = 2;
            await env.stakingContract.connect(env.bob).withdraw(tokenId);
            tokenId = 3;
            await env.stakingContract.connect(env.bob).withdraw(tokenId);

            // carol can withdraw
            tokenId = 4;
            await env.stakingContract.connect(env.carol).withdraw(tokenId);
            tokenId = 5;
            await env.stakingContract.connect(env.carol).withdraw(tokenId);
            tokenId = 6;
            await env.stakingContract.connect(env.carol).withdraw(tokenId);

            expect(await env.stakingContract.totalStaked()).to.equal(0);
            expect(
                await env.stakingContract.totalUserStaked(env.alice),
            ).to.equal(0);
            expect(await env.stakingContract.totalUserStaked(env.bob)).to.equal(
                0,
            );
            expect(
                await env.stakingContract.totalUserStaked(env.carol),
            ).to.equal(0);

            expect(await env.token.balanceOf(env.stakingContract)).to.equal(0);
            expect(await env.token.balanceOf(env.alice)).to.equal(
                env.aliceBalance,
            );
            expect(await env.token.balanceOf(env.bob)).to.equal(env.bobBalance);
            expect(await env.token.balanceOf(env.carol)).to.equal(
                env.carolBalance,
            );
        });

        describe("Reverts", () => {
            it("In case of non-emergency admin", async () => {
                const env = await loadFixture(prepareEnvWithGrantedRoles);
                const emergencyRole =
                    await env.stakingContract.EMERGENCY_MANAGER_ROLE();

                await env.stakingContract.connect(env.pauserAdmin).pause();
                await expect(
                    env.stakingContract.connect(env.alice).emergencyUnlock(),
                )
                    .revertedWithCustomError(
                        env.stakingContract,
                        "AccessControlUnauthorizedAccount",
                    )
                    .withArgs(env.alice, emergencyRole);
            });

            it("In case of non-paused contract", async () => {
                const env = await loadFixture(prepareEnvWithGrantedRoles);

                await expect(
                    env.stakingContract
                        .connect(env.emergencyAdmin)
                        .emergencyUnlock(),
                )
                    .revertedWithCustomError(
                        env.stakingContract,
                        "ExpectedPause",
                    )
                    .withArgs();
            });
        });
    });

    describe("{pause} function", () => {
        it("Pauses staking contract", async () => {
            const env = await loadFixture(prepareEnvWithStakes);
            expect(await env.stakingContract.paused()).to.equal(false);

            await env.stakingContract.connect(env.pauserAdmin).pause();
            expect(await env.stakingContract.paused()).to.equal(true);
        });

        describe("Reverts", () => {
            it("In case of non-pauser", async () => {
                const env = await loadFixture(prepareEnvWithStakes);
                await expect(env.stakingContract.connect(env.alice).pause())
                    .revertedWithCustomError(
                        env.stakingContract,
                        "AccessControlUnauthorizedAccount",
                    )
                    .withArgs(
                        env.alice,
                        await env.stakingContract.PAUSER_ROLE(),
                    );
            });
        });
    });

    describe("{unpause} function", () => {
        it("Unpauses staking contract", async () => {
            const env = await loadFixture(prepareEnvWithStakes);
            expect(await env.stakingContract.paused()).to.equal(false);

            await env.stakingContract.connect(env.pauserAdmin).pause();
            await env.stakingContract.connect(env.unpauserAdmin).unpause();
            expect(await env.stakingContract.paused()).to.equal(false);
        });

        describe("Reverts", () => {
            it("In case of non-pauser", async () => {
                const env = await loadFixture(prepareEnvWithGrantedRoles);
                await expect(env.stakingContract.connect(env.alice).unpause())
                    .revertedWithCustomError(
                        env.stakingContract,
                        "AccessControlUnauthorizedAccount",
                    )
                    .withArgs(
                        env.alice,
                        await env.stakingContract.UNPAUSER_ROLE(),
                    );
            });

            it("In case of contract unlocked", async () => {
                const env = await loadFixture(prepareEnvWithGrantedRoles);
                await env.stakingContract.connect(env.pauserAdmin).pause();
                await env.stakingContract
                    .connect(env.emergencyAdmin)
                    .emergencyUnlock();

                await expect(
                    env.stakingContract.connect(env.unpauserAdmin).unpause(),
                )
                    .revertedWithCustomError(env.stakingContract, "Unlocked")
                    .withArgs();
            });
        });
    });

    describe("{getUserStakes} function", () => {
        it("Returns stakes for user", async () => {
            const env = await loadFixture(prepareEnvWithStakes);

            const aliceStakes = await env.stakingContract.getUserStakes(
                env.alice,
            );
            expect(aliceStakes.length).to.equal(1);

            expect(aliceStakes[0].tokenId).to.equal(1);
            expect(aliceStakes[0].amount).to.equal(env.aliceStake0.amount);
            expect(aliceStakes[0].startTime).to.equal(
                env.aliceStake0.startTime,
            );
            expect(aliceStakes[0].lockupEndTime).to.equal(
                env.aliceStake0.lockupEndTime,
            );
            expect(aliceStakes[0].withdrawAllowedTime).to.equal(0);

            const bobStakes = await env.stakingContract.getUserStakes(env.bob);
            expect(bobStakes.length).to.equal(2);

            expect(bobStakes[0].tokenId).to.equal(2);
            expect(bobStakes[1].tokenId).to.equal(3);

            const carolStakes = await env.stakingContract.getUserStakes(
                env.carol,
            );
            expect(carolStakes.length).to.equal(3);

            expect(carolStakes[0].tokenId).to.equal(4);
            expect(carolStakes[1].tokenId).to.equal(5);
            expect(carolStakes[2].tokenId).to.equal(6);
        });
    });

    describe("Multicall", async () => {
        it("Executes multiple calls in one transaction", async () => {
            const env = await loadFixture(prepareEnvWithGrantedRoles);
            await env.token
                .connect(env.alice)
                .approve(env.stakingContract, env.aliceBalance);

            const aliceStakeAmount0 = WeiPerEther * 100n;
            const aliceStakeDuration0 = 30 * DAY_SEC;
            const aliceStakeAmount1 = WeiPerEther * 200n;
            const aliceStakeDuration1 = 60 * DAY_SEC;

            const currentTime = await time.latest();
            const stakeStartTime = currentTime + 10;
            await time.setNextBlockTimestamp(stakeStartTime);

            const tx = env.stakingContract
                .connect(env.alice)
                .multicall([
                    env.stakingContract.interface.encodeFunctionData("stake", [
                        aliceStakeAmount0,
                        aliceStakeDuration0,
                    ]),
                    env.stakingContract.interface.encodeFunctionData("stake", [
                        aliceStakeAmount1,
                        aliceStakeDuration1,
                    ]),
                ]);

            await expect(tx)
                .to.emit(env.stakingContract, "Stake")
                .withArgs(
                    env.alice,
                    1,
                    aliceStakeAmount0,
                    stakeStartTime,
                    stakeStartTime + aliceStakeDuration0,
                )
                .to.emit(env.stakingContract, "Stake")
                .withArgs(
                    env.alice,
                    2,
                    aliceStakeAmount1,
                    stakeStartTime,
                    stakeStartTime + aliceStakeDuration1,
                );

            (await tx).wait();

            expect(await env.stakingContract.lastId()).to.equal(2);

            const aliceStakes = await env.stakingContract.getUserStakes(
                env.alice,
            );
            expect(aliceStakes.length).to.equal(2);

            expect(aliceStakes[0].amount).to.equal(aliceStakeAmount0);
            expect(aliceStakes[1].amount).to.equal(aliceStakeAmount1);

            // nftReceipt
            expect(await env.nftReceipt.ownerOf(1)).to.equal(env.alice);
            expect(await env.nftReceipt.ownerOf(2)).to.equal(env.alice);
        });
    });
});

async function prepareEnvWithUnstakedStakes() {
    const env = await loadFixture(prepareEnvWithStakes);
    await time.setNextBlockTimestamp(env.aliceStake0.lockupEndTime);
    await env.stakingContract.connect(env.alice)["unstake(uint256)"](1);

    await time.setNextBlockTimestamp(env.bobStake0.lockupEndTime);
    await env.stakingContract.connect(env.bob)["unstake(uint256)"](2);

    return {
        ...env,
    };
}

async function prepareEnvWithStakes() {
    const env = await loadFixture(prepareEnvWithGrantedRoles);

    await env.token
        .connect(env.alice)
        .approve(env.stakingContract, env.aliceBalance);
    await env.token
        .connect(env.bob)
        .approve(env.stakingContract, env.bobBalance);
    await env.token
        .connect(env.carol)
        .approve(env.stakingContract, env.carolBalance);

    // alice 1 stake for 10k
    const aliceDuration0 = 30 * DAY_SEC;
    const aliceAmount0 = env.aliceBalance;
    const aliceStartTime0 = (await time.latest()) + 130;
    const aliceEndTime0 = aliceStartTime0 + aliceDuration0;
    await time.setNextBlockTimestamp(aliceStartTime0);
    await env.stakingContract
        .connect(env.alice)
        .stake(aliceAmount0, aliceDuration0);

    const aliceStake0 = {
        amount: aliceAmount0,
        startTime: aliceStartTime0,
        lockupEndTime: aliceEndTime0,
        withdrawAllowedTime: 0,
    };

    // bob 2 stakes for 10k
    const bobDuration0 = 30 * DAY_SEC;
    const bobAmount0 = env.bobBalance / 2n;
    const bobStartTime0 = (await time.latest()) + 130;
    const bobEndTime0 = bobStartTime0 + bobDuration0;
    await time.setNextBlockTimestamp(bobStartTime0);
    await env.stakingContract.connect(env.bob).stake(bobAmount0, bobDuration0);
    const bobStake0 = {
        amount: bobAmount0,
        startTime: bobStartTime0,
        lockupEndTime: bobEndTime0,
        withdrawAllowedTime: 0,
    };

    const bobDuration1 = 60 * DAY_SEC;
    const bobAmount1 = env.bobBalance / 2n;
    const bobStartTime1 = (await time.latest()) + 130;
    const bobEndTime1 = bobStartTime1 + bobDuration1;
    await time.setNextBlockTimestamp(bobStartTime1);
    await env.stakingContract.connect(env.bob).stake(bobAmount1, bobDuration1);
    const bobStake1 = {
        amount: bobAmount1,
        startTime: bobStartTime1,
        lockupEndTime: bobEndTime1,
        withdrawAllowedTime: 0,
    };

    // carol 3 stakes for 10k
    const carolDuration0 = 30 * DAY_SEC;
    const carolAmount0 = env.carolBalance / 3n;
    const carolStartTime0 = (await time.latest()) + 130;
    const carolEndTime0 = carolStartTime0 + carolDuration0;
    await time.setNextBlockTimestamp(carolStartTime0);
    await env.stakingContract
        .connect(env.carol)
        .stake(carolAmount0, carolDuration0);
    const carolStake0 = {
        amount: carolAmount0,
        startTime: carolStartTime0,
        lockupEndTime: carolEndTime0,
        withdrawAllowedTime: 0,
    };

    const carolDuration1 = 60 * DAY_SEC;
    const carolAmount1 = env.carolBalance / 3n;
    const carolStartTime1 = (await time.latest()) + 130;
    const carolEndTime1 = carolStartTime1 + carolDuration1;
    await time.setNextBlockTimestamp(carolStartTime1);
    await env.stakingContract
        .connect(env.carol)
        .stake(carolAmount1, carolDuration1);
    const carolStake1 = {
        amount: carolAmount1,
        startTime: carolStartTime1,
        lockupEndTime: carolEndTime1,
        withdrawAllowedTime: 0,
    };

    const carolDuration2 = 90 * DAY_SEC;
    const carolAmount2 = env.carolBalance / 3n;
    const carolStartTime2 = (await time.latest()) + 130;
    const carolEndTime2 = carolStartTime2 + carolDuration2;
    await time.setNextBlockTimestamp(carolStartTime2);
    await env.stakingContract
        .connect(env.carol)
        .stake(carolAmount2, carolDuration2);
    const carolStake2 = {
        amount: carolAmount2,
        startTime: carolStartTime2,
        lockupEndTime: carolEndTime2,
        withdrawAllowedTime: 0,
    };

    return {
        ...env,
        aliceStake0,
        bobStake0,
        bobStake1,
        carolStake0,
        carolStake1,
        carolStake2,
    };
}

async function prepareEnvWithGrantedRoles() {
    const env = await loadFixture(prepareEnv);
    await env.stakingContract
        .connect(env.defaultAdmin)
        .grantRole(
            await env.stakingContract.CONTRACT_MANAGER_ROLE(),
            env.managerAdmin,
        );
    await env.stakingContract
        .connect(env.defaultAdmin)
        .grantRole(
            await env.stakingContract.EMERGENCY_MANAGER_ROLE(),
            env.emergencyAdmin,
        );

    await env.stakingContract
        .connect(env.defaultAdmin)
        .grantRole(await env.stakingContract.PAUSER_ROLE(), env.pauserAdmin);
    await env.stakingContract
        .connect(env.defaultAdmin)
        .grantRole(
            await env.stakingContract.UNPAUSER_ROLE(),
            env.unpauserAdmin,
        );
    return {
        ...env,
    };
}

async function prepareEnv() {
    const env = await loadFixture(prepareEnvWithoutInitialization);

    await env.stakingContract.initialize(
        env.token,
        env.nftReceipt,
        env.defaultAdmin,
    );

    return {
        ...env,
    };
}

async function prepareEnvWithoutInitialization() {
    const [
        deployer,
        defaultAdmin,
        managerAdmin,
        emergencyAdmin,
        pauserAdmin,
        unpauserAdmin,
        alice,
        bob,
        carol,
    ] = await ethers.getSigners();
    const proxyOwner = deployer;

    const stakingFactory = await ethers.getContractFactory("Staking");
    const stakingImplementation = await stakingFactory.deploy();

    const transparentUpgradeableProxyFactory = await ethers.getContractFactory(
        "TransparentUpgradeableProxy",
    );
    const stakingProxy = await transparentUpgradeableProxyFactory.deploy(
        stakingImplementation,
        proxyOwner,
        "0x",
    );
    const stakingContract = await ethers.getContractAt("Staking", stakingProxy);

    const tokenFactory = await ethers.getContractFactory("Token");
    const token = await tokenFactory.deploy();

    const nftReceiptFactory = await ethers.getContractFactory("NftReceiptMock");
    const nftReceipt = await nftReceiptFactory.deploy();

    const aliceBalance = ethers.WeiPerEther * 10000n;
    const bobBalance = ethers.WeiPerEther * 20000n;
    const carolBalance = ethers.WeiPerEther * 30000n;

    await token.mint(alice, aliceBalance);
    await token.mint(bob, bobBalance);
    await token.mint(carol, carolBalance);

    return {
        deployer,
        defaultAdmin,
        managerAdmin,
        emergencyAdmin,
        pauserAdmin,
        unpauserAdmin,

        alice,
        bob,
        carol,
        proxyOwner,
        stakingFactory,
        stakingImplementation,
        stakingProxy,

        token,
        nftReceipt,

        aliceBalance,
        bobBalance,
        carolBalance,

        stakingContract,
    };
}
