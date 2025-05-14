import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getConfig, verify } from "../deploy-helpers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;

    const { deployer } = await getNamedAccounts();

    const networkConfig = await getConfig(hre);

    const testData = await deploy("Test", {
        from: deployer,
        args: [],
        log: true,
        waitConfirmations: networkConfig.waitConfirmations,
        skipIfAlreadyDeployed: true,
    });

    await verify(hre, testData, "Test");
};
export default func;
func.tags = ["Test"];
