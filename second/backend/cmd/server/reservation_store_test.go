package main

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestReservationStoreCreateAndAvailability(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "halcinema.sqlite3")
	applySQLFile(t, dbPath, filepath.Join("..", "..", "..", "db", "schema.sql"))
	applySQLFile(t, dbPath, filepath.Join("..", "..", "..", "db", "seed.sql"))

	memberStore, err := openMemberStore(dbPath)
	if err != nil {
		t.Fatalf("openMemberStore() error = %v", err)
	}
	defer memberStore.Close()

	store, err := newReservationStore(memberStore.db)
	if err != nil {
		t.Fatalf("newReservationStore() error = %v", err)
	}

	ctx := context.Background()
	req := reservationCreateRequest{
		MovieID:       "1",
		Screen:        "1",
		Start:         "17:00",
		End:           "19:26",
		Date:          "5/15(金)",
		Seats:         []string{"A1"},
		Tickets:       map[string]int{"adult": 1},
		PaymentMethod: "credit",
		Customer: reservationCustomer{
			Name:     "Test User",
			NameKana: "てすとゆーざー",
			Email:    "test@example.com",
			Tel:      "090-1234-5678",
		},
	}

	result, err := store.Create(ctx, req, nil)
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if result.ReservationID == "" || result.ConfirmationNo != result.ReservationID {
		t.Fatalf("Create() result = %+v", result)
	}
	if result.Amount != 2200 {
		t.Fatalf("Create() amount = %d, want 2200", result.Amount)
	}

	availability, err := store.Availability(ctx, req)
	if err != nil {
		t.Fatalf("Availability() error = %v", err)
	}
	if availability.ScheduleID != "SCH0002" {
		t.Fatalf("Availability() schedule = %q, want SCH0002", availability.ScheduleID)
	}
	if len(availability.ReservedSeats) != 1 || availability.ReservedSeats[0] != "A1" {
		t.Fatalf("Availability() reserved seats = %#v, want [A1]", availability.ReservedSeats)
	}

	_, err = store.Create(ctx, req, nil)
	if !errors.Is(err, errSeatAlreadyReserved) {
		t.Fatalf("duplicate Create() error = %v, want %v", err, errSeatAlreadyReserved)
	}
}

func applySQLFile(t *testing.T, dbPath string, sqlPath string) {
	t.Helper()

	contents, err := os.ReadFile(sqlPath)
	if err != nil {
		t.Fatalf("ReadFile(%q) error = %v", sqlPath, err)
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("sql.Open() error = %v", err)
	}
	defer db.Close()

	if _, err := db.Exec(string(contents)); err != nil {
		t.Fatalf("Exec(%q) error = %v", sqlPath, err)
	}
}
