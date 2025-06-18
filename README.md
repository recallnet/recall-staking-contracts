## Recall Staking Contracts

### Setup and Deployment

1. Install dependencies

```sh
pnpm i
```

2. Copy `config.example.ts` to `config.ts` and fill in the values:  
   `accounts` - private keys for testnet and mainnet accounts;  
   `apis.infura` - infura API key;  
   `deploy.<network_name>.stakeToken` - stakeToken (Recall token) address.

3. Compile contracts

```sh
npx hardhat compile
```

4. Tests and coverage

```sh
npx hardhat test
```

```sh
npx hardhat coverage
```

5. Deploy contracts

```sh
npx hardhat deploy --network <network_name>
```
