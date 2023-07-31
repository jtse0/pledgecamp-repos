#!/bin/bash

# Wait until postgres is ready
echo -ne "Waiting for PostgreSQL"
until pg_isready -h 127.0.0.1
do
    echo -ne "."
    sleep 1
done
echo "OK"
