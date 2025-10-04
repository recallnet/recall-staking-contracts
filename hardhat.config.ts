import { HardhatUserConfig } from "hardhat/types";

import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "@nomicfoundation/hardhat-ledger";

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
        baseSepolia: {
            url: "https://base-sepolia.infura.io/v3/" + envConfig.apis.infura!,
            accounts: envConfig.accounts.testnetAccounts,
        },
        baseMainnet: {
            url: "https://base-mainnet.infura.io/v3/" + envConfig.apis.infura!,
            accounts: envConfig.accounts.mainnetAccounts,
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
        apiKey: envConfig.apis.apiKey,
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
        L1Etherscan: envConfig.apis.apiKey!,
        L2Etherscan: envConfig.apis.apiKey!,
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
