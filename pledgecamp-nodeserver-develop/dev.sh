#!/bin/bash
# This is just a quick shell script to bootstrap development environment

# Function to check whether command exists or not
exists()
{
  if command -v $1 &>/dev/null
  then
    return 0
  else
    return 1
    fi
}

if exists ganache-cli
  then echo "Ganache found"
  else echo "Ganache not found, exiting"
  exit
fi
if exists npx hardhat
  then echo "Hardhat found"
  else echo "Hardhat not found, exiting"
  exit
fi

INITIAL_SETUP=false
GET_CONTRACTS=false
START_GANACHE=false
if [[ ! -z $1 ]] ; then
  if [ $1 = "-s" ] ; then
    INITIAL_SETUP=true
    GET_CONTRACTS=true
    START_GANACHE=true
  elif [ $1 = "-g" ] ; then
    INITIAL_SETUP=true
    GET_CONTRACTS=true
  elif [ $1 = "-i" ] ; then
    INITIAL_SETUP=true
  elif [ $1 = "-c" ] ; then
    GET_CONTRACTS=true
  fi
fi

if $GET_CONTRACTS ; then

  echo "Retrieving ABI and bytecode"
  cd ../pledgecamp-nodeserver \
  rm ./server/contracts/abi/*
  cp -rf ../pledgecamp-contracts/build/* ./server/contracts/abi/
fi

if $INITIAL_SETUP ; then
  echo "Running Initial Setup"
  echo "Gen environment file"
  cp .env.dist .env
  if [ -f .env.substitute ]; then
    while IFS= read -r line
    do
      ENV_KEY="${line%%=*}"
      sed -i'.swap' "s/${ENV_KEY}=.*/${line}/" .env
    done < .env.substitute
  fi
  npm i
  
  # cd ../pledgecamp-contracts
  # truffle migrate
  # npm run contracts-setup
  cd ../pledgecamp-nodeserver
fi

source .env
if $START_GANACHE ; then
  echo "Current instances of Ganache (if any)"
  ps aux | grep ganache
  echo "Killing current instances of Ganache (if any)"
  kill `ps -ef | grep ganache| awk '/[g]anache/{print $2}'` > /dev/null 2>&1
  ps aux | grep ganache
  echo "Starting ganache with $BLOCKCHAIN_MNEMONIC_PHRASE"
  nohup $NVM_BIN/ganache-cli up -d -m "$BLOCKCHAIN_MNEMONIC_PHRASE" --gasPrice 200000000 --gasLimit 67219750 --port 7545 >/dev/null 2>&1 &
fi
echo "Starting RabbitMQ (Docker) support service"
docker-compose up -d
echo "Run start.js"
npm run migrate
npm run dev
