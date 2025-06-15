import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { deployProxy, getConfig } from "../deploy-helpers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { get } = deployments;

    const { deployer } = await getNamedAccounts();


    const rewardAllocationContract = await ethers.getContractAt(
        "RewardAllocation",
        ethers.ZeroAddress,
    );
    const initializeData = (
        await rewardAllocationContract.initialize.populateTransaction(
            deployer,
        )
    ).data;

    console.log("Default admin", deployer);

    await deployProxy(
        hre,
        "RewardAllocation",
        [ ],
        initializeData,
    );
};
export default func;
func.tags = ["RewardAllocation"];
