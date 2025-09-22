import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { verify } from "../deploy-helpers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;

    const { deployer } = await getNamedAccounts();
    const ERC20Mock = await deploy("ERC20Mock", {
        from: deployer,
        log: true,
    });

    await verify(hre, ERC20Mock, "ERC20Mock");
};
export default func;
func.tags = ["ERC20Mock"];
