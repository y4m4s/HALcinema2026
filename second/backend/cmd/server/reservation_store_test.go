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
	"time"

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
			Tel:      "090-1234-5678",
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

	var (
		reservationDetailID          string
		detailQuantity               int
		detailUnitPrice, detailTotal int
	)
	if err := memberStore.db.QueryRowContext(
		ctx,
		`SELECT id, quantity, unit_price, subtotal FROM reservation_details WHERE reservation_id = ?`,
		result.ReservationID,
	).Scan(&reservationDetailID, &detailQuantity, &detailUnitPrice, &detailTotal); err != nil {
		t.Fatalf("reservation detail id query error = %v", err)
	}
	if !regexp.MustCompile(`^RD[0-9]{10}$`).MatchString(reservationDetailID) {
		t.Fatalf("reservation detail id = %q, want RD + 10 digits", reservationDetailID)
	}
	if detailQuantity != 1 || detailUnitPrice != 1800 || detailTotal != 1800 {
		t.Fatalf("reservation detail amount = quantity:%d unit:%d subtotal:%d, want 1/1800/1800", detailQuantity, detailUnitPrice, detailTotal)
	}

	var paymentID string
	if err := memberStore.db.QueryRowContext(ctx, `SELECT id FROM payments WHERE reservation_id = ?`, result.ReservationID).Scan(&paymentID); err != nil {
		t.Fatalf("payment id query error = %v", err)
	}
	if !regexp.MustCompile(`^P[0-9]{10}$`).MatchString(paymentID) {
		t.Fatalf("payment id = %q, want P + 10 digits", paymentID)
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
		Tel:           "090-1234-5678",
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
		Tel:           "090-1234-5678",
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
			Tel:      "090-2345-6789",
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
		Tel:           "090-2345-6789",
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

func TestReservationStoreKonbiniHoldExpires(t *testing.T) {
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
	testSeat := firstFreeSeat(t, memberStore.db, "SCH0002")
	req := reservationCreateRequest{
		MovieID:       "1",
		Screen:        "1",
		Start:         "17:00",
		End:           "19:26",
		Date:          "5/15(金)",
		Seats:         []string{testSeat},
		Tickets:       map[string]int{"adult": 1},
		PaymentMethod: "konbini",
		Customer: reservationCustomer{
			Name:     "Hold User",
			NameKana: "ほーるどゆーざー",
			Email:    "hold@example.com",
			Tel:      "090-4567-8901",
		},
	}

	result, err := store.Create(ctx, req, nil)
	if err != nil {
		t.Fatalf("Create() konbini error = %v", err)
	}
	if result.Status != "pending" {
		t.Fatalf("Create() status = %q, want pending", result.Status)
	}

	var reservationStatus, holdExpiresAt, paymentStatus, paymentDueAt string
	if err := memberStore.db.QueryRowContext(
		ctx,
		`SELECT r.status, r.seat_hold_expires_at, p.status, p.payment_due_at
		   FROM reservations AS r
		   JOIN payments AS p ON p.reservation_id = r.id
		  WHERE r.id = ?`,
		result.ReservationID,
	).Scan(&reservationStatus, &holdExpiresAt, &paymentStatus, &paymentDueAt); err != nil {
		t.Fatalf("deadline query error = %v", err)
	}
	if reservationStatus != "pending" || paymentStatus != "unpaid" || holdExpiresAt == "" || paymentDueAt != holdExpiresAt {
		t.Fatalf("deadline state = reservation:%q hold:%q payment:%q due:%q", reservationStatus, holdExpiresAt, paymentStatus, paymentDueAt)
	}
	if _, err := time.Parse(time.RFC3339, holdExpiresAt); err != nil {
		t.Fatalf("seat_hold_expires_at = %q, want RFC3339: %v", holdExpiresAt, err)
	}

	availability, err := store.Availability(ctx, req)
	if err != nil {
		t.Fatalf("Availability() held seat error = %v", err)
	}
	if !containsString(availability.ReservedSeats, testSeat) {
		t.Fatalf("Availability() reserved seats = %#v, want held %s", availability.ReservedSeats, testSeat)
	}

	expiredAt := time.Now().UTC().Add(-time.Minute).Format(time.RFC3339)
	if _, err := memberStore.db.ExecContext(
		ctx,
		`UPDATE reservations SET seat_hold_expires_at = ? WHERE id = ?`,
		expiredAt,
		result.ReservationID,
	); err != nil {
		t.Fatalf("expire reservation hold error = %v", err)
	}
	if _, err := memberStore.db.ExecContext(
		ctx,
		`UPDATE payments SET payment_due_at = ? WHERE reservation_id = ?`,
		expiredAt,
		result.ReservationID,
	); err != nil {
		t.Fatalf("expire payment due error = %v", err)
	}

	availability, err = store.Availability(ctx, req)
	if err != nil {
		t.Fatalf("Availability() expired hold error = %v", err)
	}
	if containsString(availability.ReservedSeats, testSeat) {
		t.Fatalf("Availability() reserved seats = %#v, want expired hold to release %s", availability.ReservedSeats, testSeat)
	}

	if err := memberStore.db.QueryRowContext(
		ctx,
		`SELECT r.status, p.status
		   FROM reservations AS r
		   JOIN payments AS p ON p.reservation_id = r.id
		  WHERE r.id = ?`,
		result.ReservationID,
	).Scan(&reservationStatus, &paymentStatus); err != nil {
		t.Fatalf("expired status query error = %v", err)
	}
	if reservationStatus != "expired" || paymentStatus != "cancelled" {
		t.Fatalf("expired state = reservation:%q payment:%q, want expired/cancelled", reservationStatus, paymentStatus)
	}

	req.PaymentMethod = "credit"
	secondResult, err := store.Create(ctx, req, nil)
	if err != nil {
		t.Fatalf("Create() after expired hold error = %v", err)
	}
	if secondResult.Status != "confirmed" {
		t.Fatalf("Create() after expired hold status = %q, want confirmed", secondResult.Status)
	}
}

func TestReservationStoreCreateWithGroupCoupon(t *testing.T) {
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
	seats := firstFreeSeats(t, memberStore.db, "SCH0002", 4)
	req := reservationCreateRequest{
		MovieID:       "1",
		Screen:        "1",
		Start:         "17:00",
		End:           "19:26",
		Date:          "5/15(金)",
		Seats:         seats,
		Tickets:       map[string]int{"adult": 4},
		CouponCode:    "GROUP200",
		PaymentMethod: "credit",
		Customer: reservationCustomer{
			Name:     "Coupon User",
			NameKana: "くーぽんゆーざー",
			Email:    "coupon@example.com",
			Tel:      "090-3456-7890",
		},
	}

	result, err := store.Create(ctx, req, nil)
	if err != nil {
		t.Fatalf("Create() group coupon error = %v", err)
	}
	if result.Amount != 8000 {
		t.Fatalf("Create() amount = %d, want 8000", result.Amount)
	}

	var couponID string
	if err := memberStore.db.QueryRowContext(ctx, `SELECT coupon_id FROM reservations WHERE id = ?`, result.ReservationID).Scan(&couponID); err != nil {
		t.Fatalf("coupon id query error = %v", err)
	}
	if couponID != "C002" {
		t.Fatalf("coupon_id = %q, want C002", couponID)
	}
}

func TestReservationStoreMigratesLegacyGroupCoupon(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "halcinema.sqlite3")
	applySQLFile(t, dbPath, filepath.Join("..", "..", "..", "db", "schema.sql"))
	applySQLFile(t, dbPath, filepath.Join("..", "..", "..", "db", "seed.sql"))

	memberStore, err := openMemberStore(dbPath)
	if err != nil {
		t.Fatalf("openMemberStore() error = %v", err)
	}
	defer memberStore.Close()

	forceLegacyCouponTable(t, memberStore.db)

	if _, err := newReservationStore(memberStore.db); err != nil {
		t.Fatalf("newReservationStore() migration error = %v", err)
	}

	ctx := context.Background()
	var tableSQL string
	if err := memberStore.db.QueryRowContext(ctx, `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'coupons'`).Scan(&tableSQL); err != nil {
		t.Fatalf("coupon table sql query error = %v", err)
	}
	if strings.Contains(tableSQL, "GLOB '[A-Z][A-Z][A-Z][A-Z][0-9][0-9][0-9]'") {
		t.Fatalf("coupon table still has legacy CHECK: %s", tableSQL)
	}

	var groupCount, legacyCount int
	if err := memberStore.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM coupons WHERE code = 'GROUP200'`).Scan(&groupCount); err != nil {
		t.Fatalf("GROUP200 count query error = %v", err)
	}
	if err := memberStore.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM coupons WHERE code = 'GRUP200'`).Scan(&legacyCount); err != nil {
		t.Fatalf("GRUP200 count query error = %v", err)
	}
	if groupCount != 1 || legacyCount != 0 {
		t.Fatalf("coupon migration counts: GROUP200=%d GRUP200=%d, want 1 and 0", groupCount, legacyCount)
	}
}

func TestReservationStoreMigratesLegacyPaymentIDs(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "halcinema.sqlite3")
	applySQLFile(t, dbPath, filepath.Join("..", "..", "..", "db", "schema.sql"))
	applySQLFile(t, dbPath, filepath.Join("..", "..", "..", "db", "seed.sql"))

	memberStore, err := openMemberStore(dbPath)
	if err != nil {
		t.Fatalf("openMemberStore() error = %v", err)
	}
	defer memberStore.Close()

	forceLegacyPaymentTable(t, memberStore.db)

	if _, err := newReservationStore(memberStore.db); err != nil {
		t.Fatalf("newReservationStore() payment migration error = %v", err)
	}

	ctx := context.Background()
	var tableSQL string
	if err := memberStore.db.QueryRowContext(ctx, `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'payments'`).Scan(&tableSQL); err != nil {
		t.Fatalf("payments table sql query error = %v", err)
	}
	if strings.Contains(tableSQL, "GLOB 'P[0-9][0-9][0-9]'") {
		t.Fatalf("payments table still has legacy CHECK: %s", tableSQL)
	}

	var paymentID string
	var dueColumnCount int
	if err := memberStore.db.QueryRowContext(ctx, `SELECT id FROM payments WHERE reservation_id = 'R0000000001'`).Scan(&paymentID); err != nil {
		t.Fatalf("payment id query error = %v", err)
	}
	if paymentID != "P0000000001" {
		t.Fatalf("payment id = %q, want P0000000001", paymentID)
	}
	if err := memberStore.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM pragma_table_info('payments') WHERE name = 'payment_due_at'`).Scan(&dueColumnCount); err != nil {
		t.Fatalf("payment_due_at column query error = %v", err)
	}
	if dueColumnCount != 1 {
		t.Fatalf("payment_due_at column count = %d, want 1", dueColumnCount)
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
			"tel": "090-1234-5678"
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
			Tel:      "090-1234-5678",
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

func forceLegacyCouponTable(t *testing.T, db *sql.DB) {
	t.Helper()
	ctx := context.Background()
	conn, err := db.Conn(ctx)
	if err != nil {
		t.Fatalf("db.Conn() error = %v", err)
	}
	defer conn.Close()

	if _, err := conn.ExecContext(ctx, `PRAGMA foreign_keys = OFF`); err != nil {
		t.Fatalf("disable foreign keys error = %v", err)
	}
	defer conn.ExecContext(context.Background(), `PRAGMA foreign_keys = ON`)

	tx, err := conn.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("BeginTx() error = %v", err)
	}
	defer tx.Rollback()

	statements := []string{
		`DROP TABLE IF EXISTS coupons_legacy`,
		`CREATE TABLE coupons_legacy (
			id               TEXT    PRIMARY KEY,
			code             TEXT    NOT NULL UNIQUE
			                         CHECK (code GLOB '[A-Z][A-Z][A-Z][A-Z][0-9][0-9][0-9]'),
			discount_amount  INTEGER NOT NULL CHECK (discount_amount >= 0),
			is_active        INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
			created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
			updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
		)`,
		`INSERT INTO coupons_legacy
			(id, code, discount_amount, is_active, created_at, updated_at)
		 SELECT id,
		        CASE WHEN code = 'GROUP200' THEN 'GRUP200' ELSE code END,
		        discount_amount,
		        is_active,
		        created_at,
		        updated_at
		   FROM coupons`,
		`DROP TABLE coupons`,
		`ALTER TABLE coupons_legacy RENAME TO coupons`,
	}
	for _, statement := range statements {
		if _, err := tx.ExecContext(ctx, statement); err != nil {
			t.Fatalf("legacy coupon statement error = %v\nSQL: %s", err, statement)
		}
	}
	if err := tx.Commit(); err != nil {
		t.Fatalf("legacy coupon commit error = %v", err)
	}
}

func forceLegacyPaymentTable(t *testing.T, db *sql.DB) {
	t.Helper()
	ctx := context.Background()
	conn, err := db.Conn(ctx)
	if err != nil {
		t.Fatalf("db.Conn() error = %v", err)
	}
	defer conn.Close()

	if _, err := conn.ExecContext(ctx, `PRAGMA foreign_keys = OFF`); err != nil {
		t.Fatalf("disable foreign keys error = %v", err)
	}
	defer conn.ExecContext(context.Background(), `PRAGMA foreign_keys = ON`)

	tx, err := conn.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("BeginTx() error = %v", err)
	}
	defer tx.Rollback()

	statements := []string{
		`DROP TABLE IF EXISTS payments_legacy`,
		`CREATE TABLE payments_legacy (
			id                 TEXT    PRIMARY KEY,
			reservation_id     TEXT    NOT NULL REFERENCES reservations(id) ON DELETE RESTRICT,
			payment_method_id  TEXT    NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT,
			amount             INTEGER NOT NULL CHECK (amount >= 0),
			status             TEXT    NOT NULL DEFAULT 'unpaid'
			                    CHECK (status IN ('unpaid', 'paid', 'failed', 'refunded', 'cancelled')),
			paid_at            TEXT,
			created_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
			updated_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
			CHECK (id GLOB 'P[0-9][0-9][0-9]')
		)`,
		`INSERT INTO payments_legacy
			(id, reservation_id, payment_method_id, amount, status, paid_at, created_at, updated_at)
		 VALUES
			('P001', 'R0000000001', 'PT001', 1800, 'paid',
			 '2026-05-20T10:05:00+09:00', '2026-05-20T10:00:00+09:00', '2026-05-20T10:00:00+09:00')`,
		`DROP TABLE payments`,
		`ALTER TABLE payments_legacy RENAME TO payments`,
	}
	for _, statement := range statements {
		if _, err := tx.ExecContext(ctx, statement); err != nil {
			t.Fatalf("legacy payment statement error = %v\nSQL: %s", err, statement)
		}
	}
	if err := tx.Commit(); err != nil {
		t.Fatalf("legacy payment commit error = %v", err)
	}
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
