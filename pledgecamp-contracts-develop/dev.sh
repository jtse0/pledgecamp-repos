#!/bin/bash

INITIAL_SETUP=false
BLOCK_TIME=0

# Command help
display_usage() {
  echo "Get a basic environment up and running to use for Pledgecamp Contracts"
  echo ""
  echo " -s --setup              Perform an initial setup"
  echo " -b --blocktime          Set blocktime for blockchain"
  halt
}

# Parameter parsing
for argument in "$@"; do
  case "$argument" in
    --setup|-s)
      INITIAL_SETUP=true
      ;;
  esac
  shift
done

if $INITIAL_SETUP ; then
  echo "Running Initial Setup"
  echo "Gen environment file"
  cp .env.dist .env
  npm i
fi

nohup npx hardhat node /
npx hardhat run --network localRPC scripts/deploy.js
