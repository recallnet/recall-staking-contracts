import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // Only deploy on docker/hardhat networks for local development
    if (hre.network.name !== "docker" && hre.network.name !== "hardhat") {
        console.log("Skipping Fuul contracts deployment on", hre.network.name);
        return;
    }

    const { deployments, getNamedAccounts } = hre;
    const { deploy, get } = deployments;

    const { deployer } = await getNamedAccounts();

    console.log("Deploying Fuul contracts...");
    console.log("Deployer:", deployer);

    // Get the ERC20Mock address to use as accepted currency
    const erc20Mock = await get("ERC20Mock");
    if (!erc20Mock.address) {
        throw new Error("ERC20Mock not deployed - it is a dependency");
    }

    console.log("Using ERC20Mock at:", erc20Mock.address);

    // Deploy FuulManager first
    console.log("Deploying FuulManager...");
    const fuulManagerResult = await deploy("FuulManager", {
        from: deployer,
        args: [],
        log: true,
        waitConfirmations: 1,
        skipIfAlreadyDeployed: true,
    });
    console.log("FuulManager deployed to:", fuulManagerResult.address);

    // Deploy FuulFactory with constructor args matching the production contract
    // Constructor args:
    // - fuulManager: address of the manager contract
    // - initialProtocolFeeCollector: address that collects protocol fees (use deployer)
    // - initialNftFeeCurrency: address(0) for native token
    // - acceptedERC20CurrencyToken: address of ERC20 to accept
    console.log("Deploying FuulFactory...");
    const fuulFactoryResult = await deploy("FuulFactory", {
        from: deployer,
        args: [
            fuulManagerResult.address, // fuulManager
            deployer, // initialProtocolFeeCollector
            "0x0000000000000000000000000000000000000000", // initialNftFeeCurrency (native)
            erc20Mock.address, // acceptedERC20CurrencyToken
        ],
        log: true,
        waitConfirmations: 1,
        skipIfAlreadyDeployed: true,
    });
    console.log("FuulFactory deployed to:", fuulFactoryResult.address);

    // Set the factory address in FuulManager (only if manager was newly deployed)
    if (!fuulManagerResult.newlyDeployed) {
        throw new Error("Fuul manager was not deployed correctly");
    }

    console.log("Setting factory address in FuulManager...");
    const fuulManager = await hre.ethers.getContractAt(
        "FuulManager",
        fuulManagerResult.address,
    );
    const tx = await fuulManager.setFactory(fuulFactoryResult.address);
    await tx.wait();
    console.log("Factory address set in FuulManager");

    console.log("");
    console.log("=== Fuul Contracts Deployment Summary ===");
    console.log("FuulManager:", fuulManagerResult.address);
    console.log("FuulFactory:", fuulFactoryResult.address);
    console.log("ERC20Mock (accepted currency):", erc20Mock.address);
    console.log("Protocol Fee Collector:", deployer);
    console.log("");
};

export default func;
func.tags = ["FuulContracts", "FuulManager", "FuulFactory"];
func.dependencies = ["ERC20Mock"];
