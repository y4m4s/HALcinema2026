// Command dbinit creates (or resets) the local SQLite database used by the
// backend by applying db/schema.sql and db/seed.sql.
//
// The schema file drops and recreates every table, so running this command is
// idempotent: it always yields a clean database seeded with the sample data.
//
// Usage (run from second/backend):
//
//	go run ./cmd/dbinit
//	go run ./cmd/dbinit -db ../halcinema_members.sqlite3 -schema ../db/schema.sql -seed ../db/seed.sql
package main

import (
	"database/sql"
	"flag"
	"fmt"
	"os"

	_ "modernc.org/sqlite"
)

func main() {
	dbPath := flag.String("db", "../halcinema_members.sqlite3", "path to the SQLite database file to create")
	schemaPath := flag.String("schema", "../db/schema.sql", "path to schema.sql")
	seedPath := flag.String("seed", "../db/seed.sql", "path to seed.sql")
	flag.Parse()

	if err := run(*dbPath, *schemaPath, *seedPath); err != nil {
		fmt.Fprintf(os.Stderr, "dbinit: %v\n", err)
		os.Exit(1)
	}
}

func run(dbPath, schemaPath, seedPath string) error {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return fmt.Errorf("open database %q: %w", dbPath, err)
	}
	defer db.Close()

	for _, sqlPath := range []string{schemaPath, seedPath} {
		if err := applySQLFile(db, sqlPath); err != nil {
			return err
		}
		fmt.Printf("applied %s\n", sqlPath)
	}

	fmt.Printf("database ready: %s\n", dbPath)
	return nil
}

func applySQLFile(db *sql.DB, sqlPath string) error {
	contents, err := os.ReadFile(sqlPath)
	if err != nil {
		return fmt.Errorf("read %q: %w", sqlPath, err)
	}
	if _, err := db.Exec(string(contents)); err != nil {
		return fmt.Errorf("apply %q: %w", sqlPath, err)
	}
	return nil
}
