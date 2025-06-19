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

network_name can be `sepolia`, `baseSepolia`, `base`.

### Assigning roles

The contracts roles are assigned in the deployment script (`deploy/04_deploy_AssignRoles.ts`, see L30-L33, L73-76).  
The script is executed automatically during the deployment. Before starting the deployment, you need to set the addresses of the admins for the contracts.

In case you want to assign admins later, you can run the script manually:

```sh
npx hardhat deploy --tags Roles --network <network_name>
```
