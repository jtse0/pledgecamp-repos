package connect

import (
	"log"
	"os"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"upper.io/db.v3/lib/sqlbuilder"
	"upper.io/db.v3/postgresql"
)

var DbSchema string
var envVar string

func init() {
	envVar = LookupEnvOrExit("ENV_MODE")
	DbSchema = LookupEnvOrExit("DB_NAME")
}

func pgConnectionUrl() (string, postgresql.ConnectionURL, error) {

	DbHost := LookupEnvOrExit("DB_HOST")
	// DbSchema := LookupEnvOrExit("DB_NAME")
	DbUser := LookupEnvOrExit("DB_USER")
	DbPass := LookupEnvOrExit("DB_PASS")
	DbPort := LookupEnvOrExit("DB_PORT")
	SSLMode := LookupEnvOrExit("DB_SSL_MODE")

	dsn := "postgres://" + DbUser + ":" + DbPass + "@" + DbHost + ":" + DbPort + "/" + DbSchema + "?sslmode=" + SSLMode
	settings, err := postgresql.ParseURL(dsn)
	return dsn, settings, err
}

// Postgres Migrations
func PostgresMigrations() {
	dsn, _, err := pgConnectionUrl()
	if err != nil {
		log.Fatal(err)
	}

	MigrationsPath := LookupEnvOrExit("DB_MIGRATIONS_PATH")

	m, err := migrate.New(
		"file://"+MigrationsPath,
		dsn)

	if err != nil {
		log.Fatal(err)
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		log.Fatal(err)
	}

	log.Println("Migrations complete")
}

// Create connection to Postgres DB
func Postgres() sqlbuilder.Database {

	_, connURL, err := pgConnectionUrl()
	if err != nil {
		log.Fatal(err)
	}

	db, err := postgresql.Open(connURL)
	if err != nil {
		log.Printf("Could not connect to Postgres DB. Please check the database parameters for any errors: %v", err)
		os.Exit(1)
	}
	log.Printf("Env: %v. Connected to Postgres DB at host: %v", envVar, connURL.Host)
	return db

}
