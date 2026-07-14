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
	"sync"
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
	testSeat := firstFreeSeat(t, memberStore.db, "2")
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

	result, err := store.Create(ctx, req, nil, "create-availability-0001")
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
	reservationRowID := reservationIDByNo(t, memberStore.db, result.ReservationID)

	var (
		reservationDetailID          int64
		detailQuantity               int
		detailUnitPrice, detailTotal int
	)
	if err := memberStore.db.QueryRowContext(
		ctx,
		`SELECT id, quantity, unit_price, subtotal FROM reservation_details WHERE reservation_id = ?`,
		reservationRowID,
	).Scan(&reservationDetailID, &detailQuantity, &detailUnitPrice, &detailTotal); err != nil {
		t.Fatalf("reservation detail id query error = %v", err)
	}
	if reservationDetailID <= 0 {
		t.Fatalf("reservation detail id = %d, want positive integer", reservationDetailID)
	}
	if detailQuantity != 1 || detailUnitPrice != 1800 || detailTotal != 1800 {
		t.Fatalf("reservation detail amount = quantity:%d unit:%d subtotal:%d, want 1/1800/1800", detailQuantity, detailUnitPrice, detailTotal)
	}

	var paymentID int64
	if err := memberStore.db.QueryRowContext(ctx, `SELECT id FROM payments WHERE reservation_id = ?`, reservationRowID).Scan(&paymentID); err != nil {
		t.Fatalf("payment id query error = %v", err)
	}
	if paymentID <= 0 {
		t.Fatalf("payment id = %d, want positive integer", paymentID)
	}

	availability, err := store.Availability(ctx, req)
	if err != nil {
		t.Fatalf("Availability() error = %v", err)
	}
	if availability.ScheduleID != "2" {
		t.Fatalf("Availability() schedule = %q, want 2", availability.ScheduleID)
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

	_, err = store.Create(ctx, req, nil, "create-availability-0002")
	if !errors.Is(err, errSeatAlreadyReserved) {
		t.Fatalf("duplicate Create() error = %v, want %v", err, errSeatAlreadyReserved)
	}
}

func TestReservationStoreConcurrentCreateSameSeat(t *testing.T) {
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

	const attempts = 16
	ctx := context.Background()
	testSeat := firstFreeSeat(t, memberStore.db, "2")
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
			Name:     "Concurrent User",
			NameKana: "どうじよやくゆーざー",
			Tel:      "09012345678",
		},
	}

	start := make(chan struct{})
	results := make(chan error, attempts)
	var wg sync.WaitGroup
	for i := 0; i < attempts; i++ {
		wg.Add(1)
		go func(attempt int) {
			defer wg.Done()
			concurrentReq := req
			concurrentReq.Customer.Email = fmt.Sprintf("concurrent-%d@example.com", attempt)
			<-start
			_, createErr := store.Create(ctx, concurrentReq, nil, fmt.Sprintf("concurrent-seat-%04d", attempt))
			results <- createErr
		}(i)
	}
	close(start)
	wg.Wait()
	close(results)

	succeeded := 0
	conflicted := 0
	for createErr := range results {
		switch {
		case createErr == nil:
			succeeded++
		case errors.Is(createErr, errSeatAlreadyReserved):
			conflicted++
		default:
			t.Fatalf("concurrent Create() unexpected error = %v", createErr)
		}
	}
	if succeeded != 1 || conflicted != attempts-1 {
		t.Fatalf("concurrent Create() results = success:%d conflict:%d, want 1/%d", succeeded, conflicted, attempts-1)
	}

	var reservedSeatRows int
	if err := memberStore.db.QueryRowContext(
		ctx,
		`SELECT COUNT(*)
		   FROM reservation_seats AS rs
		   JOIN seats AS st ON st.id = rs.seat_id
		  WHERE rs.schedule_id = 2
		    AND st.seat_code = ?`,
		testSeat,
	).Scan(&reservedSeatRows); err != nil {
		t.Fatalf("reserved seat count error = %v", err)
	}
	if reservedSeatRows != 1 {
		t.Fatalf("reserved seat rows = %d, want 1", reservedSeatRows)
	}

	var createdReservations int
	if err := memberStore.db.QueryRowContext(
		ctx,
		`SELECT COUNT(*) FROM reservations WHERE customer_email LIKE 'concurrent-%@example.com'`,
	).Scan(&createdReservations); err != nil {
		t.Fatalf("created reservation count error = %v", err)
	}
	if createdReservations != 1 {
		t.Fatalf("created reservations = %d, want 1", createdReservations)
	}
}

func TestReservationStoreConcurrentIdempotentRetry(t *testing.T) {
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

	const (
		attempts       = 16
		idempotencyKey = "concurrent-idempotency-retry-0001"
	)
	ctx := context.Background()
	testSeat := firstFreeSeat(t, memberStore.db, "2")
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
			Name:     "Idempotent User",
			NameKana: "べきとうゆーざー",
			Email:    "idempotent@example.com",
			Tel:      "09012345678",
		},
	}

	type createResult struct {
		response reservationCreateResponse
		err      error
	}
	start := make(chan struct{})
	results := make(chan createResult, attempts)
	var wg sync.WaitGroup
	for i := 0; i < attempts; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			response, createErr := store.Create(ctx, req, nil, idempotencyKey)
			results <- createResult{response: response, err: createErr}
		}()
	}
	close(start)
	wg.Wait()
	close(results)

	reservationNo := ""
	created := 0
	replayed := 0
	for result := range results {
		if result.err != nil {
			t.Fatalf("idempotent Create() error = %v", result.err)
		}
		if reservationNo == "" {
			reservationNo = result.response.ReservationID
		}
		if result.response.ReservationID != reservationNo {
			t.Fatalf("idempotent reservation ID = %q, want %q", result.response.ReservationID, reservationNo)
		}
		if result.response.Replayed {
			replayed++
		} else {
			created++
		}
	}
	if created != 1 || replayed != attempts-1 {
		t.Fatalf("idempotent results = created:%d replayed:%d, want 1/%d", created, replayed, attempts-1)
	}

	var reservationCount, idempotencyCount int
	if err := memberStore.db.QueryRowContext(
		ctx,
		`SELECT COUNT(*) FROM reservations WHERE customer_email = 'idempotent@example.com'`,
	).Scan(&reservationCount); err != nil {
		t.Fatalf("idempotent reservation count error = %v", err)
	}
	if err := memberStore.db.QueryRowContext(
		ctx,
		`SELECT COUNT(*) FROM reservation_idempotency_keys WHERE idempotency_key = ?`,
		idempotencyKey,
	).Scan(&idempotencyCount); err != nil {
		t.Fatalf("idempotency key count error = %v", err)
	}
	if reservationCount != 1 || idempotencyCount != 1 {
		t.Fatalf("idempotent row counts = reservations:%d keys:%d, want 1/1", reservationCount, idempotencyCount)
	}
}

func TestReservationStoreMigratesIdempotencyTable(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "halcinema.sqlite3")
	applySQLFile(t, dbPath, filepath.Join("..", "..", "..", "db", "schema.sql"))
	applySQLFile(t, dbPath, filepath.Join("..", "..", "..", "db", "seed.sql"))

	memberStore, err := openMemberStore(dbPath)
	if err != nil {
		t.Fatalf("openMemberStore() error = %v", err)
	}
	defer memberStore.Close()

	if _, err := memberStore.db.Exec(`DROP TABLE reservation_idempotency_keys`); err != nil {
		t.Fatalf("drop idempotency table error = %v", err)
	}
	if _, err := newReservationStore(memberStore.db); err != nil {
		t.Fatalf("newReservationStore() idempotency migration error = %v", err)
	}

	var tableCount, indexCount int
	if err := memberStore.db.QueryRow(
		`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'reservation_idempotency_keys'`,
	).Scan(&tableCount); err != nil {
		t.Fatalf("idempotency table count error = %v", err)
	}
	if err := memberStore.db.QueryRow(
		`SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'idx_reservation_idempotency_created_at'`,
	).Scan(&indexCount); err != nil {
		t.Fatalf("idempotency index count error = %v", err)
	}
	if tableCount != 1 || indexCount != 1 {
		t.Fatalf("idempotency migration counts = table:%d index:%d, want 1/1", tableCount, indexCount)
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
	seats := firstFreeSeats(t, memberStore.db, "2", 3)
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

	result, err := store.Create(ctx, req, nil, "multiple-seats-0001")
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
	testSeat := firstFreeSeat(t, memberStore.db, "2")
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
			Tel:      "09045678901",
		},
	}

	result, err := store.Create(ctx, req, nil, "konbini-hold-0001")
	if err != nil {
		t.Fatalf("Create() konbini error = %v", err)
	}
	if result.Status != "pending" {
		t.Fatalf("Create() status = %q, want pending", result.Status)
	}
	reservationRowID := reservationIDByNo(t, memberStore.db, result.ReservationID)

	var reservationStatus, holdExpiresAt, paymentStatus, paymentDueAt string
	if err := memberStore.db.QueryRowContext(
		ctx,
		`SELECT r.status, r.seat_hold_expires_at, p.status, p.payment_due_at
		   FROM reservations AS r
		   JOIN payments AS p ON p.reservation_id = r.id
		  WHERE r.id = ?`,
		reservationRowID,
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
		reservationRowID,
	); err != nil {
		t.Fatalf("expire reservation hold error = %v", err)
	}
	if _, err := memberStore.db.ExecContext(
		ctx,
		`UPDATE payments SET payment_due_at = ? WHERE reservation_id = ?`,
		expiredAt,
		reservationRowID,
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
		reservationRowID,
	).Scan(&reservationStatus, &paymentStatus); err != nil {
		t.Fatalf("expired status query error = %v", err)
	}
	if reservationStatus != "expired" || paymentStatus != "cancelled" {
		t.Fatalf("expired state = reservation:%q payment:%q, want expired/cancelled", reservationStatus, paymentStatus)
	}

	req.PaymentMethod = "credit"
	secondResult, err := store.Create(ctx, req, nil, "konbini-hold-0002")
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
	seats := firstFreeSeats(t, memberStore.db, "2", 4)
	groupCouponCode := couponCodeByRule(t, memberStore.db, "group")
	req := reservationCreateRequest{
		MovieID:       "1",
		Screen:        "1",
		Start:         "17:00",
		End:           "19:26",
		Date:          "5/15(金)",
		Seats:         seats,
		Tickets:       map[string]int{"adult": 4},
		CouponCode:    groupCouponCode,
		PaymentMethod: "credit",
		Customer: reservationCustomer{
			Name:     "Coupon User",
			NameKana: "くーぽんゆーざー",
			Email:    "coupon@example.com",
			Tel:      "09034567890",
		},
	}

	result, err := store.Create(ctx, req, nil, "group-coupon-0001")
	if err != nil {
		t.Fatalf("Create() group coupon error = %v", err)
	}
	if result.Amount != 8000 {
		t.Fatalf("Create() amount = %d, want 8000", result.Amount)
	}

	var couponID string
	if err := memberStore.db.QueryRowContext(ctx, `SELECT coupon_id FROM reservations WHERE id = ?`, reservationIDByNo(t, memberStore.db, result.ReservationID)).Scan(&couponID); err != nil {
		t.Fatalf("coupon id query error = %v", err)
	}
	if couponID != "C0000000002" {
		t.Fatalf("coupon_id = %q, want C0000000002", couponID)
	}
}

func TestReservationStorePreviewCoupon(t *testing.T) {
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
	seats := firstFreeSeats(t, memberStore.db, "2", 4)
	result, err := store.PreviewCoupon(ctx, couponPreviewRequest{
		MovieID:    "1",
		Screen:     "1",
		Start:      "17:00",
		End:        "19:26",
		Date:       "5/15(金)",
		Seats:      seats,
		Tickets:    map[string]int{"adult": 4},
		CouponCode: couponCodeByRule(t, memberStore.db, "group"),
	})
	if err != nil {
		t.Fatalf("PreviewCoupon() error = %v", err)
	}
	if result.Name != "グループ割引" || result.Description == "" || result.Discount != 800 {
		t.Fatalf("PreviewCoupon() = %+v, want group discount 800", result)
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

	ctx := context.Background()
	if _, err := memberStore.db.ExecContext(ctx, `UPDATE reservations SET coupon_id = 'C002' WHERE reservation_no = 'R0000000001'`); err != nil {
		t.Fatalf("legacy reservation coupon update error = %v", err)
	}

	if _, err := newReservationStore(memberStore.db); err != nil {
		t.Fatalf("newReservationStore() migration error = %v", err)
	}

	var tableSQL string
	if err := memberStore.db.QueryRowContext(ctx, `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'coupons'`).Scan(&tableSQL); err != nil {
		t.Fatalf("coupon table sql query error = %v", err)
	}
	if strings.Contains(tableSQL, "GLOB '[A-Z][A-Z][A-Z][A-Z][0-9][0-9][0-9]'") {
		t.Fatalf("coupon table still has legacy CHECK: %s", tableSQL)
	}

	var groupCount, legacyCount, fixedCount int
	var migratedCouponID string
	if err := memberStore.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM coupons WHERE id = 'C0000000002' AND rule_code = 'group' AND code = 'Z8N3K6TP4A'`).Scan(&groupCount); err != nil {
		t.Fatalf("group coupon count query error = %v", err)
	}
	if err := memberStore.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM coupons WHERE code = 'GRUP200'`).Scan(&legacyCount); err != nil {
		t.Fatalf("GRUP200 count query error = %v", err)
	}
	if err := memberStore.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM coupons WHERE code = 'GROUP200'`).Scan(&fixedCount); err != nil {
		t.Fatalf("GROUP200 count query error = %v", err)
	}
	if groupCount != 1 || legacyCount != 0 || fixedCount != 0 {
		t.Fatalf("coupon migration counts: group=%d GRUP200=%d GROUP200=%d, want 1/0/0", groupCount, legacyCount, fixedCount)
	}
	if err := memberStore.db.QueryRowContext(ctx, `SELECT coupon_id FROM reservations WHERE reservation_no = 'R0000000001'`).Scan(&migratedCouponID); err != nil {
		t.Fatalf("migrated reservation coupon query error = %v", err)
	}
	if migratedCouponID != "C0000000002" {
		t.Fatalf("migrated reservation coupon_id = %q, want C0000000002", migratedCouponID)
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

	var paymentID int64
	var dueColumnCount int
	if err := memberStore.db.QueryRowContext(ctx, `SELECT id FROM payments WHERE reservation_id = 1`).Scan(&paymentID); err != nil {
		t.Fatalf("payment id query error = %v", err)
	}
	if paymentID != 1 {
		t.Fatalf("payment id = %d, want 1", paymentID)
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
	freeSeat := firstFreeSeat(t, memberStore.db, "2")
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

	const idempotencyKey = "reservation-route-create-0001"
	response := performReservationRequest(router, body, idempotencyKey)
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

	replay := performReservationRequest(router, body, idempotencyKey)
	if replay.Code != http.StatusCreated || replay.Header().Get("Idempotency-Replayed") != "true" {
		t.Fatalf("replayed POST status = %d, header = %q, body = %s", replay.Code, replay.Header().Get("Idempotency-Replayed"), replay.Body.String())
	}
	var replayedResult reservationCreateResponse
	if err := json.Unmarshal(replay.Body.Bytes(), &replayedResult); err != nil {
		t.Fatalf("replayed response json error = %v", err)
	}
	if replayedResult.ReservationID != result.ReservationID || replayedResult.Amount != result.Amount || replayedResult.Status != result.Status {
		t.Fatalf("replayed response = %+v, want %+v", replayedResult, result)
	}

	duplicate := performReservationRequest(router, body, "reservation-route-create-0002")
	if duplicate.Code != http.StatusConflict {
		t.Fatalf("duplicate POST status = %d, body = %s", duplicate.Code, duplicate.Body.String())
	}

	changedRequest := performReservationRequest(
		router,
		strings.Replace(body, "test@example.com", "changed@example.com", 1),
		idempotencyKey,
	)
	if changedRequest.Code != http.StatusConflict {
		t.Fatalf("changed idempotent POST status = %d, body = %s", changedRequest.Code, changedRequest.Body.String())
	}

	missingKey := performReservationRequest(router, body, "")
	if missingKey.Code != http.StatusBadRequest {
		t.Fatalf("missing Idempotency-Key status = %d, body = %s", missingKey.Code, missingKey.Body.String())
	}

	tooLarge := performReservationRequest(router, `{"movieId":"`+strings.Repeat("1", int(maxAPIJSONBodyBytes))+`"}`, "reservation-route-large-0001")
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

func reservationIDByNo(t *testing.T, db *sql.DB, reservationNo string) int64 {
	t.Helper()
	var id int64
	if err := db.QueryRow(`SELECT id FROM reservations WHERE reservation_no = ?`, reservationNo).Scan(&id); err != nil {
		t.Fatalf("reservationIDByNo(%q) error = %v", reservationNo, err)
	}
	return id
}

func couponCodeByRule(t *testing.T, db *sql.DB, ruleCode string) string {
	t.Helper()
	var code string
	if err := db.QueryRow(
		`SELECT code
		   FROM coupons
		  WHERE rule_code = ?
		    AND is_active = 1
		  ORDER BY id
		  LIMIT 1`,
		ruleCode,
	).Scan(&code); err != nil {
		t.Fatalf("couponCodeByRule(%q) error = %v", ruleCode, err)
	}
	return code
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
		 SELECT CASE id
		            WHEN 'C0000000001' THEN 'C001'
		            WHEN 'C0000000002' THEN 'C002'
		            WHEN 'C0000000003' THEN 'C003'
		            WHEN 'C0000000004' THEN 'C004'
		            WHEN 'C0000000005' THEN 'C005'
		            WHEN 'C0000000006' THEN 'C006'
		            WHEN 'C0000000007' THEN 'C007'
		            WHEN 'C0000000008' THEN 'C008'
		            WHEN 'C0000000009' THEN 'C009'
		            WHEN 'C0000000010' THEN 'C010'
		            ELSE id
		        END,
		        CASE id
		            WHEN 'C0000000001' THEN 'LATE100'
		            WHEN 'C0000000002' THEN 'GRUP200'
		            WHEN 'C0000000003' THEN 'HORS100'
		            WHEN 'C0000000004' THEN 'WELC300'
		            WHEN 'C0000000005' THEN 'BDAY500'
		            WHEN 'C0000000006' THEN 'WEEK150'
		            WHEN 'C0000000007' THEN 'MEMS300'
		            WHEN 'C0000000008' THEN 'SUMM200'
		            WHEN 'C0000000009' THEN 'WINT200'
		            WHEN 'C0000000010' THEN 'HOLI150'
		            ELSE 'TEST000'
		        END,
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

func performReservationRequest(router *gin.Engine, body string, idempotencyKey string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(http.MethodPost, "/api/reservations", strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	if idempotencyKey != "" {
		request.Header.Set("Idempotency-Key", idempotencyKey)
	}
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
