# Pledgecamp Ethereum Contracts

- [Overview and Architecture](OVERVIEW.md)
- [Contribution Guidelines](CONTRIBUTING.md)

## Hardhat

We use [Hardhat](https://hardhat.org/) for development contract deploy management.

Compile contracts
```
npm run compile
```

## Quickstart

Follow these instructions after checking out the repository to set up a hardhat EVM network (accessible at [localhost:8545](localhost:8545)) running the main hardhat deployment script.

```
./dev.sh -s
```

* Installs NodeJS packages and prepares environment templates
* Builds and deploys contracts to the local Hardhat testing environment

## Environment Variables

* **BLOCKCHAIN_MNEMONIC_PHRASE** - Mnemonic phrase for testing environment
* **BLOCKCHAIN_NETWORK_NAME** - Name of network for contract deployment (dev, hardhat, ropsten, mainnet)
* **CS_UNSTAKE_PERIOD** - Used with Camp Shares deployment (default 30 days)
* **CS_OUTSTANDING_ALLOWANCE** - Used with Camp Shares deployment for the percentage allowance of missed votes for CS holders (default 30 percent)
* **ETHEREUM_ADMIN_WALLET_ADDRESS** - Static Admin Wallet Address for deploy-contracts script
* **ETHEREUM_CONTRACT_TOKEN_ADDRESS** - Static PLGToken Address for deploy-contracts script
* **ETHEREUM_CONTRACT_VERSION** - Version number of contracts for backup-contracts script
* **ETHEREUM_CONTRACTS_SOURCE_PATH** - Source folder path for backups
* **ETHEREUM_CONTRACTS_VERSION_PATH** - Folder path for contract backups to be stored
* **ETHEREUM_RPC_PROVIDER_HOST** - RPC provider host
* **ETHEREUM_RPC_PROVIDER_METHOD** - RPC provider method (http, ws, ipc)
* **ETHEREUM_RPC_PROVIDER_PORT** - Port used by RPC provider
* **ETHEREUM_RPC_PROVIDER_URL** - Full path to RPC provider
* **EVM_LOGGING** - Hardhat logging flag
* **INFURA_API_KEY** - Infura API Key
* **NODE_ENV** - Current node environment
* **PLGTOKEN_ALLOCATION_AMOUNT** - For dev deployment of PLGToken to initial accounts
* **PLGTOKEN_USER_ALLOCATIONS** - For dev deployment of PLGToken to indicate number of wallets to allocate tokens to
* **TEST_NUMBER_ADDRESSES_UNLOCK** - Number of addresses to unlock tokens for in dev PLGToken deployment
* **TEST_REPORT_GAS** - Report gas usage for contract deploys and method calls in tests
* **WALLET_KEY** - Private keys for test network wallets


## Testing

Javascript tests
```
npm run test
```

OR

To run specific test (or tests)
```
npx hardhat test test/[filename].js
```

Solidity code coverage
```
npm run test:coverage
```

## Linting

Javascript linting
```
npm run lint
```

Solidity linting
```
npm run lint:solidity
```

## Backup contracts

Be sure to update the `ETHEREUM_CONTRACT_VERSION` and the `ETHEREUM_CONTRACTS_VERSION_PATH` path extension in the `.env` file and then run the following to backup contracts by version ID.

```
npm run backup-contracts
```

## Deploy contracts

Running the following will perform the initial deployment and setup of contracts and balances.
```
npm run deploy-contracts
```

NOTE: For Ropsten and Mainnet, there is no need to deploy the PLGToken contract, therefore it can be excluded in the deployment config settings.

### Building the container

Due to this project making use of protected repositories on Github, the container building procedure imports an SSH key to the build process through the `SSH_PRIVATE_KEY` argument which should be provided as a string.

For security sake, this key is removed from the container by using a multi-stage build. An example of building the container where your SSH key is in standard location is as follows

```
docker build \
    -t pledgecamp/pledgecamp-contracts:develop \
    --build-arg SSH_PRIVATE_KEY="$(cat ~/.ssh/id_rsa)" \
    .
```

## Set allowances for newly created project Contracts

The allowances for funds going from the funding wallet into the newly created project contracts must be set before running the `setBackers()` function.  The `ETHEREUM_CONTRACT_PROJECT_ADDRESS` of the newly created project must be updated in the `.env` first and then the `npm run set-allowance` can be run to set the allowance for the project contract.

## Static Analysis

TBD: Due to the fragility of setup it's probably better to use Mythril's docker image.

1. Install LevelDB version 1.22, Python 3.8, and [Poetry](https://python-poetry.org/docs/#installation)

2. Install packages
```
cd analysis
poetry install
```

Some packages may fail to install due to missing headers. These may need to be installed manually, after installing the necessary libraries and pointing to the headers. For example, to install `plyvel` on OSX with Apple silicon:
```
brew install leveldb
poetry shell
env LDFLAGS="-L$(brew --prefix leveldb)/lib" CFLAGS="-I$(brew --prefix leveldb)/include" pip install plyvel==1.3.0
```

3. Get a local version of solc. Make sure it's the same version used in the contracts. `solc-select` is included in the `analysis` packages,
   so you can do:
```
cd analysis
poetry run solc-select install 0.8.3
poetry run solc-select use 0.8.3
poetry run solc --version
```

**Run Mythril**

This may take a while, depending on your resources.
```
poetry run python analysis.py mythril
```

Check latest options:
```
poetry run python analysis.py mythril --help
```

**Run Slither**

```
poetry run python analysis.py slither
```

Check latest options:
```
poetry run python analysis.py slither --help
```
