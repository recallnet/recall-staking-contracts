import { parseEther } from "ethers";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

// Standard Anvil test accounts (skip account 0 which is deployer)
const ANVIL_ACCOUNTS = [
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
    "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
    "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f",
    "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720",
];

// Airdrop amount per account (1000 tokens each)
const AIRDROP_AMOUNT_PER_ACCOUNT = parseEther("1000");

// Season for the airdrop
const AIRDROP_SEASON = 1;

// Duration penalties (duration in seconds, penalty in basis points where 10000 = 100%)
// Lower penalty for longer staking duration
const DURATION_PENALTIES = [
    { duration: 0, penalty: 5000 }, // No staking: 50% penalty
    { duration: 30 * 24 * 60 * 60, penalty: 3000 }, // 30 days: 30% penalty
    { duration: 90 * 24 * 60 * 60, penalty: 1500 }, // 90 days: 15% penalty
    { duration: 180 * 24 * 60 * 60, penalty: 500 }, // 180 days: 5% penalty
    { duration: 365 * 24 * 60 * 60, penalty: 0 }, // 365 days: 0% penalty
];

/**
 * Pre-generated merkle tree data for Anvil test accounts.
 * Generated using @openzeppelin/merkle-tree with leaf format: [address, uint256, uint8]
 * Each account gets 1000 tokens (1000000000000000000000 wei) for season 1.
 *
 * To regenerate, use the generate-merkle-tree.ts script in apps/api/scripts/
 */
const MERKLE_DATA = {
    root: "0x99341db4a72623b4f268048ed9f02ff92894fc9a5fa6409107188ce968975a78",
    allocations: [
        {
            address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            amount: "1000000000000000000000",
            season: 1,
            proof: [
                "0x2ec4da4988bb66de7743d4a19781bbc1980457637476d75591f7bb70b9cbfa1f",
                "0xe94a3b471459e094ada06591313c398e0998ae7b2d7e73f530b63f19209ec905",
                "0xf13fa2de8ebd77aac95d230aa0f1284914d782d200e7b7f280fd7507f71466b6",
                "0x0f5b4a0307a9f76166c5a53611aee471015ed4ec05c2b2e481535f9851bb4443",
            ],
        },
        {
            address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
            amount: "1000000000000000000000",
            season: 1,
            proof: [
                "0x4252241a9778f2c2311eccc8ede06d33dd43634b2c9d189e2329521844d2751c",
                "0x9b607ce2292d9364e70ecff38464eb9628bc1d29d63fe209cb3adb0be2c96f16",
                "0xcb827afd1bbe2ed492200f216d2f3342da680b268164baff0e74e832c933755f",
            ],
        },
        {
            address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
            amount: "1000000000000000000000",
            season: 1,
            proof: [
                "0x816959b655d7a738e9133c4da197c9216275aeffbfd8b5d0211db7aff3e67e59",
                "0x1b352034f678a35a2a4a4d7f4268024cfe5018c7abc82bec996ebadecbbb724a",
                "0x0f5b4a0307a9f76166c5a53611aee471015ed4ec05c2b2e481535f9851bb4443",
            ],
        },
        {
            address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
            amount: "1000000000000000000000",
            season: 1,
            proof: [
                "0x2ba4f1572bef52adc1c30814a3ffc0c82676864936894d0e1e589e2c9452fb3e",
                "0xe94a3b471459e094ada06591313c398e0998ae7b2d7e73f530b63f19209ec905",
                "0xf13fa2de8ebd77aac95d230aa0f1284914d782d200e7b7f280fd7507f71466b6",
                "0x0f5b4a0307a9f76166c5a53611aee471015ed4ec05c2b2e481535f9851bb4443",
            ],
        },
        {
            address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
            amount: "1000000000000000000000",
            season: 1,
            proof: [
                "0xa53e1ae347715706a20c79c504276f022e53c80e9cdaf83335d7872d1c5ad511",
                "0x1b352034f678a35a2a4a4d7f4268024cfe5018c7abc82bec996ebadecbbb724a",
                "0x0f5b4a0307a9f76166c5a53611aee471015ed4ec05c2b2e481535f9851bb4443",
            ],
        },
        {
            address: "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
            amount: "1000000000000000000000",
            season: 1,
            proof: [
                "0x59240a656f3afa317b5d58ffb64c1fc77acfc70ff3c76c6813c37a9cbb46a6c2",
                "0x9b607ce2292d9364e70ecff38464eb9628bc1d29d63fe209cb3adb0be2c96f16",
                "0xcb827afd1bbe2ed492200f216d2f3342da680b268164baff0e74e832c933755f",
            ],
        },
        {
            address: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
            amount: "1000000000000000000000",
            season: 1,
            proof: [
                "0x297feef0f89b2a11887d1c026ba3eb78e59589d9d153861d7965fb5bdc48324f",
                "0xf13fa2de8ebd77aac95d230aa0f1284914d782d200e7b7f280fd7507f71466b6",
                "0x0f5b4a0307a9f76166c5a53611aee471015ed4ec05c2b2e481535f9851bb4443",
            ],
        },
        {
            address: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f",
            amount: "1000000000000000000000",
            season: 1,
            proof: [
                "0x6858d00d8cac502f0fa45439e77efa0723109e1b4ba8ec8a361e888a48612651",
                "0xe753dde72635fd59cdbd7105dff0df3336584e09e665421cbff0141d44608df6",
                "0xcb827afd1bbe2ed492200f216d2f3342da680b268164baff0e74e832c933755f",
            ],
        },
        {
            address: "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720",
            amount: "1000000000000000000000",
            season: 1,
            proof: [
                "0x6f1987f7db23a0707624f825ec29266245644dd5376eaa64dd80c4bfdef84032",
                "0xe753dde72635fd59cdbd7105dff0df3336584e09e665421cbff0141d44608df6",
                "0xcb827afd1bbe2ed492200f216d2f3342da680b268164baff0e74e832c933755f",
            ],
        },
    ],
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // Only deploy on docker/hardhat networks for local development
    if (hre.network.name !== "docker" && hre.network.name !== "hardhat") {
        console.log("Skipping Airdrop deployment on", hre.network.name);
        return;
    }

    const { deployments, getNamedAccounts } = hre;
    const { deploy, get } = deployments;

    const { deployer } = await getNamedAccounts();

    console.log("Setting up Fuul Airdrop Distributor...");
    console.log("Deployer:", deployer);

    // Get deployed contracts
    const erc20Mock = await get("ERC20Mock");
    let stakingDeployment;
    try {
        stakingDeployment = await get("Staking");
    } catch {
        console.log("Staking contract not deployed, will set to zero address");
    }

    console.log("ERC20Mock:", erc20Mock.address);
    if (stakingDeployment) {
        console.log("Staking:", stakingDeployment.address);
    }

    // Deploy FuulAirdropDistributorFactory
    console.log("Deploying FuulAirdropDistributorFactory...");
    const factoryDeployment = await deploy("FuulAirdropDistributorFactory", {
        from: deployer,
        args: [],
        log: true,
    });
    console.log(
        "FuulAirdropDistributorFactory deployed at:",
        factoryDeployment.address,
    );

    // Get factory contract
    const factoryContract = await hre.ethers.getContractAt(
        "FuulAirdropDistributorFactory",
        factoryDeployment.address,
    );

    // Create distributor with pre-generated merkle root
    console.log("Creating FuulAirdropDistributor...");
    console.log("Merkle root:", MERKLE_DATA.root);

    const createTx = await factoryContract.createDistributor({
        admin: deployer,
        pauser: deployer,
        verifier: "0x0000000000000000000000000000000000000000", // No signature verification for local dev
        nativeFeeAmount: 0, // No fee for local dev
        distributorMerkleRoot: MERKLE_DATA.root,
        currency: erc20Mock.address,
        stakingContract:
            stakingDeployment?.address ||
            "0x0000000000000000000000000000000000000000",
        durationPenalty: DURATION_PENALTIES,
    });

    const createReceipt = await createTx.wait();

    // Get distributor address from event
    const distributorCreatedEvent = createReceipt?.logs.find(
        (log: { topics: readonly string[] }) => {
            try {
                return (
                    log.topics[0] ===
                    factoryContract.interface.getEvent("DistributorCreated")
                        ?.topicHash
                );
            } catch {
                return false;
            }
        },
    );

    if (!distributorCreatedEvent) {
        throw new Error("DistributorCreated event not found");
    }

    const parsedEvent = factoryContract.interface.parseLog({
        topics: distributorCreatedEvent.topics as string[],
        data: distributorCreatedEvent.data,
    });

    const distributorAddress = parsedEvent?.args[1];
    console.log("FuulAirdropDistributor created at:", distributorAddress);

    // Mint tokens and transfer to distributor
    const erc20MockContract = await hre.ethers.getContractAt(
        "ERC20Mock",
        erc20Mock.address,
    );

    const totalAirdrop =
        AIRDROP_AMOUNT_PER_ACCOUNT * BigInt(ANVIL_ACCOUNTS.length);

    console.log("Minting", totalAirdrop.toString(), "tokens...");
    const mintTx = await erc20MockContract["mint(address,uint256)"](
        deployer,
        totalAirdrop,
    );
    await mintTx.wait();

    console.log("Transferring tokens to distributor...");
    const transferTx = await erc20MockContract.transfer(
        distributorAddress,
        totalAirdrop,
    );
    await transferTx.wait();
    console.log(
        "Transferred",
        totalAirdrop.toString(),
        "tokens to distributor",
    );

    // Get distributor contract for verification
    const distributorContract = await hre.ethers.getContractAt(
        "FuulAirdropDistributor",
        distributorAddress,
    );

    // Disable signature verification for local dev
    console.log("Disabling signature verification for local development...");
    const disableSigTx =
        await distributorContract.setSignatureVerification(false);
    await disableSigTx.wait();

    // Log claim info
    console.log("");
    console.log("=== Airdrop Summary ===");
    console.log("FuulAirdropDistributorFactory:", factoryDeployment.address);
    console.log("FuulAirdropDistributor:", distributorAddress);
    console.log("Token:", erc20Mock.address);
    console.log("Staking:", stakingDeployment?.address || "Not deployed");
    console.log("Merkle Root:", MERKLE_DATA.root);
    console.log("");
    console.log("Duration Penalties:");
    for (const dp of DURATION_PENALTIES) {
        const durationDays = dp.duration / (24 * 60 * 60);
        console.log(`  ${durationDays} days: ${dp.penalty / 100}% penalty`);
    }
    console.log("");
    console.log("Accounts with claimable tokens:");
    for (const allocation of MERKLE_DATA.allocations) {
        console.log(`  ${allocation.address}:`);
        console.log(
            `    Amount: ${allocation.amount} wei (${hre.ethers.formatEther(allocation.amount)} tokens)`,
        );
        console.log(`    Season: ${allocation.season}`);
        console.log(`    Proof: ${JSON.stringify(allocation.proof)}`);
    }
    console.log("");
    console.log("To claim, call FuulAirdropDistributor.claim() with:");
    console.log("  - proof: merkle proof array");
    console.log("  - to: recipient address");
    console.log("  - amount: allocated amount");
    console.log(`  - season: ${AIRDROP_SEASON}`);
    console.log("  - duration: staking duration (0 for no staking)");
    console.log(
        "  - signature: empty bytes (0x) since verification is disabled",
    );
    console.log("");

    // Save deployment info for later use
    await deployments.save("FuulAirdropDistributor", {
        address: distributorAddress,
        abi: (await hre.artifacts.readArtifact("FuulAirdropDistributor")).abi,
    });
};

export default func;
func.tags = ["Airdrop"];
func.dependencies = ["ERC20Mock"];
