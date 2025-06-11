import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Unit-tests for the NftReceipt contract", () => {
    it("Deploy test", async () => {
        const env = await loadFixture(prepareEnvWithoutInitialization);

        expect(await env.nftReceiptImplementation.staking()).equals(
            ethers.ZeroAddress,
        );

        await expect(
            env.nftReceiptImplementation.initialize(),
        ).revertedWithCustomError(
            env.nftReceiptImplementation,
            "InvalidInitialization",
        );
    });

    describe("{initialize} function", () => {
        it("Core functionality", async () => {
            const env = await loadFixture(prepareEnvWithoutInitialization);

            expect(await env.nftReceiptImplementation.staking()).equals(
                ethers.ZeroAddress,
            );

            await env.nftReceiptContract.initialize();

            expect(await env.nftReceiptImplementation.staking()).equals(
                ethers.ZeroAddress,
            );
        });

        describe("Reverts", () => {
            it("Double initialization", async () => {
                const env = await loadFixture(prepareEnv);

                await expect(
                    env.nftReceiptContract.initialize(),
                ).revertedWithCustomError(
                    env.nftReceiptContract,
                    "InvalidInitialization",
                );
            });
        });
    });

    describe("{mint} function", () => {
        it("Core functionality", async () => {
            const env = await loadFixture(prepareEnvWithStaking);

            const mintedId = 1;

            await env.nftReceiptContract
                .connect(env.staking)
                .mint(env.alice, mintedId);

            expect(await env.nftReceiptContract.ownerOf(mintedId)).equals(
                env.alice,
            );
            expect(await env.nftReceiptContract.balanceOf(env.alice)).equals(1);
            expect(
                await env.nftReceiptContract.tokenOfOwnerByIndex(env.alice, 0),
            ).equals(mintedId);

            const mintedId2 = 5;

            await env.nftReceiptContract
                .connect(env.staking)
                .mint(env.alice, mintedId2);

            expect(await env.nftReceiptContract.ownerOf(mintedId2)).equals(
                env.alice,
            );
            expect(await env.nftReceiptContract.balanceOf(env.alice)).equals(2);
            expect(
                await env.nftReceiptContract.tokenOfOwnerByIndex(env.alice, 0),
            ).equals(mintedId);
            expect(
                await env.nftReceiptContract.tokenOfOwnerByIndex(env.alice, 1),
            ).equals(mintedId2);
        });

        describe("Reverts", () => {
            it("Not staking", async () => {
                const env = await loadFixture(prepareEnvWithStaking);

                await expect(
                    env.nftReceiptContract
                        .connect(env.alice)
                        .mint(env.alice, 1),
                ).revertedWithCustomError(
                    env.nftReceiptContract,
                    "NftReceipt__OnlyStaking",
                );
            });
        });
    });

    describe("{burn} function", () => {
        it("Core functionality", async () => {
            const env = await loadFixture(prepareEnvWithStaking);

            const mintedId = 1;
            const mintedId2 = 5;

            await env.nftReceiptContract
                .connect(env.staking)
                .mint(env.alice, mintedId);
            await env.nftReceiptContract
                .connect(env.staking)
                .mint(env.alice, mintedId2);

            await env.nftReceiptContract.connect(env.staking).burn(mintedId);

            await expect(env.nftReceiptContract.ownerOf(mintedId))
                .revertedWithCustomError(
                    env.nftReceiptContract,
                    "ERC721NonexistentToken",
                )
                .withArgs(mintedId);

            expect(await env.nftReceiptContract.ownerOf(mintedId2)).equals(
                env.alice,
            );
            expect(await env.nftReceiptContract.balanceOf(env.alice)).equals(1);
            expect(
                await env.nftReceiptContract.tokenOfOwnerByIndex(env.alice, 0),
            ).equals(mintedId2);
        });

        describe("Reverts", () => {
            it("Not staking", async () => {
                const env = await loadFixture(prepareEnvWithStaking);

                await expect(
                    env.nftReceiptContract.connect(env.alice).burn(1),
                ).revertedWithCustomError(
                    env.nftReceiptContract,
                    "NftReceipt__OnlyStaking",
                );
            });
        });
    });

    describe("{setStaking} function", () => {
        it("Core functionality", async () => {
            const env = await loadFixture(prepareEnv);

            expect(await env.nftReceiptContract.staking()).equals(
                ethers.ZeroAddress,
            );

            await env.nftReceiptContract.setStaking(env.staking);

            expect(await env.nftReceiptContract.staking()).equals(env.staking);
        });

        describe("Reverts", () => {
            it("Double set", async () => {
                const env = await loadFixture(prepareEnv);

                await env.nftReceiptContract.setStaking(env.staking);

                await expect(
                    env.nftReceiptContract.setStaking(env.staking),
                ).revertedWithCustomError(
                    env.nftReceiptContract,
                    "NftReceipt__StakingAlreadySet",
                );
            });
        });
    });

    it("{tokensOfOwner} function", async () => {
        const env = await loadFixture(prepareEnvWithStaking);

        const mintedId = 1;
        const mintedId2 = 5;

        await env.nftReceiptContract
            .connect(env.staking)
            .mint(env.alice, mintedId);
        await env.nftReceiptContract
            .connect(env.staking)
            .mint(env.alice, mintedId2);

        const mintedIds = await env.nftReceiptContract.tokensOfOwner(env.alice);

        expect(mintedIds.length).equals(2);
        expect(mintedIds[0]).equals(mintedId);
        expect(mintedIds[1]).equals(mintedId2);
    });

    it("Non transferable", async () => {
        const env = await loadFixture(prepareEnvWithStaking);

        const mintedId = 1;

        await env.nftReceiptContract
            .connect(env.staking)
            .mint(env.alice, mintedId);

        await expect(
            env.nftReceiptContract
                .connect(env.alice)
                .transferFrom(env.alice, env.bob, mintedId),
        ).revertedWithCustomError(
            env.nftReceiptContract,
            "NftReceipt__TransfersNotAllowed",
        );

        await env.nftReceiptContract
            .connect(env.alice)
            .setApprovalForAll(env.bob, true);

        await expect(
            env.nftReceiptContract
                .connect(env.bob)
                .transferFrom(env.alice, env.bob, mintedId),
        ).revertedWithCustomError(
            env.nftReceiptContract,
            "NftReceipt__TransfersNotAllowed",
        );

        await env.nftReceiptContract
            .connect(env.alice)
            .setApprovalForAll(env.bob, false);
        await env.nftReceiptContract
            .connect(env.alice)
            .approve(env.bob, mintedId);

        await expect(
            env.nftReceiptContract
                .connect(env.bob)
                .transferFrom(env.alice, env.bob, mintedId),
        ).revertedWithCustomError(
            env.nftReceiptContract,
            "NftReceipt__TransfersNotAllowed",
        );
    });
});

async function prepareEnvWithStaking() {
    const env = await loadFixture(prepareEnvWithoutInitialization);

    await env.nftReceiptContract.setStaking(env.staking);

    return {
        ...env,
    };
}

async function prepareEnv() {
    const env = await loadFixture(prepareEnvWithoutInitialization);

    await env.nftReceiptContract.initialize();

    return {
        ...env,
    };
}

async function prepareEnvWithoutInitialization() {
    const [deployer, staking, alice, bob] = await ethers.getSigners();

    const nftReceiptFactory = await ethers.getContractFactory("NftReceipt");
    const nftReceiptImplementation = await nftReceiptFactory.deploy();

    const transparentUpgradeableProxyFactory = await ethers.getContractFactory(
        "TransparentUpgradeableProxy",
    );
    const nftReceiptProxy = await transparentUpgradeableProxyFactory.deploy(
        nftReceiptImplementation,
        deployer,
        "0x",
    );
    const nftReceiptContract = await ethers.getContractAt(
        "NftReceipt",
        nftReceiptProxy,
    );

    return {
        deployer,
        staking,
        alice,
        bob,

        nftReceiptImplementation,
        nftReceiptContract,
    };
}
