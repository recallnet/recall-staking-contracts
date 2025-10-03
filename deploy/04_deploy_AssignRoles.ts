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
    const managerAddress = "0x05634A50F64F9be0FdEb944a6A5eC40eD1068A60";
    const emergencyAddress = "0x9331C859E03E158Bff8Ee371c636b7e7FC54E9ad";
    const stakingPauserAddress = "0x9331C859E03E158Bff8Ee371c636b7e7FC54E9ad";
    const stakingUnpauserAddress = "0x05634A50F64F9be0FdEb944a6A5eC40eD1068A60";

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

    const rewardAllocatorAddress = "0x5291a64014b7b8D4B482Ac0de43e1Ebe5892dFF6";
    const fundsManagerAddress = "0x05634A50F64F9be0FdEb944a6A5eC40eD1068A60";
    const rewardAllocationPauserAddress = "0x9331C859E03E158Bff8Ee371c636b7e7FC54E9ad";
    const rewardAllocationUnpauserAddress = "0x05634A50F64F9be0FdEb944a6A5eC40eD1068A60";

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
