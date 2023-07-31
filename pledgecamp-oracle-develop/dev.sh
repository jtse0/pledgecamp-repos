#!/bin/bash
#!/
#!/# Author Simon Ball <contact@simonball.me>
# This is just a quick shell script to bootstrap Docker Symfony projects

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

# Start by checking whether docker and docker-compose exist
if exists go
  then echo "go found"
  else echo "go not found, exiting"
  exit
fi

if exists watcher
  then echo "watcher found"
  else 
    go get github.com/canthefason/go-watcher
    go install github.com/canthefason/go-watcher/cmd/watcher
fi

if exists docker
  then echo "Docker found"
  else echo "Docker not found, exiting"
  exit
fi

if exists docker-compose
  then echo "Docker-compose found"
  else echo "Docker-compose not found, exiting"
  exit
fi

# Check if initial setup
INITIAL_SETUP=false

if [[ ! -z $1 ]] ; then
  if [ $1 = "-s" ] ; then
    INITIAL_SETUP=true
  fi
fi

if $INITIAL_SETUP ; then
  echo "--- Running Initial Setup ---"
  docker-compose down -v
  cp .env.dist .env
  echo "--- Initial Setup Complete ---"
fi
echo "Starting containers"
docker-compose up -d
# ./config/postgres_wait.sh
echo "Starting Go"
go run main.go
