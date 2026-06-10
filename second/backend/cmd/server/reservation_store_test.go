package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
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
	reservationIDPattern := regexp.MustCompile(`^R[0-9]{10}$`)
	if !reservationIDPattern.MatchString(result.ReservationID) || result.ConfirmationNo != result.ReservationID {
		t.Fatalf("Create() result = %+v", result)
	}
	if result.Amount != 2200 {
		t.Fatalf("Create() amount = %d, want 2200", result.Amount)
	}

	var reservationDetailID string
	if err := memberStore.db.QueryRowContext(ctx, `SELECT id FROM reservation_details WHERE reservation_id = ?`, result.ReservationID).Scan(&reservationDetailID); err != nil {
		t.Fatalf("reservation detail id query error = %v", err)
	}
	if !regexp.MustCompile(`^RD[0-9]{10}$`).MatchString(reservationDetailID) {
		t.Fatalf("reservation detail id = %q, want RD + 10 digits", reservationDetailID)
	}

	var paymentID string
	if err := memberStore.db.QueryRowContext(ctx, `SELECT id FROM payments WHERE reservation_id = ?`, result.ReservationID).Scan(&paymentID); err != nil {
		t.Fatalf("payment id query error = %v", err)
	}
	if !regexp.MustCompile(`^P[0-9]{3}$`).MatchString(paymentID) {
		t.Fatalf("payment id = %q, want P + 3 digits", paymentID)
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

func TestReservationRoutesCreate(t *testing.T) {
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

	gin.SetMode(gin.TestMode)
	router := gin.New()
	api := router.Group("/api")
	registerReservationRoutes(api, store, memberStore)

	body := `{
		"movieId": "1",
		"screen": "1",
		"start": "17:00",
		"end": "19:26",
		"date": "5/15(金)",
		"seats": ["A1"],
		"tickets": {"adult": 1},
		"paymentMethod": "credit",
		"customer": {
			"name": "Test User",
			"nameKana": "てすとゆーざー",
			"email": "test@example.com",
			"tel": "090-1234-5678"
		}
	}`

	response := performReservationRequest(router, body)
	if response.Code != http.StatusCreated {
		t.Fatalf("POST /api/reservations status = %d, body = %s", response.Code, response.Body.String())
	}

	var result reservationCreateResponse
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatalf("response json error = %v", err)
	}
	if !regexp.MustCompile(`^R[0-9]{10}$`).MatchString(result.ReservationID) || result.ConfirmationNo != result.ReservationID {
		t.Fatalf("reservation response = %+v", result)
	}

	duplicate := performReservationRequest(router, body)
	if duplicate.Code != http.StatusConflict {
		t.Fatalf("duplicate POST status = %d, body = %s", duplicate.Code, duplicate.Body.String())
	}
}

func performReservationRequest(router *gin.Engine, body string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(http.MethodPost, "/api/reservations", strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
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
