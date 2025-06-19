import { EnvConfigInterface } from "./types";

export const envConfig: EnvConfigInterface = {
    accounts: {
        // REPLACE with your private key
        testnetAccounts: ["private key"],
        // REPLACE with your private key
        mainnetAccounts: [
            "1111111111111111111122222222222222222223333333333333333344444444",
        ],
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

        base: {
            waitConfirmations: 3,

            staking: {
                stakeToken: "0x0000000000000000000000000000000000000000",
            },
        },
    },
};
