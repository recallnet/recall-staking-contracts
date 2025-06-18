import { EnvConfigInterface } from "./types";

export const envConfig: EnvConfigInterface = {
    accounts: {
        testnetAccounts: ["private key"],
        mainnetAccounts: ["private key"],
    },

    apis: {
        // Project id from https://infura.io/
        infura: "abcd1234...",
        explorers: {
            // for https://etherscan.io/
            ethereumMainnet: "abcd1234...",

            // for https://bscscan.com/
            bscMainnet: "abcd1234...",

            // for https://polygonscan.com/
            polygonMainnet: "abcd1234...",
        },
        coinmarketcap: "abcd1234...",
    },

    deploy: {
        baseSepolia: {
            waitConfirmations: 3,

            staking: {
                stakeToken: "0x5B46363bb89D850E5da271363274e19F9392488D",
            },
        },
    },
};
