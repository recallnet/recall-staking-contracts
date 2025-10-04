import { EnvConfigInterface } from "./types";

export const envConfig: EnvConfigInterface = {
    accounts: {
        // REPLACE with your private key
        testnetAccounts: [
            "1111111111111111111122222222222222222223333333333333333344444444"
        ],
        // REPLACE with your private key
        mainnetAccounts: [
            "1111111111111111111122222222222222222223333333333333333344444444",
        ],
    },

    apis: {
        // Project id from https://infura.io/
        infura: "...",
        apiKey: "...", // Etherscan
        coinmarketcap: "...",
    },

    deploy: {
        baseSepolia: {
            waitConfirmations: 3,
            staking: {
                stakeToken: "0x7323CC5c18DEcCD3e918bbccff80333961d85a88",
            },
        },

        base: {
            waitConfirmations: 3,
            staking: {
                stakeToken: "0x1f16e03C1a5908818F47f6EE7bB16690b40D0671",
            },
        },
    },
};
