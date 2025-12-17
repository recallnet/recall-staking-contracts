import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

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
};

export default func;
func.tags = ["ERC20Mock"];
