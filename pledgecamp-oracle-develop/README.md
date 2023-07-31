# Pledgecamp Oracle

The Oracle is a service that sits behind the main Pledgecamp API and is responsible for the live tracking of projects and their progress on the blockchain in a neutral manner. Main features of the Oracle includes:

* Launching projects and handling ongoing work with the blockchain
* Providing an API to fetch up-to-date state information on a given project
* Providing an API to fetch up-to-date state information on user's Camp Share transactions
* Providing an extra layer to both sanitize and audit contract operations

The Oracle is built around the following libraries:

* [Gin Gonic](https://gin-gonic.com/) - A fast, lightweight web framework for writing the API features in
* [AfterFunc](https://golang.org/pkg/time/#AfterFunc) - Used for running operations on the contracts as milestone moments
* [PostgreSQL](https://www.postgresql.org/) - Data persistence layer
* [GoLang Migrate](https://github.com/golang-migrate/migrate/releases) - Database migration library

## Quickstart

* Make sure Migrate is setup `cd $GOPATH && go get -tags 'postgres' -u github.com/golang-migrate/migrate/cmd/migrate`
* Run `./dev.sh -s`

## Dev script options

* `{WITHOUT OPTIONS / Every time}` - Sources the environment file, starts up Ganache in background, and runs the Node server with nodemon
* `-s` - Initial setup. Copies environment file from dist, runs node install, migrates DB, builds contracts for consumption

## Running test mode

* When running unit tests, please be sure to update the following in the `.env` file:
1. Change `ENV_MODE` to `test`
2. Change paths (BACKEND_HOST, NODESERVER_HOST, etc...) from `https` to `http`
3. Change `DB_NAME` from `pledgecamp_oracle` to `pledgecamp_oracle_test`
4. Run `./dev.sh` to perform prelim setup of containers and services before running tests.
5. For tests on the models, navigate to `/models` folder and run `go test`.  

For tests on everything else, navigate to `/utils` folder and run `go test`.


### Overview of dev.sh quickstart script flow
1. Checks to make sure that all prerequisite applications are present and exits if any are missing
2. Starts up docker container
3. Checks for script parameters in run and checks for `-s` to see if initial setup is required. If required, environment files will be generated and node modules will be installed.
4. Starts up ganache environment
5. Starts up start.js script - the database migrations will be run and the oracle watcher will be switched on.

## Key directories

* ./constants - Contains definitions for various statuses and state constants for proper categorization of information
* ./db/migrations - Contains migration files for all database tables
* ./handlers - Handles the routing of request paths to utility functions that execute on incoming requests
* ./models - Models that correspond to the Oracle database tables
* ./structs - Structures that correspond to the format of all incoming/outgoing requests
* ./utils - Functions that execute on incoming requests to communicate with the Nodeserver and Backend
    - `utils_warmup.go` controls all Oracle interval tasks

## Environment variables Explanation

### MANDATORY

* **APP_AUTH_ACCESS_TOKEN** - Authentication token for incoming requests
* **APP_DOMAIN** - Oracle URL
* **APP_PORT** - Oracle port setting
* **BACKEND_AUTH_ACCESS_TOKEN** - Authentication token for requests to the Backend
* **BACKEND_URL** - Backend URL
* **NODESERVER_AUTH_ACCESS_TOKEN** - Authentication token for requests to the Nodeserver
* **NODESERVER_URL** - Nodeserver URL

### ENVIRONMENT

* **ENV_MODE** - Current environment mode
* **GIN_MODE** - Gin Gonic mode setting
* **DB_MIGRATIONS_PATH** - Location of db migration scripts
* **CORS_ALLOWED_ORIGINS** - CORS settings
* **DB_NAME** - PostgreSQL DB schema name
* **DB_HOST** - PostgreSQL DB host
* **DB_PORT** - PostgreSQL DB port
* **DB_USER** - PostgreSQL DB username
* **DB_PASS** - PostgreSQL DB password
* **DB_SSL_MODE** - PostgreSQL SSL mode setting

### CONTRACT_PARAMETERS

* **INTERVALS_CHECK_MILESTONE** - Interval in seconds for milestone check job
* **INTERVALS_RECEIVE_INTEREST** - Interval in seconds for interest check job
* **INTERVALS_FUND_RECOVERY**  - Interval in seconds for failed fund recovery check job
* **INTERVALS_CANCEL_PROJECT** - Interval in seconds for project cancellation check job

## API Endpoints

* Please refer to `openapi.yaml` for information on all relevant Oracle endpoints and models.