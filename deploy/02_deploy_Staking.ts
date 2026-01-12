import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DAY_SEC } from "../constants";
import { deployProxy, getConfig } from "../deploy-helpers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { get } = deployments;

    const { deployer } = await getNamedAccounts();

    const networkConfig = await getConfig(hre);

    // Use deployed mock token for docker/hardhat, otherwise use config
    let stakeTokenAddress: string;
    if (hre.network.name === "docker" || hre.network.name === "hardhat") {
        const erc20MockData = await get("ERC20Mock");
        stakeTokenAddress = erc20MockData.address;
    } else {
        stakeTokenAddress = networkConfig.staking.stakeToken;
    }

    const nftReceiptData = await get("NftReceiptProxy");

    const stakingContract = await ethers.getContractAt(
        "Staking",
        ethers.ZeroAddress,
    );
    const initializeData = (
        await stakingContract.initialize.populateTransaction(
            stakeTokenAddress,
            nftReceiptData.address,
            deployer,
        )
    ).data;

    console.log("Stake token", stakeTokenAddress);
    console.log("NftReceipt", nftReceiptData.address);
    console.log("Default admin", deployer);

    await deployProxy(hre, "Staking", [], initializeData);

    const stakingData = await get("StakingProxy");

    const nftReceiptContract = await ethers.getContractAt(
        "NftReceipt",
        nftReceiptData.address,
    );
    const stakingAddress = await nftReceiptContract.staking();

    const realStakingContract = await ethers.getContractAt(
        "Staking",
        stakingAddress,
    );
    await realStakingContract.setAllowedDuration(30 * DAY_SEC, true);

    if (stakingAddress != stakingData.address) {
        if (hre.network.name !== "hardhat") {
            console.log("Setting Staking for the NftReceipt contract...");
        }

        const tx = await nftReceiptContract.setStaking(stakingData.address);

        await tx.wait(networkConfig.waitConfirmations);
    }
};
export default func;
func.tags = ["Staking"];
