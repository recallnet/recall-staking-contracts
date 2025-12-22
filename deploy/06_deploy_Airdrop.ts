import { keccak256, parseEther, solidityPacked } from "ethers";
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

// Airdrop amount per account (1000 tokens each)
const AIRDROP_AMOUNT_PER_ACCOUNT = parseEther("1000");

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // Only deploy on docker/hardhat networks for local development
    if (hre.network.name !== "docker" && hre.network.name !== "hardhat") {
        console.log("Skipping Airdrop deployment on", hre.network.name);
        return;
    }

    const { deployments, getNamedAccounts } = hre;
    const { get } = deployments;

    const { deployer } = await getNamedAccounts();

    console.log("Setting up Fuul Airdrop...");
    console.log("Deployer:", deployer);

    // Get deployed contracts
    const erc20Mock = await get("ERC20Mock");
    const fuulFactory = await get("FuulFactory");

    console.log("ERC20Mock:", erc20Mock.address);
    console.log("FuulFactory:", fuulFactory.address);

    const fuulFactoryContract = await hre.ethers.getContractAt(
        "FuulFactory",
        fuulFactory.address,
    );

    // Grant MANAGER_ROLE to deployer so they can call attributeConversions
    const MANAGER_ROLE = await fuulFactoryContract.MANAGER_ROLE();
    const hasManagerRole = await fuulFactoryContract.hasRole(
        MANAGER_ROLE,
        deployer,
    );

    if (!hasManagerRole) {
        console.log("Granting MANAGER_ROLE to deployer...");
        const grantTx = await fuulFactoryContract.grantRole(
            MANAGER_ROLE,
            deployer,
        );
        await grantTx.wait();
        console.log("MANAGER_ROLE granted to deployer");
    }

    // Create a FuulProject for the airdrop
    console.log("Creating FuulProject for airdrop...");
    const projectInfoURI = "ipfs://local-airdrop-project";

    const createTx = await fuulFactoryContract.createFuulProject(
        deployer, // projectAdmin
        deployer, // projectEventSigner
        projectInfoURI,
        deployer, // clientFeeCollector
    );
    const createReceipt = await createTx.wait();

    // Get the project address from the ProjectCreated event
    const projectCreatedEvent = createReceipt?.logs.find(
        (log: { topics: readonly string[] }) => {
            try {
                return (
                    log.topics[0] ===
                    fuulFactoryContract.interface.getEvent("ProjectCreated")
                        ?.topicHash
                );
            } catch {
                return false;
            }
        },
    );

    if (!projectCreatedEvent) {
        throw new Error("ProjectCreated event not found");
    }

    const parsedEvent = fuulFactoryContract.interface.parseLog({
        topics: projectCreatedEvent.topics as string[],
        data: projectCreatedEvent.data,
    });

    const projectAddress = parsedEvent?.args[1];
    console.log("FuulProject created at:", projectAddress);

    // Get project contract
    const fuulProject = await hre.ethers.getContractAt(
        "FuulProject",
        projectAddress,
    );

    // Mint tokens and deposit into project
    const erc20MockContract = await hre.ethers.getContractAt(
        "ERC20Mock",
        erc20Mock.address,
    );

    const totalAirdrop =
        AIRDROP_AMOUNT_PER_ACCOUNT * BigInt(ANVIL_ACCOUNTS.length);

    console.log("Minting", totalAirdrop.toString(), "tokens...");
    const mintTx = await erc20MockContract.mint(totalAirdrop);
    await mintTx.wait();

    console.log("Approving tokens for project...");
    const approveTx = await erc20MockContract.approve(
        projectAddress,
        totalAirdrop,
    );
    await approveTx.wait();

    console.log("Depositing tokens into project...");
    const depositTx = await fuulProject.depositFungibleToken(
        erc20Mock.address,
        totalAirdrop,
    );
    await depositTx.wait();
    console.log("Deposited", totalAirdrop.toString(), "tokens into project");

    // Create attributions for each Anvil account
    // Skip account 0 (deployer) since they're the admin
    const accountsToAirdrop = ANVIL_ACCOUNTS.slice(1);

    console.log(
        "Creating attributions for",
        accountsToAirdrop.length,
        "accounts...",
    );

    const attributions = accountsToAirdrop.map((account, index) => {
        // Generate a unique proofWithoutProject for each attribution
        const proofWithoutProject = keccak256(
            solidityPacked(
                ["string", "address", "uint256"],
                ["airdrop", account, index],
            ),
        );

        // proof = keccak256(proofWithoutProject, projectAddress)
        const proof = keccak256(
            solidityPacked(
                ["bytes32", "address"],
                [proofWithoutProject, projectAddress],
            ),
        );

        return {
            currency: erc20Mock.address,
            partner: account, // No partner split, all goes to end user
            endUser: account,
            amountToPartner: 0n,
            amountToEndUser: AIRDROP_AMOUNT_PER_ACCOUNT,
            proof,
            proofWithoutProject,
        };
    });

    // Call attributeConversions on the project
    console.log("Attributing tokens to accounts...");
    const attributeTx = await fuulProject.attributeConversions(
        attributions,
        deployer, // attributorFeeCollector
    );
    await attributeTx.wait();
    console.log("Attributions complete!");

    // Log claim info for each account
    console.log("");
    console.log("=== Airdrop Summary ===");
    console.log("FuulProject:", projectAddress);
    console.log("Token:", erc20Mock.address);
    console.log("");
    console.log("Accounts with claimable tokens:");
    for (const account of accountsToAirdrop) {
        const claimable = await fuulProject.availableToClaim(
            account,
            erc20Mock.address,
        );
        console.log(`  ${account}: ${claimable.toString()} wei`);
    }
    console.log("");
    console.log("To claim, call FuulManager.claim() with the project address");
    console.log("");
};

export default func;
func.tags = ["Airdrop"];
func.dependencies = ["ERC20Mock", "FuulContracts"];
