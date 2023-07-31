# Pledgecamp Node Server

## Quickstart

- Make sure the [Pledgecamp Contracts](https://github.com/pledgecamp/pledgecamp-contracts) repo is checked out
- Obtain an EthGasStation API key and create a `.env.substitute` file with `ETHEREUM_GAS_API_KEY` key. Make sure there is an empty line at the end of the file.
- Run `./dev.sh -s`

## Dev script options

- `{WITHOUT OPTIONS / Every time}` - Sources the environment file, starts up Ganache in background, and runs the Node server with nodemon
- `-s` - Initial setup. Copies environment file from dist, runs node install, migrates DB, builds contracts for consumption
- `-i` - Install. Like initial setup without the contract parts
- `-c` - Contracts. Prepares contracts for consumption within the project

## Running test mode

- Grab the latest contracts by running `./dev.sh -c`, or `./dev.sh -s` if you want to perform all startup tasks.
- Run tests using the command `npm run test`

### Overview of dev.sh quickstart script flow

1. Ensures all prerequisite applications are present and exits if not
2. Starts up docker container
3. Checks for script parameters in run and checks for `-s`, `-i`, or `-c` to see if initial setup and/or contract ABI extraction is required. If required, environment files will be generated, node modules will be installed, migrations will be generated, and contract ABIs will be extracted.
4. Starts up ganache environment
5. Starts up start.js script

## Key directories

- ./server - Constants related to gas calculations, errors, and various statuses
- ./server/cli - Contains RabbitMQ task handlers
- ./server/contracts/abi - Contract json files from contracts repo
- ./server - Project functions that access contract functions
- ./server/controllers - Controller functions for incoming requests, and parameter variables to send them to project functions
- ./server/db - Migration files and db file for SQLite database
- ./server.models - Database model structures
- ./server/modules - Common functions related to Eth Web3
- ./server/routes - Defines API paths for incoming requests
- ./server/utils - Common utility functions related to errors, logging, and queue handling
- ./tests - All testing files for Nodeserver

## Environment variables Explanation

### MANDATORY

- **BLOCKCHAIN_MNEMONIC_PHRASE** - 24 word mnemonic phrase
- **BLOCKCHAIN_MNEMONIC_PASS** - Wallet password
- **ETHEREUM_CONTRACT_ACCOUNT_MANAGER_ADDRESS** - Deployed Account Manager contract address
- **ETHEREUM_CONTRACT_ACCOUNT_STORAGE_ADDRESS** - Deployed Account Storage contract address
- **ETHEREUM_CONTRACT_ADMINISTRATOR_ADDRESS** - Deployed Administrator contract address
- **ETHEREUM_CONTRACT_CAMPSHARE_MANAGER_ADDRESS** - Deployed CampShare Manager contract address
- **ETHEREUM_CONTRACT_CAMPSHARE_STORAGE_ADDRESS** - Deployed CampShare Storage contract address
- **ETHEREUM_CONTRACT_MODERATOR_ADDRESS** - Deployed Moderator contract address
- **ETHEREUM_CONTRACT_TOKEN_ADDRESS** - Deployed PLG Token contract address
- **ETHEREUM_ADMIN_WALLET_INDEX** - Admin wallet BIP index

### AUTHENTICATION

- **APP_AUTH_ACCESS_TOKEN** - Authentication key for external services accessing the Nodeserver
- **APP_AUTH_INTERNAL_ACCESS_TOKEN** - Authentication key to access the Backend
- **ORACLE_AUTH_ACCESS_TOKEN** - Authentication key to access the Oracle

### ENVIRONMENT

- **DB_HOST** - Database host address
- **DB_NAME** - PostgreSQL database name
- **DB_PORT** - Database port
- **DB_USER** - Database username
- **DB_PASS** - Database password
- **RABBITMQ_HOST** - RabbitMQ host address
- **RABBITMQ_PORT** - RabbitMQ port
- **RABBITMQ_USER** - RabbitMQ username
- **RABBITMQ_PASS** - RabbitMQ password
- **RABBITMQ_QUEUE_TRANSACTIONS** - RabbitMQ queue name
- **RABBITMQ_WAIT_THRESHOLD** - Amount of time RabbitMQ will wait before its next retry
- **RABBITMQ_WAIT_ATTEMPTS** - Number of retries that RabbitMQ will repeat before deeming transaction to be timed out
- **ETHEREUM_RPC_PROVIDER_URL** - Provider address for Web3
- **ETHEREUM_RPC_PROVIDER_METHOD** - Provider connection method for Web3

### GAS CALCULATION

- **ETHEREUM_GAS_API_URL** - URL for EthGasStation API
- **ETHEREUM_GAS_API_KEY** - EthGasStation API key
- **ETHEREUM_GAS_OPS_LV1** - Level 1 (highest) level operational factor for gas calculation (based on functional complexity)
- **ETHEREUM_GAS_OPS_LV2** - Level 2 level operational factor for gas calculation (based on functional complexity)
- **ETHEREUM_GAS_OPS_LV3** - Level 3 level operational factor for gas calculation (based on functional complexity)
- **ETHEREUM_GAS_OPS_LV4** - Level 4 level operational factor for gas calculation (based on functional complexity)
- **ETHEREUM_GAS_OPS_LV5** - Level 5 level operational factor for gas calculation (based on functional complexity)
- **ETHEREUM_GAS_OPS_LV6** - Level 6 (lowest) level operational factor for gas calculation (based on functional complexity)
- **ETHEREUM_BLOCK_TIME** - Expected time to wait for a block to complete confirmation process
- **ETHEREUM_CONFIRMATIONS_NEEDED** - Expected number of confirmation to wait for before deeming transaction as confirmed and complete
- **ETHEREUM_GAS_LEVEL_CRITICAL** - When a wallet balance has passed this critically low balance threshold a warning message will be triggered to alert the user. This value is a representation of the absolute wallet balance value in wei.
- **ETHEREUM_GAS_LEVEL_WARNING_PERCENT** - When a wallet balance has passed this low balance threshold a warning message will be triggered to alert the user. This value is the representation of a certain percentage (value in whole numbers) above the critical gas level.

### ETHEREUM

- **ETHEREUM_BIP_TOKEN_INDEX** - BIP token index for Ethereum
- **ETHEREUM_ADMIN_WALLET_INDEX** - Ethereum admin wallet index
- **ETHEREUM_FUNDING_WALLET_INDEX** - Ethereum funding wallet index
- **ETHEREUM_BIP_CHANGE_INDEX** - Ethereum BIP change index
- **ETHEREUM_NETWORK_ID** - Network ID setting
- **ETHEREUM_TOKEN_SYMBOL** - Ethereum token symbol for PLG
- **ETHEREUM_DECIMAL_PLACES** - Number of decimal places for ERC20 token

### MISC

- **PROJECT_MILESTONE_INTERVAL_MAXIMUM** - Maximum time gap (in seconds) between milestone dates
- **PROJECT_MILESTONE_INTERVAL_MINIMUM** - Minimum time gap (in seconds) between milestone dates
- **PROJECT_RELEASE_PERCENT_MAXIMUM** - Maximum value (in whole numbers) for any individual release percent
- **PROJECT_RELEASE_PERCENT_MINIMUM** - Minimum value (in whole numbers) for any individual release percent
- **TRANSACTION_RETRIES** - Number of retries to process a transaction on the blockchain
- **INTERVALS_ETHEREUM_GAS_PRICE_CHECK** - Setting of time interval between each extraction of gas prices from EthGasStation
- **ETHEREUM_GAS_OPS_FLAG** - Flag to trigger warnings and stop transactions when admin wallet is critically low in balance
- **APP_LOG_LEVEL** - Settings for the logger level (default to debug in development environment)
- **APP_PORT** - Setting for Nodeserver application port
- **ETHEREUM_CONTRACTS_PATH** - Path pointing to contract ABI json files

## Installation

**Install Docker**
https://www.docker.com/products/docker-desktop

**Install knex and ganache-cli globally**

```
npm install -g knex
npm install -g ganache-cli
```

## Miscellaneous

**Update contract ABIs**

This assumes the `pledgecamp-contracts` repo is in a folder called `contract`, and located in the directory above
this one. If your setup is different, adjust the script location. It also assumes the script is called from the root of this repo.

```
node ../pledgecamp-contracts/scripts/minify-contracts.js --abi --contracts AccountManager.sol AccountStorage.sol Administrator.sol CampShareManager.sol CampShareStorage.sol PLGProject.sol PLGToken.sol Moderator.sol --output ./server/contracts/abi/
```

### Building the container

Due to this project making use of protected repositories on Github, the container building procedure imports an SSH key to the build process through the `SSH_PRIVATE_KEY` argument which should be provided as a string.

For security sake, this key is removed from the container by using a multi-stage build. Example of building the container with SSH key in a standard location:

```
docker build \
    -t pledgecamp/pledgecamp-nodeserver:develop \
    --build-arg "SSH_PRIVATE_KEY=$(cat ~/.ssh/github)" \
    .
```

## API Endpoints

- Refer to `openapi.yaml` for information on Nodeserver endpoints and models.
