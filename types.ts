import { HttpNetworkUserConfig } from "hardhat/types";

export enum NETWORKS {
    hardhat = "hardhat",
    localhost = "localhost",
    ganache = "ganache",
    ethereumMainnet = "ethereumMainnet",
    goerli = "goerli",
    sepolia = "sepolia",
    bscMainnet = "bscMainnet",
    bscTestnet = "bscTestnet",
    polygonMainnet = "polygonMainnet",
    polygonTestnet = "polygonTestnet",
    baseSepolia = "baseSepolia",
    baseMainnet = "baseMainnet",
}

export interface HardhatWithNetworkTypes {
    networks: NetworkTypes;
}

export type NetworkTypes = {
    [network in NETWORKS]?: HttpNetworkUserConfig;
} & {
    [others: string]: HttpNetworkUserConfig;
};

export interface EnvConfigInterface {
    [others: string]: any;

    accounts: {
        testnetAccounts: [string];
        mainnetAccounts: [string];
    };

    apis: {
        infura?: string;
        explorers: {
            [network in NETWORKS]?: string;
        } & {
            [others: string]: string;
        };
        coinmarketcap: string;
    };

    deploy: {
        [network in NETWORKS]?: NetworkConfigInterface;
    } & {
        [others: string]: NetworkConfigInterface;
    };
}

export interface NetworkConfigInterface {
    waitConfirmations: number;

    staking: {
        stakeToken: string;
    };
}
