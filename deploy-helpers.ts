import { Interface, LogDescription, TransactionReceipt } from "ethers";
import { ethers, run } from "hardhat";
import { DeployResult, Deployment } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { envConfig } from "./config";
import { NETWORKS, NetworkConfigInterface } from "./types";

import { default as ProxyAdminABI } from "./artifacts/@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol/ProxyAdmin.json";

export async function getConfig(
    hre: HardhatRuntimeEnvironment,
): Promise<NetworkConfigInterface> {
    const networkName = hre.network.name;

    if (!(networkName in NETWORKS)) {
        throw Error(
            "The " + networkName + " network isn't supported (type NETWORKS)",
        );
    }

    const networkConfig = envConfig.deploy[<NETWORKS>networkName];
    if (!networkConfig) {
        if (networkName == "hardhat") {
            const defaultNetworkConfig = await getDefaultNetworkConfig(hre);

            await checkNetworkConfig(defaultNetworkConfig);

            return transformNetworkConfig(hre, defaultNetworkConfig);
        } else {
            throw Error("No config for the " + networkName + " network");
        }
    }

    await checkNetworkConfig(networkConfig);

    return transformNetworkConfig(hre, networkConfig);
}

let defaultNetworkConfig: NetworkConfigInterface | undefined;

export function setDefaultNetworkConfig(
    newDefaultNetworkConfig: NetworkConfigInterface,
) {
    defaultNetworkConfig = newDefaultNetworkConfig;
}

export async function getDefaultNetworkConfig(
    hre: HardhatRuntimeEnvironment,
): Promise<NetworkConfigInterface> {
    if (defaultNetworkConfig) {
        return defaultNetworkConfig;
    }

    defaultNetworkConfig = {
        waitConfirmations: 0,

        staking: {
            stakeToken: "0x5B46363bb89D850E5da271363274e19F9392488D",
        },
    };

    return defaultNetworkConfig;
}

async function checkNetworkConfig(networkConfig: NetworkConfigInterface) {
    if (networkConfig.waitConfirmations < 0) {
        throw Error("Negative waitConfirmations");
    }
}

async function transformNetworkConfig(
    hre: HardhatRuntimeEnvironment,
    networkConfig: NetworkConfigInterface,
): Promise<NetworkConfigInterface> {
    return networkConfig;
}

export async function deployBeaconProxy(
    hre: HardhatRuntimeEnvironment,
    contractName: string,
    constructorArgs: any[],
    needToVerifyImplementation = true,
): Promise<void> {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;

    const { deployer } = await getNamedAccounts();

    const networkConfig = await getConfig(hre);

    const contractImplementationData = await deploy(
        contractName + "Implementation",
        {
            contract: contractName,
            from: deployer,
            args: constructorArgs,
            log: true,
            waitConfirmations: networkConfig.waitConfirmations,
            skipIfAlreadyDeployed: true,
        },
    );

    const contractUpgradeableBeaconData = await deploy(
        contractName + "UpgradeableBeacon",
        {
            contract: "UpgradeableBeacon",
            from: deployer,
            args: [
                contractImplementationData.address, // implementation
                deployer, // initialOwner
            ],
            log: true,
            waitConfirmations: networkConfig.waitConfirmations,
            skipIfAlreadyDeployed: true,
        },
    );

    if (!contractUpgradeableBeaconData.newlyDeployed) {
        const contractUpgradeableBeaconContract = await ethers.getContractAt(
            "UpgradeableBeacon",
            contractUpgradeableBeaconData.address,
        );

        const implementationAddress =
            await contractUpgradeableBeaconContract.implementation();

        if (implementationAddress !== contractImplementationData.address) {
            const ownerAddress =
                await contractUpgradeableBeaconContract.owner();

            if (ownerAddress != deployer) {
                throw new Error(
                    `Can not upgrade the ${contractName} UpgradeableBeacon ${contractUpgradeableBeaconData.address}, not the owner`,
                );
            }

            const networkName = hre.network.name;
            if (
                networkName != "hardhat" &&
                networkName != "ganache" &&
                networkName != "localhost"
            ) {
                console.log(
                    `Upgrading the ${contractName} UpgradeableBeacon ${contractUpgradeableBeaconData.address} to ${contractImplementationData.address} implementation address...`,
                );
            }

            const tx = await contractUpgradeableBeaconContract.upgradeTo(
                contractImplementationData.address,
            );

            await tx.wait(networkConfig.waitConfirmations);
        }
    }

    if (needToVerifyImplementation) {
        await verify(
            hre,
            contractImplementationData,
            contractName + "Implementation",
        );
    }

    await verify(
        hre,
        contractUpgradeableBeaconData,
        contractName + "UpgradeableBeacon",
    );
}

export async function deployProxy(
    hre: HardhatRuntimeEnvironment,
    contractName: string,
    constructorArgs: (string | bigint | number)[],
    initializeData: string,
): Promise<void> {
    const { deployments, getNamedAccounts } = hre;
    const { deploy, get } = deployments;

    const { deployer } = await getNamedAccounts();

    const networkConfig = await getConfig(hre);

    const contractImplementationData = await deploy(
        contractName + "Implementation",
        {
            contract: contractName,
            from: deployer,
            args: constructorArgs,
            log: true,
            waitConfirmations: networkConfig.waitConfirmations,
            skipIfAlreadyDeployed: true,
        },
    );

    const contractProxyData = await deploy(contractName + "Proxy", {
        contract: "TransparentUpgradeableProxy",
        from: deployer,
        args: [
            contractImplementationData.address, // logic
            deployer, // admin
            initializeData, // data
        ],
        log: true,
        waitConfirmations: networkConfig.waitConfirmations,
        skipIfAlreadyDeployed: true,
    });

    await saveProxyAdminDeploymentForProxy(
        hre,
        contractProxyData,
        contractName + "ProxyAdmin",
    );

    const contractProxyAdminData = await get(contractName + "ProxyAdmin");
    if (!contractProxyData.newlyDeployed) {
        const implementationAddress =
            await getImplementationAddressFromTransparentUpgradeableProxy(
                contractProxyData.address,
            );

        if (implementationAddress != contractImplementationData.address) {
            const contractProxyAdminContract = await ethers.getContractAt(
                "ProxyAdmin",
                contractProxyAdminData.address,
            );

            const ownerAddress = await contractProxyAdminContract.owner();

            if (ownerAddress != deployer) {
                throw new Error(
                    `Can not upgrade the ${contractName} TransparentUpgradeableProxy ${contractProxyData.address}, not the owner`,
                );
            }

            const networkName = hre.network.name;
            if (
                networkName != "hardhat" &&
                networkName != "ganache" &&
                networkName != "localhost"
            ) {
                console.log(
                    `Upgrading the ${contractName} TransparentUpgradeableProxy ${contractProxyData.address} to ${contractImplementationData.address} implementation address...`,
                );
            }

            const tx = await contractProxyAdminContract.upgradeAndCall(
                contractProxyData.address,
                contractImplementationData.address,
                "0x",
            );

            await tx.wait(networkConfig.waitConfirmations);
        }
    }

    await verify(
        hre,
        contractImplementationData,
        contractName + "Implementation",
    );
    await verify(hre, contractProxyData, contractName + "Proxy");
    await verify(hre, contractProxyAdminData, contractName + "ProxyAdmin");
}

export async function saveProxyAdminDeploymentForProxy(
    hre: HardhatRuntimeEnvironment,
    proxyDeploymentData: DeployResult,
    name: string,
): Promise<void> {
    const { deployments } = hre;
    const { save, getOrNull } = deployments;

    const proxyDeployTx = (await ethers.provider.getTransactionReceipt(
        proxyDeploymentData.transactionHash!,
    ))!;

    const transparentUpgradeableProxyFactory = await ethers.getContractFactory(
        "TransparentUpgradeableProxy",
    );

    const proxyAdminChangedEvent = findEventInTx(
        proxyDeployTx,
        transparentUpgradeableProxyFactory.interface,
        "AdminChanged",
    )!;
    const { newAdmin: proxyAdminAddress } = proxyAdminChangedEvent.args;

    const oldProxyAdminData = await getOrNull(name);
    if (oldProxyAdminData && oldProxyAdminData.address == proxyAdminAddress) {
        return;
    }

    const proxyAdminFactory = await ethers.getContractFactory("ProxyAdmin");
    const proxyAdminArgs = [proxyDeploymentData.args![1]];

    await save(name, {
        address: proxyAdminAddress,
        abi: ProxyAdminABI.abi,
        args: proxyAdminArgs,
        transactionHash: proxyDeployTx.hash,
        bytecode: proxyAdminFactory.interface.encodeDeploy(proxyAdminArgs),
        deployedBytecode: await ethers.provider.getCode(proxyAdminAddress),
    });
}

export function findEventInTx(
    tx: TransactionReceipt,
    contractInterface: Interface,
    eventName: string,
): LogDescription | undefined {
    const result = tx.logs
        .map((event) => {
            return contractInterface.parseLog(event);
        })
        .find((parsedEvent) => {
            if (parsedEvent === null) {
                return false;
            }

            if (parsedEvent.name == eventName) {
                return true;
            } else {
                return false;
            }
        });

    if (result !== undefined && result !== null) {
        return result;
    } else {
        return undefined;
    }
}

export async function verify(
    hre: HardhatRuntimeEnvironment,
    deployResult: DeployResult | Deployment,
    contractName: string,
) {
    const networkName = hre.network.name;
    if (
        networkName != "hardhat" &&
        networkName != "ganache" &&
        networkName != "localhost"
    ) {
        console.log(`Verifying contract ${contractName}...`);

        await verifyInternal(deployResult.address, deployResult.args ?? []);
    }
}

async function verifyInternal(
    contractAddress: string,
    args: any[],
    tryNumber = 1,
) {
    try {
        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: args,
            force: false,
        });
        console.log("Contract is Verified");
    } catch (error: any) {
        console.log("Failed in plugin", error.pluginName);
        console.log("Error name", error.name);
        console.log("Error message", error.message);

        if (tryNumber >= 4) {
            return;
        }
        if (error.message.includes("is already verified")) {
            return;
        }

        await sleep(500); // 0.5s

        await verifyInternal(contractAddress, args, tryNumber + 1);
    }
}

export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getImplementationAddressFromTransparentUpgradeableProxy(
    proxyAddress: string,
): Promise<string> {
    const implementationStorageSlot = await ethers.provider.getStorage(
        proxyAddress,
        "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
    );

    return ethers.AbiCoder.defaultAbiCoder().decode(
        ["address"],
        implementationStorageSlot,
    )[0];
}
