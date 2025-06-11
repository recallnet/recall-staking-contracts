import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Unit-tests for the NftReceipt contract", () => {
    it("Deploy test", async () => {
        const env = await loadFixture(prepareEnvWithoutInitialization);

        expect(await env.nftReceiptImplementation.staking()).equals(
            ethers.ZeroAddress,
        );

        expect(
            await env.nftReceiptContract.getRoleMemberCount(
                env.DEFAULT_ADMIN_ROLE,
            ),
        ).equals(0);
        expect(
            await env.nftReceiptContract.getRoleMemberCount(
                env.SET_NFT_METADATA_ROLE,
            ),
        ).equals(0);

        await expect(
            env.nftReceiptImplementation.initialize(ethers.ZeroAddress),
        ).revertedWithCustomError(
            env.nftReceiptImplementation,
            "InvalidInitialization",
        );
    });

    describe("{initialize} function", () => {
        it("Core functionality", async () => {
            const env = await loadFixture(prepareEnvWithoutInitialization);

            await env.nftReceiptContract.initialize(env.admin);

            expect(await env.nftReceiptImplementation.staking()).equals(
                ethers.ZeroAddress,
            );

            expect(
                await env.nftReceiptContract.getRoleMemberCount(
                    env.DEFAULT_ADMIN_ROLE,
                ),
            ).equals(1);
            expect(
                await env.nftReceiptContract.getRoleMemberCount(
                    env.SET_NFT_METADATA_ROLE,
                ),
            ).equals(0);

            expect(
                await env.nftReceiptContract.getRoleMember(
                    env.DEFAULT_ADMIN_ROLE,
                    0,
                ),
            ).equals(env.admin);
        });

        describe("Reverts", () => {
            it("Double initialization", async () => {
                const env = await loadFixture(prepareEnv);

                await expect(
                    env.nftReceiptContract.initialize(ethers.ZeroAddress),
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

    describe("{setBaseURI} function", () => {
        it("Core functionality", async () => {
            const env = await loadFixture(prepareEnv);

            const newBaseURIString = env.baseURIString + "new";

            await expect(
                env.nftReceiptContract
                    .connect(env.setNftMetadataRole)
                    .setBaseURI(newBaseURIString),
            )
                .emit(env.nftReceiptContract, "BaseURIStringChanged")
                .withArgs(newBaseURIString);

            expect(await env.nftReceiptContract.baseURIString()).equals(
                newBaseURIString,
            );
        });

        describe("Reverts", () => {
            it("Wrong caller", async () => {
                const env = await loadFixture(prepareEnv);

                await expect(
                    env.nftReceiptContract
                        .connect(env.alice)
                        .setBaseURI(env.baseURIString),
                )
                    .revertedWithCustomError(
                        env.nftReceiptContract,
                        "AccessControlUnauthorizedAccount",
                    )
                    .withArgs(env.alice, env.SET_NFT_METADATA_ROLE);
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

    it("{tokenURI} function", async () => {
        const env = await loadFixture(prepareEnvWithStaking);

        const mintedId = 16;

        await env.nftReceiptContract
            .connect(env.staking)
            .mint(env.alice, mintedId);

        const tokenURI = await env.nftReceiptContract.tokenURI(mintedId);

        expect(tokenURI).equals(
            env.baseURIString + "0x" + mintedId.toString(16),
        );
    });

    it("{supportsInterface} function", async () => {
        const env = await loadFixture(prepareEnvWithStaking);

        expect(
            await env.nftReceiptContract.supportsInterface("0x80ac58cd"),
        ).equals(true); // ERC721
        expect(
            await env.nftReceiptContract.supportsInterface("0x5b5e139f"),
        ).equals(true); // ERC721Metadata
        expect(
            await env.nftReceiptContract.supportsInterface("0x780e9d63"),
        ).equals(true); // ERC721Enumerable
        expect(
            await env.nftReceiptContract.supportsInterface("0x7965db0b"),
        ).equals(true); // AccessControl
        expect(
            await env.nftReceiptContract.supportsInterface("0x5a05180f"),
        ).equals(true); // AccessControlEnumerable
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
    const env = await loadFixture(prepareEnv);

    await env.nftReceiptContract.setStaking(env.staking);

    return {
        ...env,
    };
}

async function prepareEnv() {
    const env = await loadFixture(prepareEnvWithoutInitialization);

    await env.nftReceiptContract.initialize(env.admin);

    await env.nftReceiptContract
        .connect(env.admin)
        .grantRole(env.SET_NFT_METADATA_ROLE, env.setNftMetadataRole);

    await env.nftReceiptContract
        .connect(env.setNftMetadataRole)
        .setBaseURI(env.baseURIString);

    return {
        ...env,
    };
}

async function prepareEnvWithoutInitialization() {
    const [deployer, admin, setNftMetadataRole, staking, alice, bob] =
        await ethers.getSigners();

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

    const baseURIString = "https://example.com/nft/";

    const DEFAULT_ADMIN_ROLE = await nftReceiptContract.DEFAULT_ADMIN_ROLE();
    const SET_NFT_METADATA_ROLE =
        await nftReceiptContract.SET_NFT_METADATA_ROLE();

    return {
        deployer,
        admin,
        setNftMetadataRole,
        staking,
        alice,
        bob,

        DEFAULT_ADMIN_ROLE,
        SET_NFT_METADATA_ROLE,

        baseURIString,

        nftReceiptImplementation,
        nftReceiptContract,
    };
}
