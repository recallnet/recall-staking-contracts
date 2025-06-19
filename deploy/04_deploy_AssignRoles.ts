import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { get } = deployments;

    const { deployer } = await getNamedAccounts();

    const stakingData = await get("StakingProxy");
    const stakingContract = await ethers.getContractAt(
        "Staking",
        stakingData.address,
    );

    const rewardAllocationData = await get("RewardAllocationProxy");
    const rewardAllocationContract = await ethers.getContractAt(
        "RewardAllocation",
        rewardAllocationData.address,
    );

    /*****************************
     *
     *  roles for staking contract
     *
     *  **************************/
    const managerAddress = "";
    const emergencyAddress = "";
    const stakingPauserAddress = "";
    const stakingUnpauserAddress = "";

    if (managerAddress) {
        await stakingContract.grantRole(
            await stakingContract.CONTRACT_MANAGER_ROLE(),
            managerAddress,
        );
    } else
        console.log(
            "No manager address set for the staking contract. Add address and re-run deployment script.",
        );

    if (emergencyAddress) {
        await stakingContract.grantRole(
            await stakingContract.EMERGENCY_MANAGER_ROLE(),
            emergencyAddress,
        );
    } else
        console.log(
            "No emergency address set for the staking contract. Add address and re-run deployment script.",
        );

    if (stakingPauserAddress) {
        await stakingContract.grantRole(
            await stakingContract.PAUSER_ROLE(),
            stakingPauserAddress,
        );
    } else
        console.log(
            "No pauser address set for the staking contract. Add address and re-run deployment script.",
        );

    if (stakingUnpauserAddress) {
        await stakingContract.grantRole(
            await stakingContract.UNPAUSER_ROLE(),
            stakingUnpauserAddress,
        );
    } else
        console.log(
            "No unpauser address set for the staking contract. Add address and re-run deployment script.",
        );

    console.log("Roles for Staking contract were assigned successfully.");

    /*****************************
     *
     *  roles for reward allocation contract
     *
     *  **************************/

    const rewardAllocatorAddress = "";
    const fundsManagerAddress = "";
    const rewardAllocationPauserAddress = "";
    const rewardAllocationUnpauserAddress = "";

    if (rewardAllocatorAddress) {
        await rewardAllocationContract.grantRole(
            await rewardAllocationContract.REWARD_ALLOCATOR_ROLE(),
            rewardAllocatorAddress,
        );
    } else
        console.log(
            "No reward allocator address set for the reward allocation contract. Add address and re-run deployment script.",
        );

    if (fundsManagerAddress) {
        await rewardAllocationContract.grantRole(
            await rewardAllocationContract.FUNDS_MANAGER_ROLE(),
            fundsManagerAddress,
        );
    } else
        console.log(
            "No funds manager address set for the reward allocation contract. Add address and re-run deployment script.",
        );

    if (rewardAllocationPauserAddress) {
        await rewardAllocationContract.grantRole(
            await rewardAllocationContract.PAUSER_ROLE(),
            rewardAllocationPauserAddress,
        );
    } else
        console.log(
            "No pauser address set for the reward allocation contract. Add address and re-run deployment script.",
        );

    if (rewardAllocationUnpauserAddress) {
        await rewardAllocationContract.grantRole(
            await rewardAllocationContract.UNPAUSER_ROLE(),
            rewardAllocationUnpauserAddress,
        );
    } else
        console.log(
            "No unpauser address set for the reward allocation contract. Add address and re-run deployment script.",
        );

    console.log(
        "Roles for RewardAllocation contract were assigned successfully.",
    );
};
export default func;
func.tags = ["Roles"];
