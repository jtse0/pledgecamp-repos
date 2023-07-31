package connect

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

func init() {
	err := godotenv.Load("./.env")
	if err != nil {
		err2 := godotenv.Load("../.env")
		if err2 != nil {
			log.Printf("connect.go - No .env file found, %v \n", err2)
		}
	}
}

func LookupEnvOrExit(key string) string {
	value, success := os.LookupEnv(key)
	if !success {
		log.Print("Could not obtain " + key)
		os.Exit(1)
	}
	return value
}
