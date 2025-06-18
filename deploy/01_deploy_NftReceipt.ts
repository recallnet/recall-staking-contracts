import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { deployProxy, getConfig } from "../deploy-helpers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { get } = deployments;

    const { deployer } = await getNamedAccounts();

    const networkConfig = await getConfig(hre);

    const nftReceiptContract = await ethers.getContractAt(
        "NftReceipt",
        ethers.ZeroAddress,
    );
    const initializeData = (
        await nftReceiptContract.initialize.populateTransaction(deployer)
    ).data;

    console.log("Default admin", deployer);

    await deployProxy(hre, "NftReceipt", [], initializeData);
};
export default func;
func.tags = ["NftReceipt"];
