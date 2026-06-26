package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
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
	// seed.sql の占有データはランダムに座席を埋めるため、空席を DB から動的に取得する。
	testSeat := firstFreeSeat(t, memberStore.db, "SCH0002")
	req := reservationCreateRequest{
		MovieID:       "1",
		Screen:        "1",
		Start:         "17:00",
		End:           "19:26",
		Date:          "5/15(金)",
		Seats:         []string{testSeat},
		Tickets:       map[string]int{"adult": 1},
		PaymentMethod: "credit",
		Customer: reservationCustomer{
			Name:     "Test User",
			NameKana: "てすとゆーざー",
			Email:    "test@example.com",
			Tel:      "09012345678",
		},
	}

	baseline, err := store.Availability(ctx, req)
	if err != nil {
		t.Fatalf("baseline Availability() error = %v", err)
	}
	if containsString(baseline.ReservedSeats, testSeat) {
		t.Fatalf("baseline reserved seats unexpectedly contain %s: %#v", testSeat, baseline.ReservedSeats)
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
	if !containsString(availability.ReservedSeats, testSeat) {
		t.Fatalf("Availability() reserved seats = %#v, want to contain %s", availability.ReservedSeats, testSeat)
	}
	if len(availability.ReservedSeats) != len(baseline.ReservedSeats)+1 {
		t.Fatalf("Availability() reserved count = %d, want %d", len(availability.ReservedSeats), len(baseline.ReservedSeats)+1)
	}

	lookup, err := store.Lookup(ctx, reservationLookupRequest{
		ReservationID: result.ReservationID,
		Email:         "test@example.com",
		Tel:           "09012345678",
	})
	if err != nil {
		t.Fatalf("Lookup() error = %v", err)
	}
	if lookup.ReservationID != result.ReservationID || lookup.MovieTitle == "" || lookup.Payment.Amount != result.Amount {
		t.Fatalf("Lookup() = %+v, want reservation details", lookup)
	}
	if !containsString(lookup.Seats, testSeat) {
		t.Fatalf("Lookup() seats = %#v, want %s", lookup.Seats, testSeat)
	}

	_, err = store.Lookup(ctx, reservationLookupRequest{
		ReservationID: result.ReservationID,
		Email:         "wrong@example.com",
		Tel:           "09012345678",
	})
	if !errors.Is(err, errReservationNotFound) {
		t.Fatalf("Lookup() wrong email error = %v, want %v", err, errReservationNotFound)
	}

	_, err = store.Create(ctx, req, nil)
	if !errors.Is(err, errSeatAlreadyReserved) {
		t.Fatalf("duplicate Create() error = %v, want %v", err, errSeatAlreadyReserved)
	}
}

func TestReservationStoreCreateMultipleSeats(t *testing.T) {
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
	seats := firstFreeSeats(t, memberStore.db, "SCH0002", 3)
	req := reservationCreateRequest{
		MovieID:       "1",
		Screen:        "1",
		Start:         "17:00",
		End:           "19:26",
		Date:          "5/15(金)",
		Seats:         seats,
		Tickets:       map[string]int{"adult": 2, "student": 1},
		PaymentMethod: "credit",
		Customer: reservationCustomer{
			Name:     "Multi Seat User",
			NameKana: "まるちしーとゆーざー",
			Email:    "multi@example.com",
			Tel:      "09023456789",
		},
	}

	result, err := store.Create(ctx, req, nil)
	if err != nil {
		t.Fatalf("Create() multiple seats error = %v", err)
	}
	if result.Amount != 6200 {
		t.Fatalf("Create() amount = %d, want 6200", result.Amount)
	}

	lookup, err := store.Lookup(ctx, reservationLookupRequest{
		ReservationID: result.ReservationID,
		Email:         "multi@example.com",
		Tel:           "09023456789",
	})
	if err != nil {
		t.Fatalf("Lookup() multiple seats error = %v", err)
	}
	for _, seat := range seats {
		if !containsString(lookup.Seats, seat) {
			t.Fatalf("Lookup() seats = %#v, want %s", lookup.Seats, seat)
		}
	}
	if len(lookup.Tickets) != 2 {
		t.Fatalf("Lookup() tickets = %#v, want 2 ticket lines", lookup.Tickets)
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

	// 占有データはランダムに座席を埋めるため、空席を DB から動的に取得する。
	freeSeat := firstFreeSeat(t, memberStore.db, "SCH0002")
	body := fmt.Sprintf(`{
		"movieId": "1",
		"screen": "1",
		"start": "17:00",
		"end": "19:26",
		"date": "5/15(金)",
		"seats": [%q],
		"tickets": {"adult": 1},
		"paymentMethod": "credit",
		"customer": {
			"name": "Test User",
			"nameKana": "てすとゆーざー",
			"email": "test@example.com",
			"tel": "09012345678"
		}
	}`, freeSeat)

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

	tooLarge := performReservationRequest(router, `{"movieId":"`+strings.Repeat("1", int(maxAPIJSONBodyBytes))+`"}`)
	if tooLarge.Code != http.StatusBadRequest {
		t.Fatalf("oversized POST status = %d, body = %s", tooLarge.Code, tooLarge.Body.String())
	}
}

func TestReservationStoreRejectsInputLimits(t *testing.T) {
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
			Tel:      "09012345678",
		},
	}

	oversizedName := normalizeReservationRequest(req)
	oversizedName.Customer.Name = strings.Repeat("あ", maxPersonNameRunes+1)
	if err := validateReservationRequest(oversizedName); !isValidationError(err) {
		t.Fatalf("oversized customer name error = %v, want validationError", err)
	}

	badCoupon := normalizeReservationRequest(req)
	badCoupon.CouponCode = "BAD<script>"
	if err := validateReservationRequest(badCoupon); !isValidationError(err) {
		t.Fatalf("bad coupon error = %v, want validationError", err)
	}

	badEmail := normalizeReservationRequest(req)
	badEmail.Customer.Email = "Display Name <test@example.com>"
	if err := validateReservationRequest(badEmail); !isValidationError(err) {
		t.Fatalf("bad email error = %v, want validationError", err)
	}
}

// firstFreeSeat returns a seat_code on the given schedule's screen that is not
// yet reserved, so tests stay valid regardless of the randomized seed occupancy.
func firstFreeSeat(t *testing.T, db *sql.DB, scheduleID string) string {
	t.Helper()
	seats := firstFreeSeats(t, db, scheduleID, 1)
	return seats[0]
}

func firstFreeSeats(t *testing.T, db *sql.DB, scheduleID string, count int) []string {
	t.Helper()
	rows, err := db.Query(
		`SELECT s.seat_code
		   FROM seats AS s
		   JOIN schedules AS sch ON sch.screen_id = s.screen_id
		  WHERE sch.id = ?
		    AND s.is_active = 1
		    AND s.id NOT IN (
		        SELECT rs.seat_id FROM reservation_seats AS rs WHERE rs.schedule_id = ?
		    )
		  ORDER BY s.id
		  LIMIT ?`,
		scheduleID, scheduleID, count,
	)
	if err != nil {
		t.Fatalf("firstFreeSeats(%q) error = %v", scheduleID, err)
	}
	defer rows.Close()

	seats := []string{}
	for rows.Next() {
		var code string
		if err := rows.Scan(&code); err != nil {
			t.Fatalf("firstFreeSeats(%q) scan error = %v", scheduleID, err)
		}
		seats = append(seats, code)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("firstFreeSeats(%q) rows error = %v", scheduleID, err)
	}
	if len(seats) != count {
		t.Fatalf("firstFreeSeats(%q) returned %d seats, want %d", scheduleID, len(seats), count)
	}
	return seats
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
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
