import { HardhatUserConfig } from "hardhat/types";

import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";

import "@typechain/ethers-v6";
import "@typechain/hardhat";

import "hardhat-abi-exporter";
import "hardhat-contract-sizer";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import "hardhat-spdx-license-identifier";

import "solidity-coverage";
import "solidity-docgen";

import { HardhatWithNetworkTypes } from "./types";

import { envConfig } from "./config";

const hardhatConfig: HardhatUserConfig | HardhatWithNetworkTypes = {
    networks: {
        hardhat: {
            accounts: {
                count: 50,
            },
        },
        sepolia: {
            url: "https://sepolia.infura.io/v3/" + envConfig.apis.infura!,
            accounts: envConfig.accounts.testnetAccounts,
        },
        baseSepolia: {
            url: "https://sepolia.base.org",
            accounts: envConfig.accounts.testnetAccounts,
        },
        bscTestnet: {
            url: "https://bsc-testnet-dataseed.bnbchain.org",
            accounts: envConfig.accounts.testnetAccounts,
        },
    },
    solidity: {
        compilers: [
            {
                version: "0.8.30",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 999999,
                    },
                },
            },
        ],
    },

    namedAccounts: {
        deployer: 0,
    },

    mocha: {
        timeout: 1000000,
    },

    // EXTENSIONS

    sourcify: {
        enabled: true,
    },

    etherscan: {
        // list networks: npx hardhat verify --list-networks
        apiKey: {
            sepolia: envConfig.apis.explorers.ethereumMainnet!,

            baseSepolia: envConfig.apis.explorers.baseSepolia!,
            // mainnet: "API_KEY"

            bscTestnet: envConfig.apis.explorers.bscMainnet!,
        },
    },

    typechain: {
        target: "ethers-v6",
    },

    spdxLicenseIdentifier: {
        overwrite: true,
        runOnCompile: true,
    },

    abiExporter: {
        path: "./abi",
        runOnCompile: true,
        clear: true,
        flat: true,
        spacing: 2,
        except: [
            "@openzeppelin/contracts/",
            "@openzeppelin/contracts-upgradeable/",
            "interfaces/",
            "mock/",
            "utils/",
        ],
    },

    gasReporter: {
        currency: "USD",
        coinmarketcap: envConfig.apis.coinmarketcap,
        L2: "base",
        L1Etherscan: envConfig.apis.explorers.ethereumMainnet!,
        L2Etherscan: envConfig.apis.explorers.baseSepolia!,
        excludeContracts: [
            "@openzeppelin/contracts/",
            "@openzeppelin/contracts-upgradeable/",
            "mock/",
            "utils/",
        ],
    },

    contractSizer: {
        runOnCompile: true,
        except: [
            "@openzeppelin/contracts/",
            "@openzeppelin/contracts-upgradeable/",
            "mock/",
            "utils/",
        ],
    },

    docgen: {
        outputDir: "./docgen",
        pages: "files",
        exclude: ["mock/"],
    },
};
export default hardhatConfig;
