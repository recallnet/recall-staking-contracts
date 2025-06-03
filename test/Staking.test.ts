import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { WeiPerEther, ZeroAddress } from "ethers";
import { ethers } from "hardhat";
import { DAY_SEC } from "../constants";

describe("Unit-tests for the Staking contract", () => {
    describe("Deployment", () => {
        it("Deploy staking contract (without initialization)", async () => {
            const env = await loadFixture(prepareEnvWithoutInitialization);

            expect(await env.stakingContract.stakeToken()).to.equal(ZeroAddress);

            expect(await env.stakingContract.nftReceipt()).to.equal(ZeroAddress);

            expect(await env.stakingContract.lastId()).to.equal(0);

            expect(await env.stakingContract.totalStaked()).to.equal(0);

            expect(await env.stakingContract.minStakeAmount()).to.equal(0);

            expect(await env.stakingContract.withdrawCooldown()).to.equal(0);

            expect(await env.stakingContract.unlockedAll()).to.equal(false);

            expect(await env.stakingContract.allowedDurations(30 * DAY_SEC)).to.equal(false);
            expect(await env.stakingContract.allowedDurations(60 * DAY_SEC)).to.equal(false);
            expect(await env.stakingContract.allowedDurations(90 * DAY_SEC)).to.equal(false);

            expect(await env.stakingContract.totalUserStaked(env.deployer)).to.equal(0);

            // default admin before initialization
            expect(
                await env.stakingContract.hasRole(await env.stakingContract.DEFAULT_ADMIN_ROLE(), env.defaultAdmin)
            ).to.equal(false);

        });

    });

    describe("Initialization", () => {
        it("Initialize staking contract", async () => {
            const env = await loadFixture(prepareEnv);

            expect(await env.stakingContract.stakeToken()).to.equal(env.token);
            expect(await env.stakingContract.nftReceipt()).to.equal(env.nftReceipt);

            expect(await env.stakingContract.lastId()).to.equal(0);

            expect(await env.stakingContract.totalStaked()).to.equal(0);

            expect(await env.stakingContract.minStakeAmount()).to.equal(0);

            expect(await env.stakingContract.withdrawCooldown()).to.equal(0);

            expect(await env.stakingContract.unlockedAll()).to.equal(false);

            expect(await env.stakingContract.allowedDurations(30 * DAY_SEC)).to.equal(true);
            expect(await env.stakingContract.allowedDurations(60 * DAY_SEC)).to.equal(true);
            expect(await env.stakingContract.allowedDurations(90 * DAY_SEC)).to.equal(true);

            expect(await env.stakingContract.totalUserStaked(env.deployer)).to.equal(0);

            // default admin after initialization
            const DEFAULT_ADMIN_ROLE = await env.stakingContract.DEFAULT_ADMIN_ROLE();
            expect(
                await env.stakingContract.hasRole(DEFAULT_ADMIN_ROLE, env.defaultAdmin)
            ).to.equal(true);
        });

        describe("Reverts", () => {
            it("In case of zero address of token", async () => {
                const env = await loadFixture(prepareEnvWithoutInitialization);
                await expect(
                    env.stakingContract.initialize(
                        ZeroAddress, env.nftReceipt, env.defaultAdmin
                    )
                ).revertedWithCustomError(env.stakingContract, "ZeroAddress");
            });

            it("In case of zero address of nftReceipt", async () => {
                const env = await loadFixture(prepareEnvWithoutInitialization);
                await expect(
                    env.stakingContract.initialize(
                        env.token, ZeroAddress, env.defaultAdmin
                    )
                ).revertedWithCustomError(env.stakingContract, "ZeroAddress");
            });

            it("In case of zero address of default admin", async () => {
                const env = await loadFixture(prepareEnvWithoutInitialization);
                await expect(
                    env.stakingContract.initialize(
                        env.token, env.nftReceipt, ZeroAddress
                    )
                ).revertedWithCustomError(env.stakingContract, "ZeroAddress");
            });
        });

    });

    describe("{stake} function", () => {
        it("Stake for allowed duration of 30 days", async () => {
            const env = await loadFixture(prepareEnv);
            const duration = 30 * DAY_SEC;
            const stakeId = await env.stakingContract.lastId() + 1n;

            await env.token.connect(env.alice).approve(env.stakingContract, env.aliceBalance);

            const stakeTime = await time.latest() + 30;
            await time.setNextBlockTimestamp(stakeTime);

            const tx = env.stakingContract.connect(env.alice).stake(env.aliceBalance, duration);
            await expect(tx)
                .to.changeTokenBalances(
                    env.token,
                    [env.alice, env.stakingContract],
                    [env.aliceBalance * (-1n), env.aliceBalance]
                );

            await expect(tx)
                .emit(env.stakingContract, "Stake")
                ;// @todo .withArgs(env.alice.address, stakeId, env.aliceBalance, duration);

            (await tx).wait();

            expect(await env.stakingContract.lastId()).to.equal(stakeId);

            const stakeInfo = await env.stakingContract.stakeInfo(stakeId);
            expect(stakeInfo.amount).to.equal(env.aliceBalance);
            expect(stakeInfo.startTime).to.equal(stakeTime);
            expect(stakeInfo.lockupEndTime).to.equal(stakeTime + duration);
            expect(stakeInfo.withdrawAllowedTime).to.equal(0);

            expect(await env.stakingContract.totalUserStaked(env.alice)).to.equal(env.aliceBalance);
            expect(await env.stakingContract.totalStaked()).to.equal(env.aliceBalance);

            // nftReceipt
            expect(await env.nftReceipt.ownerOf(stakeId)).to.equal(env.alice);
        });

        it("Stake for allowed duration of 60 days", async () => {
            const env = await loadFixture(prepareEnv);
            const duration = 60 * DAY_SEC;
            const stakeId = await env.stakingContract.lastId() + 1n;

            await env.token.connect(env.bob).approve(env.stakingContract, env.bobBalance);

            const stakeTime = await time.latest() + 30;
            await time.setNextBlockTimestamp(stakeTime);

            const tx = env.stakingContract.connect(env.bob).stake(env.bobBalance, duration);

            await expect(tx)
                .to.changeTokenBalances(
                    env.token,
                    [env.bob, env.stakingContract],
                    [env.bobBalance * (-1n), env.bobBalance]
                );

            await expect(tx)
                .emit(env.stakingContract, "Stake")
                ;// @todo .withArgs(env.bob, stakeId, env.bobBalance, duration);

            (await tx).wait();

            expect(await env.stakingContract.lastId()).to.equal(stakeId);

            const stakeInfo = await env.stakingContract.stakeInfo(stakeId);
            expect(stakeInfo.amount).to.equal(env.bobBalance);
            expect(stakeInfo.startTime).to.equal(stakeTime);
            expect(stakeInfo.lockupEndTime).to.equal(stakeTime + duration);
            expect(stakeInfo.withdrawAllowedTime).to.equal(0);

            expect(await env.stakingContract.totalUserStaked(env.bob)).to.equal(env.bobBalance);
            expect(await env.stakingContract.totalStaked()).to.equal(env.bobBalance);

            // nftReceipt
            expect(await env.nftReceipt.ownerOf(stakeId)).to.equal(env.bob);
        });

        describe("Reverts", () => {

            it("Stake with zero amount", async () => {
                const env = await loadFixture(prepareEnv);
                const amount = 0;
                const duration = 30 * DAY_SEC;

                await expect(
                    env.stakingContract.connect(env.alice).stake(amount, duration)
                ).revertedWithCustomError(env.stakingContract, "NotAllowedAmount");
            });

            it("Stake with zero duration", async () => {
                const env = await loadFixture(prepareEnv);
                const amount = 100;
                let duration = 0;

                await expect(
                    env.stakingContract.connect(env.alice).stake(amount, duration)
                ).revertedWithCustomError(env.stakingContract, "NotAllowedDuration");

                duration = 100 * DAY_SEC;

                await expect(
                    env.stakingContract.connect(env.alice).stake(amount, duration)
                ).revertedWithCustomError(env.stakingContract, "NotAllowedDuration");
            });

            it("Stake with duration greater than max duration", async () => {
                const env = await loadFixture(prepareEnv);
                const amount = 100;
                const duration = 90 * DAY_SEC + 1;

                await expect(
                    env.stakingContract.connect(env.alice).stake(amount, duration)
                ).revertedWithCustomError(env.stakingContract, "NotAllowedDuration");
            });

            it("Stake with amount less than minStakeAmount", async () => {
                const env = await loadFixture(prepareEnvWithGrantedRoles);

                const minStakeAmount = WeiPerEther * 100n;
                await env.stakingContract.connect(env.managerAdmin)
                    .setMinStakeAmount(minStakeAmount);

                const amount = minStakeAmount - 1n;
                const duration = 30 * DAY_SEC;


                await expect(
                    env.stakingContract.connect(env.alice).stake(amount, duration)
                ).revertedWithCustomError(env.stakingContract, "NotAllowedAmount");
            });
        });

    });

    describe("{relock} partial function", () => {
        it("Relock for allowed duration of 30 days", async () => {
            const env = await loadFixture(prepareEnvWithStakes);
            await time.increaseTo(env.aliceStake0.lockupEndTime);

            const stakeId = 1;
            const newAliceDuration = 60 * DAY_SEC;
            const newAliceAmount = env.aliceBalance / 2n;
            const lastId = await env.stakingContract.lastId();
            const nextStakeId = lastId + 1n;

            const tx = env.stakingContract
                .connect(env.alice)["relock(uint256,uint256,uint256)"](
                    stakeId,
                    newAliceDuration,
                    newAliceAmount
                );

            await expect(tx)
                .to.changeTokenBalances(
                    env.token,
                    [env.alice, env.stakingContract],
                    [0, 0]
                );

            await expect(tx)
                .emit(env.stakingContract, "Relock")
                .withArgs(env.alice.address, stakeId, newAliceAmount);
            await expect(tx)
                .emit(env.stakingContract, "Stake");
                // .withArgs(env.alice.address, nextStakeId, newAliceAmount);

            (await tx).wait();

            expect(await env.stakingContract.lastId()).to.equal(nextStakeId);

            const stakeInfo0 = await env.stakingContract.stakeInfo(stakeId);
            expect(stakeInfo0.amount).to.equal(env.aliceBalance / 2n);
            expect(stakeInfo0.startTime).to.equal(env.aliceStake0.startTime);
            expect(stakeInfo0.lockupEndTime).to.equal(env.aliceStake0.lockupEndTime);
            expect(stakeInfo0.withdrawAllowedTime).to.equal(0);

            const stakeInfo1 = await env.stakingContract.stakeInfo(nextStakeId);
            expect(stakeInfo1.amount).to.equal(env.aliceBalance / 2n);
            // expect(stakeInfo1.startTime).to.equal(env.aliceStake0.startTime);
            // expect(stakeInfo1.lockupEndTime).to.equal(env.aliceStake0.lockupEndTime);
            expect(stakeInfo1.withdrawAllowedTime).to.equal(0);

            expect(await env.stakingContract.totalUserStaked(env.alice)).to.equal(env.aliceBalance);
            
            expect(await env.stakingContract.totalStaked()).to.equal(
                env.aliceBalance + env.bobBalance + env.carolBalance
            );

            // nftReceipt
            expect(await env.nftReceipt.ownerOf(stakeId)).to.equal(env.alice);
            expect(await env.nftReceipt.ownerOf(nextStakeId)).to.equal(env.alice);

        });



        describe("Reverts", () => {

        });
    });
});



async function prepareEnvWithStakes() {
    const env = await loadFixture(prepareEnv);

    await env.token.connect(env.alice).approve(env.stakingContract, env.aliceBalance);
    await env.token.connect(env.bob).approve(env.stakingContract, env.bobBalance);
    await env.token.connect(env.carol).approve(env.stakingContract, env.carolBalance);

    // alice 1 stake for 10k
    const aliceDuration0 = 30 * DAY_SEC;
    const aliceAmount0 = env.aliceBalance;
    const aliceStartTime0 = await time.latest() + 130;
    const aliceEndTime0 = aliceStartTime0 + aliceDuration0;
    await time.setNextBlockTimestamp(aliceStartTime0);
    await env.stakingContract.connect(env.alice).stake(aliceAmount0, aliceDuration0);

    const aliceStake0 = {
        amount: aliceAmount0,
        startTime: aliceStartTime0,
        lockupEndTime: aliceEndTime0,
        withdrawAllowedTime: 0,
    }

    // bob 2 stakes for 10k
    const bobDuration0 = 30 * DAY_SEC;
    const bobAmount0 = env.bobBalance / 2n;
    const bobStartTime0 = await time.latest() + 130;
    const bobEndTime0 = bobStartTime0 + bobDuration0;
    await time.setNextBlockTimestamp(bobStartTime0);
    await env.stakingContract.connect(env.bob).stake(bobAmount0, bobDuration0);
    const bobStake0 = {
        amount: bobAmount0,
        startTime: bobStartTime0,
        lockupEndTime: bobEndTime0,
        withdrawAllowedTime: 0,
    }

    const bobDuration1 = 60 * DAY_SEC;
    const bobAmount1 = env.bobBalance / 2n;
    const bobStartTime1 = await time.latest() + 130;
    const bobEndTime1 = bobStartTime1 + bobDuration1;
    await time.setNextBlockTimestamp(bobStartTime1);
    await env.stakingContract.connect(env.bob).stake(bobAmount1, bobDuration1);
    const bobStake1 = {
        amount: bobAmount1,
        startTime: bobStartTime1,
        lockupEndTime: bobEndTime1,
        withdrawAllowedTime: 0,
    }

    // carol 3 stakes for 10k
    const carolDuration0 = 30 * DAY_SEC;
    const carolAmount0 = env.carolBalance / 3n;
    const carolStartTime0 = await time.latest() + 130;
    const carolEndTime0 = carolStartTime0 + carolDuration0;
    await time.setNextBlockTimestamp(carolStartTime0);
    await env.stakingContract.connect(env.carol).stake(carolAmount0, carolDuration0);
    const carolStake0 = {
        amount: carolAmount0,
        startTime: carolStartTime0,
        lockupEndTime: carolEndTime0,
        withdrawAllowedTime: 0,
    }

    const carolDuration1 = 60 * DAY_SEC;
    const carolAmount1 = env.carolBalance / 3n;
    const carolStartTime1 = await time.latest() + 130;
    const carolEndTime1 = carolStartTime1 + carolDuration1;
    await time.setNextBlockTimestamp(carolStartTime1);
    await env.stakingContract.connect(env.carol).stake(carolAmount1, carolDuration1);
    const carolStake1 = {
        amount: carolAmount1,
        startTime: carolStartTime1,
        lockupEndTime: carolEndTime1,
        withdrawAllowedTime: 0,
    }

    const carolDuration2 = 90 * DAY_SEC;
    const carolAmount2 = env.carolBalance / 3n;
    const carolStartTime2 = await time.latest() + 130;
    const carolEndTime2 = carolStartTime2 + carolDuration2;
    await time.setNextBlockTimestamp(carolStartTime2);
    await env.stakingContract.connect(env.carol).stake(carolAmount2, carolDuration2);
    const carolStake2 = {
        amount: carolAmount2,
        startTime: carolStartTime2,
        lockupEndTime: carolEndTime2,
        withdrawAllowedTime: 0,
    }


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
    await env.stakingContract.connect(env.defaultAdmin)
        .grantRole(await env.stakingContract.CONTRACT_MANAGER_ROLE(), env.managerAdmin);
    await env.stakingContract.connect(env.defaultAdmin)
        .grantRole(await env.stakingContract.EMERGENCY_MANAGER_ROLE(), env.emergencyAdmin);

    return {
        ...env,
    };
}

async function prepareEnv() {
    const env = await loadFixture(prepareEnvWithoutInitialization);

    await env.stakingContract.initialize(
        env.token, env.nftReceipt, env.defaultAdmin
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
        alice,
        bob,
        carol
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
    const stakingContract = await ethers.getContractAt(
        "Staking",
        stakingProxy,
    );


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
