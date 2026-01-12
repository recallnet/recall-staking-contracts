import { parseEther } from "ethers";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

// Standard Anvil test accounts
const ANVIL_ACCOUNTS = [
    "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
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

// Amount to mint per account (500 tokens each)
const MINT_AMOUNT_PER_ACCOUNT = parseEther("500");

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // Only deploy mock token on docker network
    if (hre.network.name !== "docker" && hre.network.name !== "hardhat") {
        console.log("Skipping ERC20Mock deployment on", hre.network.name);
        return;
    }

    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;

    const { deployer } = await getNamedAccounts();

    console.log("Deploying ERC20Mock...");

    const result = await deploy("ERC20Mock", {
        from: deployer,
        args: [],
        log: true,
        waitConfirmations: 1,
        skipIfAlreadyDeployed: true,
    });

    console.log("ERC20Mock deployed to:", result.address);

    // Mint tokens to all Anvil accounts for local development
    if (result.newlyDeployed || process.env.FORCE_MINT === "true") {
        console.log("\nMinting tokens to Anvil accounts...");
        const erc20MockContract = await hre.ethers.getContractAt(
            "ERC20Mock",
            result.address,
        );

        for (const account of ANVIL_ACCOUNTS) {
            console.log(
                `Minting ${MINT_AMOUNT_PER_ACCOUNT.toString()} tokens to ${account}...`,
            );
            const mintTx = await erc20MockContract["mint(address,uint256)"](
                account,
                MINT_AMOUNT_PER_ACCOUNT,
            );
            await mintTx.wait();
        }

        console.log("\n✅ Minted 500 tokens to each of the 10 Anvil accounts");
    }
};

export default func;
func.tags = ["ERC20Mock"];
