import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { deployProxy, getConfig } from "../deploy-helpers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { get } = deployments;

    const { deployer } = await getNamedAccounts();

    const networkConfig = await getConfig(hre);


    const nftReceiptData = await get("NftReceiptProxy");


    const stakingContract = await ethers.getContractAt(
        "Staking",
        ethers.ZeroAddress,
    );
    const initializeData = (
        await stakingContract.initialize.populateTransaction(
            networkConfig.staking.stakeToken,
            nftReceiptData.address,
            deployer,
        )
    ).data;

    console.log("Stake token", networkConfig.staking.stakeToken);
    console.log("NftReceipt", nftReceiptData.address);
    console.log("Default admin", deployer);


    await deployProxy(
        hre,
        "Staking",
        [],
        initializeData,
    );

    const stakingData = await get("StakingProxy");


    const nftReceiptContract = await ethers.getContractAt(
        "NftReceipt",
        nftReceiptData.address,
    );
    const stakingAddress = await nftReceiptContract.staking();

    if (stakingAddress != stakingData.address) {
        if (hre.network.name !== "hardhat") {
            console.log(
                "Setting Staking for the NftReceipt contract...",
            );
        }

        const tx = await nftReceiptContract.setStaking(stakingData.address);

        await tx.wait(networkConfig.waitConfirmations);
    }
};
export default func;
func.tags = ["Staking"];
