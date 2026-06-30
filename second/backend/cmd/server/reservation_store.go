package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"errors"
	"fmt"
	"math/big"
	"sort"
	"strconv"
	"strings"
	"time"
)

var (
	errReservationSchemaMissing = errors.New("reservation schema missing")
	errShowtimeNotFound         = errors.New("showtime not found")
	errSeatNotFound             = errors.New("seat not found")
	errSeatAlreadyReserved      = errors.New("seat already reserved")
	errTicketTypeNotFound       = errors.New("ticket type not found")
	errPaymentMethodNotFound    = errors.New("payment method not found")
	errReservationNotFound      = errors.New("reservation not found")
)

const reservationSeatHoldDuration = 30 * time.Minute

type reservationStore struct {
	db *sql.DB
}

type reservationCreateRequest struct {
	MovieID       string              `json:"movieId"`
	Screen        string              `json:"screen"`
	Start         string              `json:"start"`
	End           string              `json:"end"`
	Date          string              `json:"date"`
	Seats         []string            `json:"seats"`
	Tickets       map[string]int      `json:"tickets"`
	CouponCode    string              `json:"couponCode"`
	PaymentMethod string              `json:"paymentMethod"`
	Customer      reservationCustomer `json:"customer"`
}

type couponPreviewRequest struct {
	MovieID    string         `json:"movieId"`
	Screen     string         `json:"screen"`
	Start      string         `json:"start"`
	End        string         `json:"end"`
	Date       string         `json:"date"`
	Seats      []string       `json:"seats"`
	Tickets    map[string]int `json:"tickets"`
	CouponCode string         `json:"couponCode"`
}

type couponPreviewResponse struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Discount    int    `json:"discount"`
}

type reservationCustomer struct {
	Name     string `json:"name"`
	NameKana string `json:"nameKana"`
	Email    string `json:"email"`
	Tel      string `json:"tel"`
}

type reservationAvailabilityResponse struct {
	ScheduleID    string   `json:"scheduleId"`
	ReservedSeats []string `json:"reservedSeats"`
}

type scheduleAvailabilityItem struct {
	ScheduleID string `json:"scheduleId"`
	MovieID    int    `json:"movieId"`
	Screen     int    `json:"screen"`
	Start      string `json:"start"`
	End        string `json:"end"`
	Capacity   int    `json:"capacity"`
	Reserved   int    `json:"reserved"`
	Remaining  int    `json:"remaining"`
	Status     string `json:"status"`
}

type reservationCreateResponse struct {
	ReservationID  string `json:"reservationId"`
	ConfirmationNo string `json:"confirmationNo"`
	Amount         int    `json:"amount"`
	Status         string `json:"status"`
}

type reservationLookupRequest struct {
	ReservationID  string `json:"reservationId"`
	ConfirmationNo string `json:"confirmationNo"`
	Email          string `json:"email"`
	Tel            string `json:"tel"`
}

type reservationLookupResponse struct {
	ReservationID string                    `json:"reservationId"`
	Status        string                    `json:"status"`
	MovieTitle    string                    `json:"movieTitle"`
	Date          string                    `json:"date"`
	Start         string                    `json:"start"`
	End           string                    `json:"end"`
	Screen        string                    `json:"screen"`
	Seats         []string                  `json:"seats"`
	Tickets       []reservationLookupTicket `json:"tickets"`
	Payment       reservationLookupPayment  `json:"payment"`
	Customer      reservationLookupCustomer `json:"customer"`
}

type reservationLookupTicket struct {
	Code  string `json:"code"`
	Name  string `json:"name"`
	Count int    `json:"count"`
	Price int    `json:"price"`
}

type reservationLookupPayment struct {
	Method string `json:"method"`
	Status string `json:"status"`
	Amount int    `json:"amount"`
}

type reservationLookupCustomer struct {
	Name  string `json:"name"`
	Email string `json:"email"`
	Tel   string `json:"tel"`
}

type resolvedShowtime struct {
	id       string
	movieID  string
	screenID string
	startAt  string
}

type resolvedSeat struct {
	id   int64
	code string
}

type resolvedTicket struct {
	id                int64
	code              string
	price             int
	requiredSeatCount int
	count             int
}

type resolvedCoupon struct {
	id             string
	code           string
	ruleCode       string
	name           string
	description    string
	discountAmount int
}

func newReservationStore(db *sql.DB) (*reservationStore, error) {
	store := &reservationStore{db: db}
	if err := store.init(context.Background()); err != nil {
		return nil, err
	}
	return store, nil
}

func (s *reservationStore) init(ctx context.Context) error {
	if _, err := s.db.ExecContext(ctx, `PRAGMA foreign_keys = ON`); err != nil {
		return err
	}
	if _, err := s.db.ExecContext(ctx, `PRAGMA busy_timeout = 5000`); err != nil {
		return err
	}

	required := []string{
		"schedules",
		"seats",
		"ticket_types",
		"reservations",
		"reservation_details",
		"reservation_seats",
		"coupons",
		"payment_methods",
		"payments",
	}
	for _, table := range required {
		var name string
		err := s.db.QueryRowContext(
			ctx,
			`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
			table,
		).Scan(&name)
		if errors.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("%w: %s", errReservationSchemaMissing, table)
		}
		if err != nil {
			return err
		}
	}

	if err := s.migrateCouponCodeFormat(ctx); err != nil {
		return err
	}
	if err := s.migrateScheduleDateTimeFormat(ctx); err != nil {
		return err
	}
	if err := s.migrateReservationDetails(ctx); err != nil {
		return err
	}
	if err := s.migrateReservationDeadlines(ctx); err != nil {
		return err
	}
	if err := s.migratePaymentIDs(ctx); err != nil {
		return err
	}
	return s.expireStaleSeatHolds(ctx, time.Now().UTC().Format(time.RFC3339))
}

func (s *reservationStore) migrateCouponCodeFormat(ctx context.Context) error {
	tableSQL, err := s.tableSQL(ctx, "coupons")
	if err != nil {
		return err
	}
	columns, err := s.tableColumns(ctx, "coupons")
	if err != nil {
		return err
	}

	needsRebuild := strings.Contains(tableSQL, "GLOB '[A-Z][A-Z][A-Z][A-Z][0-9][0-9][0-9]'") ||
		!columns["rule_code"] ||
		!columns["name"] ||
		!columns["description"] ||
		strings.Contains(tableSQL, "A-Z0-9_-") ||
		!strings.Contains(tableSQL, "id GLOB 'C[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'")
	if needsRebuild {
		return s.rebuildCouponsForRandomCodes(ctx)
	}
	return nil
}

func (s *reservationStore) rebuildCouponsForRandomCodes(ctx context.Context) error {
	conn, err := s.db.Conn(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()

	if _, err := conn.ExecContext(ctx, `PRAGMA foreign_keys = OFF`); err != nil {
		return err
	}
	defer conn.ExecContext(context.Background(), `PRAGMA foreign_keys = ON`)

	tx, err := conn.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	statements := []string{
		`DROP TABLE IF EXISTS coupons_new`,
		`DROP TABLE IF EXISTS _coupon_id_map`,
		`CREATE TEMP TABLE _coupon_id_map (
			old_id TEXT PRIMARY KEY,
			new_id TEXT NOT NULL UNIQUE
		)`,
		`INSERT INTO _coupon_id_map (old_id, new_id)
		 SELECT id,
		        CASE
		            WHEN id GLOB 'C[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]' THEN id
		            WHEN id GLOB 'C[0-9][0-9][0-9]' THEN 'C' || printf('%010d', CAST(substr(id, 2) AS INTEGER))
		            ELSE 'C' || printf('%010d', rn)
		        END
		   FROM (
		        SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn
		          FROM coupons
		   )`,
		`CREATE TABLE coupons_new (
			id               TEXT    PRIMARY KEY,
			code             TEXT    NOT NULL UNIQUE
			                         CHECK (
			                             length(code) BETWEEN 8 AND 20
			                             AND code = upper(code)
			                             AND code NOT GLOB '*[^A-Z0-9]*'
			                         ),
			rule_code        TEXT    NOT NULL DEFAULT 'per_seat'
			                         CHECK (rule_code IN ('per_seat', 'late_show', 'group')),
			name             TEXT    NOT NULL DEFAULT '',
			description      TEXT,
			discount_amount  INTEGER NOT NULL CHECK (discount_amount >= 0),
			is_active        INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
			created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
			updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
			CHECK (id GLOB 'C[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]')
		)`,
		`INSERT INTO coupons_new
			(id, code, rule_code, name, description, discount_amount, is_active, created_at, updated_at)
		 SELECT m.new_id,
		        CASE
		            WHEN c.id IN ('C001', 'C0000000001') OR c.code = 'LATE100' THEN 'Q7M4X9KD2P'
		            WHEN c.id IN ('C002', 'C0000000002') OR c.code IN ('GROUP200', 'GRUP200') THEN 'Z8N3K6TP4A'
		            WHEN c.id IN ('C003', 'C0000000003') OR c.code = 'HORS100' THEN 'H6R2V8XM9Q'
		            WHEN c.id IN ('C004', 'C0000000004') OR c.code = 'WELC300' THEN 'W4C9L2NP7D'
		            WHEN c.id IN ('C005', 'C0000000005') OR c.code = 'BDAY500' THEN 'B5D8Y3QK6M'
		            WHEN c.id IN ('C006', 'C0000000006') OR c.code = 'WEEK150' THEN 'K3W7E5T9LA'
		            WHEN c.id IN ('C007', 'C0000000007') OR c.code = 'MEMS300' THEN 'M9S2C6V4NX'
		            WHEN c.id IN ('C008', 'C0000000008') OR c.code = 'SUMM200' THEN 'S2U8M4R7QP'
		            WHEN c.id IN ('C009', 'C0000000009') OR c.code = 'WINT200' THEN 'T6W2N9R5KC'
		            WHEN c.id IN ('C010', 'C0000000010') OR c.code = 'HOLI150' THEN 'H4L9D2V8QA'
		            ELSE c.code
		        END,
		        CASE
		            WHEN c.id IN ('C001', 'C0000000001') OR c.code = 'LATE100' THEN 'late_show'
		            WHEN c.id IN ('C002', 'C0000000002') OR c.code IN ('GROUP200', 'GRUP200') THEN 'group'
		            ELSE 'per_seat'
		        END,
		        CASE
		            WHEN c.id IN ('C001', 'C0000000001') OR c.code = 'LATE100' THEN 'レイトショー割引'
		            WHEN c.id IN ('C002', 'C0000000002') OR c.code IN ('GROUP200', 'GRUP200') THEN 'グループ割引'
		            WHEN c.id IN ('C003', 'C0000000003') OR c.code = 'HORS100' THEN 'ホラーコスプレ割引'
		            WHEN c.id IN ('C004', 'C0000000004') OR c.code = 'WELC300' THEN 'ウェルカムクーポン'
		            WHEN c.id IN ('C005', 'C0000000005') OR c.code = 'BDAY500' THEN '誕生日クーポン'
		            WHEN c.id IN ('C006', 'C0000000006') OR c.code = 'WEEK150' THEN '平日割引'
		            WHEN c.id IN ('C007', 'C0000000007') OR c.code = 'MEMS300' THEN '会員特典'
		            WHEN c.id IN ('C008', 'C0000000008') OR c.code = 'SUMM200' THEN '夏季特別割引'
		            WHEN c.id IN ('C009', 'C0000000009') OR c.code = 'WINT200' THEN '冬季特別割引'
		            WHEN c.id IN ('C010', 'C0000000010') OR c.code = 'HOLI150' THEN '祝日割引'
		            ELSE ''
		        END,
		        CASE
		            WHEN c.id IN ('C001', 'C0000000001') OR c.code = 'LATE100' THEN '20:00以降の回で1席100円引き'
		            WHEN c.id IN ('C002', 'C0000000002') OR c.code IN ('GROUP200', 'GRUP200') THEN '4席以上で1席200円引き'
		            ELSE '1席' || c.discount_amount || '円引き'
		        END,
		        c.discount_amount,
		        c.is_active,
		        c.created_at,
		        c.updated_at
		   FROM coupons AS c
		   JOIN _coupon_id_map AS m ON m.old_id = c.id`,
		`UPDATE reservations
		    SET coupon_id = (
		        SELECT m.new_id
		          FROM _coupon_id_map AS m
		         WHERE m.old_id = reservations.coupon_id
		    )
		  WHERE coupon_id IS NOT NULL
		    AND EXISTS (
		        SELECT 1
		          FROM _coupon_id_map AS m
		         WHERE m.old_id = reservations.coupon_id
		    )`,
		`DROP TABLE coupons`,
		`ALTER TABLE coupons_new RENAME TO coupons`,
		`DROP TABLE IF EXISTS _coupon_id_map`,
	}
	for _, statement := range statements {
		if _, err := tx.ExecContext(ctx, statement); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *reservationStore) migrateScheduleDateTimeFormat(ctx context.Context) error {
	_, err := s.db.ExecContext(
		ctx,
		`UPDATE schedules
		    SET start_at = CASE
		            WHEN substr(start_at, 11, 1) = ' ' AND length(start_at) = 16
		                THEN substr(start_at, 1, 10) || 'T' || substr(start_at, 12, 5) || ':00+09:00'
		            WHEN substr(start_at, 11, 1) = ' ' AND length(start_at) = 19
		                THEN substr(start_at, 1, 10) || 'T' || substr(start_at, 12, 8) || '+09:00'
		            ELSE start_at
		        END,
		        end_at = CASE
		            WHEN substr(end_at, 11, 1) = ' ' AND length(end_at) = 16
		                THEN substr(end_at, 1, 10) || 'T' || substr(end_at, 12, 5) || ':00+09:00'
		            WHEN substr(end_at, 11, 1) = ' ' AND length(end_at) = 19
		                THEN substr(end_at, 1, 10) || 'T' || substr(end_at, 12, 8) || '+09:00'
		            ELSE end_at
		        END
		  WHERE substr(start_at, 11, 1) = ' '
		     OR substr(end_at, 11, 1) = ' '`,
	)
	return err
}

func (s *reservationStore) migrateReservationDetails(ctx context.Context) error {
	columns, err := s.tableColumns(ctx, "reservation_details")
	if err != nil {
		return err
	}

	statements := []string{}
	if !columns["quantity"] {
		statements = append(statements, `ALTER TABLE reservation_details ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1`)
	}
	if !columns["unit_price"] {
		statements = append(statements, `ALTER TABLE reservation_details ADD COLUMN unit_price INTEGER NOT NULL DEFAULT 0`)
	}
	if !columns["subtotal"] {
		statements = append(statements, `ALTER TABLE reservation_details ADD COLUMN subtotal INTEGER NOT NULL DEFAULT 0`)
	}
	for _, statement := range statements {
		if _, err := s.db.ExecContext(ctx, statement); err != nil {
			return err
		}
	}

	_, err = s.db.ExecContext(
		ctx,
		`UPDATE reservation_details
		    SET quantity = COALESCE((
		            SELECT CASE
		                WHEN COUNT(rs.seat_id) / CASE WHEN tt.required_seat_count > 0 THEN tt.required_seat_count ELSE 1 END > 0
		                    THEN COUNT(rs.seat_id) / CASE WHEN tt.required_seat_count > 0 THEN tt.required_seat_count ELSE 1 END
		                ELSE 1
		            END
		              FROM ticket_types AS tt
		              LEFT JOIN reservation_seats AS rs ON rs.reservation_detail_id = reservation_details.id
		             WHERE tt.id = reservation_details.ticket_type_id
		             GROUP BY tt.required_seat_count
		        ), quantity)
		  WHERE quantity <= 1`,
	)
	if err != nil {
		return err
	}

	if columns["price"] {
		if _, err := s.db.ExecContext(ctx, `UPDATE reservation_details SET subtotal = price WHERE subtotal = 0 AND price >= 0`); err != nil {
			return err
		}
	}
	_, err = s.db.ExecContext(
		ctx,
		`UPDATE reservation_details
		    SET unit_price = CASE WHEN quantity > 0 THEN subtotal / quantity ELSE subtotal END
		  WHERE unit_price = 0
		    AND subtotal > 0`,
	)
	return err
}

func (s *reservationStore) migrateReservationDeadlines(ctx context.Context) error {
	reservationColumns, err := s.tableColumns(ctx, "reservations")
	if err != nil {
		return err
	}
	if !reservationColumns["seat_hold_expires_at"] {
		if _, err := s.db.ExecContext(ctx, `ALTER TABLE reservations ADD COLUMN seat_hold_expires_at TEXT`); err != nil {
			return err
		}
	}

	paymentColumns, err := s.tableColumns(ctx, "payments")
	if err != nil {
		return err
	}
	if !paymentColumns["payment_due_at"] {
		if _, err := s.db.ExecContext(ctx, `ALTER TABLE payments ADD COLUMN payment_due_at TEXT`); err != nil {
			return err
		}
	}

	if _, err := s.db.ExecContext(
		ctx,
		`UPDATE reservations
		    SET seat_hold_expires_at = strftime('%Y-%m-%dT%H:%M:%SZ', reserved_at, '+30 minutes')
		  WHERE status = 'pending'
		    AND (seat_hold_expires_at IS NULL OR seat_hold_expires_at = '')`,
	); err != nil {
		return err
	}
	if _, err := s.db.ExecContext(
		ctx,
		`UPDATE payments
		    SET payment_due_at = (
		            SELECT r.seat_hold_expires_at
		              FROM reservations AS r
		             WHERE r.id = payments.reservation_id
		        )
		  WHERE status = 'unpaid'
		    AND (payment_due_at IS NULL OR payment_due_at = '')`,
	); err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx, `CREATE INDEX IF NOT EXISTS idx_reservations_status_hold_expires_at ON reservations(status, seat_hold_expires_at)`)
	return err
}

func (s *reservationStore) migratePaymentIDs(ctx context.Context) error {
	tableSQL, err := s.tableSQL(ctx, "payments")
	if err != nil {
		return err
	}
	if !strings.Contains(tableSQL, "GLOB 'P[0-9][0-9][0-9]'") {
		return nil
	}

	conn, err := s.db.Conn(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()

	if _, err := conn.ExecContext(ctx, `PRAGMA foreign_keys = OFF`); err != nil {
		return err
	}
	defer conn.ExecContext(context.Background(), `PRAGMA foreign_keys = ON`)

	tx, err := conn.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	statements := []string{
		`DROP TABLE IF EXISTS payments_new`,
		`CREATE TABLE payments_new (
			id                 TEXT    PRIMARY KEY,
			reservation_id     TEXT    NOT NULL REFERENCES reservations(id) ON DELETE RESTRICT,
			payment_method_id  TEXT    NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT,
			amount             INTEGER NOT NULL CHECK (amount >= 0),
			status             TEXT    NOT NULL DEFAULT 'unpaid'
			                        CHECK (status IN ('unpaid', 'paid', 'failed', 'refunded', 'cancelled')),
			paid_at            TEXT,
			payment_due_at     TEXT,
			created_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
			updated_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
			CHECK (id GLOB 'P[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]')
		)`,
		`INSERT INTO payments_new
			(id, reservation_id, payment_method_id, amount, status, paid_at, payment_due_at, created_at, updated_at)
		 SELECT CASE
		            WHEN id GLOB 'P[0-9][0-9][0-9]' THEN 'P' || printf('%010d', CAST(substr(id, 2) AS INTEGER))
		            ELSE id
		        END,
		        reservation_id,
		        payment_method_id,
		        amount,
		        status,
		        paid_at,
		        payment_due_at,
		        created_at,
		        updated_at
		   FROM payments`,
		`DROP TABLE payments`,
		`ALTER TABLE payments_new RENAME TO payments`,
		`CREATE INDEX IF NOT EXISTS idx_payments_reservation_id ON payments(reservation_id)`,
	}
	for _, statement := range statements {
		if _, err := tx.ExecContext(ctx, statement); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *reservationStore) tableSQL(ctx context.Context, table string) (string, error) {
	var tableSQL string
	err := s.db.QueryRowContext(
		ctx,
		`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`,
		table,
	).Scan(&tableSQL)
	return tableSQL, err
}

func (s *reservationStore) tableColumns(ctx context.Context, table string) (map[string]bool, error) {
	rows, err := s.db.QueryContext(ctx, fmt.Sprintf("PRAGMA table_info(%s)", table))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	columns := map[string]bool{}
	for rows.Next() {
		var (
			cid        int
			name       string
			columnType string
			notNull    int
			defaultVal sql.NullString
			pk         int
		)
		if err := rows.Scan(&cid, &name, &columnType, &notNull, &defaultVal, &pk); err != nil {
			return nil, err
		}
		columns[name] = true
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return columns, nil
}

func (s *reservationStore) expireStaleSeatHolds(ctx context.Context, now string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := expireStaleSeatHoldsTx(ctx, tx, now); err != nil {
		return err
	}
	return tx.Commit()
}

func expireStaleSeatHoldsTx(ctx context.Context, tx *sql.Tx, now string) error {
	_, err := tx.ExecContext(
		ctx,
		`DELETE FROM reservation_seats
		  WHERE reservation_detail_id IN (
		      SELECT rd.id
		        FROM reservation_details AS rd
		        JOIN reservations AS r ON r.id = rd.reservation_id
		       WHERE r.status = 'pending'
		         AND r.seat_hold_expires_at IS NOT NULL
		         AND r.seat_hold_expires_at <= ?
		  )`,
		now,
	)
	if err != nil {
		return err
	}

	_, err = tx.ExecContext(
		ctx,
		`UPDATE payments
		    SET status = 'cancelled',
		        updated_at = ?
		  WHERE status = 'unpaid'
		    AND reservation_id IN (
		        SELECT id
		          FROM reservations
		         WHERE status = 'pending'
		           AND seat_hold_expires_at IS NOT NULL
		           AND seat_hold_expires_at <= ?
		    )`,
		now,
		now,
	)
	if err != nil {
		return err
	}

	_, err = tx.ExecContext(
		ctx,
		`UPDATE reservations
		    SET status = 'expired',
		        updated_at = ?
		  WHERE status = 'pending'
		    AND seat_hold_expires_at IS NOT NULL
		    AND seat_hold_expires_at <= ?`,
		now,
		now,
	)
	return err
}

func (s *reservationStore) Availability(ctx context.Context, req reservationCreateRequest) (reservationAvailabilityResponse, error) {
	showtime, err := s.resolveShowtime(ctx, req)
	if err != nil {
		return reservationAvailabilityResponse{}, err
	}

	now := time.Now().UTC().Format(time.RFC3339)
	if err := s.expireStaleSeatHolds(ctx, now); err != nil {
		return reservationAvailabilityResponse{}, err
	}

	rows, err := s.db.QueryContext(
		ctx,
		`SELECT st.seat_code
		   FROM reservation_seats AS rs
		   JOIN seats AS st ON st.id = rs.seat_id
		   JOIN reservation_details AS rd ON rd.id = rs.reservation_detail_id
		   JOIN reservations AS r ON r.id = rd.reservation_id
		  WHERE rs.schedule_id = ?
		    AND (
		        r.status IN ('confirmed', 'used')
		        OR (r.status = 'pending' AND r.seat_hold_expires_at > ?)
		    )
		  ORDER BY st.seat_code`,
		showtime.id,
		now,
	)
	if err != nil {
		return reservationAvailabilityResponse{}, err
	}
	defer rows.Close()

	reservedSeats := []string{}
	for rows.Next() {
		var seatCode string
		if err := rows.Scan(&seatCode); err != nil {
			return reservationAvailabilityResponse{}, err
		}
		reservedSeats = append(reservedSeats, seatCode)
	}
	if err := rows.Err(); err != nil {
		return reservationAvailabilityResponse{}, err
	}

	return reservationAvailabilityResponse{
		ScheduleID:    showtime.id,
		ReservedSeats: reservedSeats,
	}, nil
}

// SchedulesAvailability returns the seat occupancy of every showtime so the
// schedule page can display 余裕あり / 残りわずか / 販売終了 from live data.
func (s *reservationStore) SchedulesAvailability(ctx context.Context) ([]scheduleAvailabilityItem, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	if err := s.expireStaleSeatHolds(ctx, now); err != nil {
		return nil, err
	}

	rows, err := s.db.QueryContext(
		ctx,
		`SELECT sch.id, sch.movie_id, sch.screen_id, sch.start_at, sch.end_at,
		        (SELECT COUNT(*)
		           FROM seats AS seat
		          WHERE seat.screen_id = sch.screen_id
		            AND seat.is_active = 1) AS capacity,
		        (SELECT COUNT(*)
		           FROM reservation_seats AS rs
		           JOIN reservation_details AS rd ON rd.id = rs.reservation_detail_id
		           JOIN reservations AS r ON r.id = rd.reservation_id
		          WHERE rs.schedule_id = sch.id
		            AND (
		                r.status IN ('confirmed', 'used')
		                OR (r.status = 'pending' AND r.seat_hold_expires_at > ?)
		            )) AS reserved
		   FROM schedules AS sch
		   JOIN screens AS scr ON scr.id = sch.screen_id
		  ORDER BY sch.start_at, sch.id`,
		now,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []scheduleAvailabilityItem{}
	for rows.Next() {
		var (
			id, movieID, screenID, startAt, endAt string
			capacity, reserved                    int
		)
		if err := rows.Scan(&id, &movieID, &screenID, &startAt, &endAt, &capacity, &reserved); err != nil {
			return nil, err
		}
		remaining := capacity - reserved
		if remaining < 0 {
			remaining = 0
		}
		items = append(items, scheduleAvailabilityItem{
			ScheduleID: id,
			MovieID:    trailingInt(movieID),
			Screen:     trailingInt(screenID),
			Start:      clockFromTimestamp(startAt),
			End:        clockFromTimestamp(endAt),
			Capacity:   capacity,
			Reserved:   reserved,
			Remaining:  remaining,
			Status:     occupancyStatus(capacity, reserved),
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

// occupancyStatus maps seat occupancy to the schedule page status keys.
// Thresholds are kept in sync with db/seed.sql の占有目標.
func occupancyStatus(capacity, reserved int) string {
	remaining := capacity - reserved
	if capacity <= 0 {
		return "ok"
	}
	if remaining <= 0 {
		return "soldout"
	}
	if remaining*100 <= capacity*15 {
		return "few"
	}
	return "ok"
}

// trailingInt extracts the trailing numeric part of an ID such as "M001" -> 1
// or "SCR012" -> 12, so the schedule page can match its numeric mock data.
func trailingInt(id string) int {
	start := len(id)
	for start > 0 && id[start-1] >= '0' && id[start-1] <= '9' {
		start--
	}
	number, err := strconv.Atoi(id[start:])
	if err != nil {
		return 0
	}
	return number
}

// clockFromTimestamp returns the "HH:MM" portion of "2026-05-23 10:00".
func clockFromTimestamp(value string) string {
	if len(value) >= 16 {
		return value[11:16]
	}
	return value
}

func dateFromTimestamp(value string) string {
	if len(value) >= 10 {
		return value[:10]
	}
	return value
}

func (s *reservationStore) Lookup(ctx context.Context, req reservationLookupRequest) (reservationLookupResponse, error) {
	req = normalizeReservationLookupRequest(req)
	if err := validateReservationLookupRequest(req); err != nil {
		return reservationLookupResponse{}, err
	}

	if err := s.expireStaleSeatHolds(ctx, time.Now().UTC().Format(time.RFC3339)); err != nil {
		return reservationLookupResponse{}, err
	}

	var (
		response              reservationLookupResponse
		startAt, endAt        string
		paymentMethod, status string
		amount                int
	)
	err := s.db.QueryRowContext(
		ctx,
		`SELECT r.id, r.status, r.customer_name, r.customer_email, r.customer_tel,
		        sch.start_at, sch.end_at, m.title, scr.name,
		        COALESCE(pm.name, ''), COALESCE(p.status, ''), COALESCE(p.amount, 0)
		   FROM reservations AS r
		   JOIN schedules AS sch ON sch.id = r.schedule_id
		   JOIN movies AS m ON m.id = sch.movie_id
		   JOIN screens AS scr ON scr.id = sch.screen_id
		   LEFT JOIN payments AS p ON p.reservation_id = r.id
		   LEFT JOIN payment_methods AS pm ON pm.id = p.payment_method_id
		  WHERE r.id = ?
		    AND lower(r.customer_email) = ?
		    AND r.customer_tel = ?
		  ORDER BY p.created_at DESC
		  LIMIT 1`,
		req.ReservationID,
		req.Email,
		req.Tel,
	).Scan(
		&response.ReservationID,
		&response.Status,
		&response.Customer.Name,
		&response.Customer.Email,
		&response.Customer.Tel,
		&startAt,
		&endAt,
		&response.MovieTitle,
		&response.Screen,
		&paymentMethod,
		&status,
		&amount,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return reservationLookupResponse{}, errReservationNotFound
	}
	if err != nil {
		return reservationLookupResponse{}, err
	}

	response.Date = dateFromTimestamp(startAt)
	response.Start = clockFromTimestamp(startAt)
	response.End = clockFromTimestamp(endAt)
	response.Payment = reservationLookupPayment{
		Method: paymentMethod,
		Status: status,
		Amount: amount,
	}

	seats, err := s.reservationSeatCodes(ctx, response.ReservationID)
	if err != nil {
		return reservationLookupResponse{}, err
	}
	response.Seats = seats

	tickets, err := s.reservationTickets(ctx, response.ReservationID)
	if err != nil {
		return reservationLookupResponse{}, err
	}
	response.Tickets = tickets

	return response, nil
}

func (s *reservationStore) PreviewCoupon(ctx context.Context, req couponPreviewRequest) (couponPreviewResponse, error) {
	createReq := normalizeReservationRequest(reservationCreateRequest{
		MovieID:    req.MovieID,
		Screen:     req.Screen,
		Start:      req.Start,
		End:        req.End,
		Date:       req.Date,
		Seats:      req.Seats,
		Tickets:    req.Tickets,
		CouponCode: req.CouponCode,
	})
	if createReq.MovieID == "" || createReq.Screen == "" || createReq.Start == "" {
		return couponPreviewResponse{}, validationError("上映回を指定してください。")
	}
	if createReq.CouponCode == "" {
		return couponPreviewResponse{}, validationError("クーポンコードを入力してください。")
	}
	if len(createReq.CouponCode) > maxCouponCodeLength || !couponCodePattern.MatchString(createReq.CouponCode) {
		return couponPreviewResponse{}, validationError("クーポンコードを正しく入力してください。")
	}

	showtime, err := s.resolveShowtime(ctx, createReq)
	if err != nil {
		return couponPreviewResponse{}, err
	}
	tickets, err := s.resolveTickets(ctx, createReq.Tickets)
	if err != nil {
		return couponPreviewResponse{}, err
	}

	requiredSeatCount := 0
	ticketSubtotal := 0
	for _, ticket := range tickets {
		requiredSeatCount += ticket.requiredSeatCount * ticket.count
		ticketSubtotal += effectiveTicketPrice(ticket.code, ticket.price, createReq.Date) * ticket.count
	}
	seatCount := len(createReq.Seats)
	if seatCount == 0 {
		seatCount = requiredSeatCount
	}

	coupon, discount, err := s.resolveCouponInfo(ctx, createReq.CouponCode, showtime.startAt, seatCount, ticketSubtotal)
	if err != nil {
		return couponPreviewResponse{}, err
	}
	return couponPreviewResponse{
		Code:        coupon.code,
		Name:        coupon.name,
		Description: coupon.description,
		Discount:    discount,
	}, nil
}

func (s *reservationStore) reservationSeatCodes(ctx context.Context, reservationID string) ([]string, error) {
	rows, err := s.db.QueryContext(
		ctx,
		`SELECT st.seat_code
		   FROM reservation_seats AS rs
		   JOIN seats AS st ON st.id = rs.seat_id
		   JOIN reservation_details AS rd ON rd.id = rs.reservation_detail_id
		  WHERE rd.reservation_id = ?
		  ORDER BY st.seat_code`,
		reservationID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	seats := []string{}
	for rows.Next() {
		var seat string
		if err := rows.Scan(&seat); err != nil {
			return nil, err
		}
		seats = append(seats, seat)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return seats, nil
}

func (s *reservationStore) reservationTickets(ctx context.Context, reservationID string) ([]reservationLookupTicket, error) {
	rows, err := s.db.QueryContext(
		ctx,
		`SELECT tt.code, tt.name, rd.quantity, rd.subtotal
		   FROM reservation_details AS rd
		   JOIN ticket_types AS tt ON tt.id = rd.ticket_type_id
		  WHERE rd.reservation_id = ?
		  ORDER BY tt.display_order, rd.id`,
		reservationID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tickets := []reservationLookupTicket{}
	for rows.Next() {
		var ticket reservationLookupTicket
		if err := rows.Scan(&ticket.Code, &ticket.Name, &ticket.Count, &ticket.Price); err != nil {
			return nil, err
		}
		if ticket.Count <= 0 {
			ticket.Count = 1
		}
		tickets = append(tickets, ticket)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return tickets, nil
}

func (s *reservationStore) Create(ctx context.Context, req reservationCreateRequest, member *memberResponse) (reservationCreateResponse, error) {
	req = normalizeReservationRequest(req)
	if err := validateReservationRequest(req); err != nil {
		return reservationCreateResponse{}, err
	}

	showtime, err := s.resolveShowtime(ctx, req)
	if err != nil {
		return reservationCreateResponse{}, err
	}

	seats, err := s.resolveSeats(ctx, showtime.screenID, req.Seats)
	if err != nil {
		return reservationCreateResponse{}, err
	}

	tickets, err := s.resolveTickets(ctx, req.Tickets)
	if err != nil {
		return reservationCreateResponse{}, err
	}

	requiredSeatCount := 0
	ticketSubtotal := 0
	for _, ticket := range tickets {
		requiredSeatCount += ticket.requiredSeatCount * ticket.count
		ticketSubtotal += effectiveTicketPrice(ticket.code, ticket.price, req.Date) * ticket.count
	}
	if requiredSeatCount != len(seats) {
		return reservationCreateResponse{}, validationError("券種の必要座席数と選択座席数が一致していません。")
	}

	paymentMethodID, err := s.resolvePaymentMethod(ctx, req.PaymentMethod)
	if err != nil {
		return reservationCreateResponse{}, err
	}

	couponID, discount, err := s.resolveCoupon(ctx, req.CouponCode, showtime.startAt, len(seats), ticketSubtotal)
	if err != nil {
		return reservationCreateResponse{}, err
	}

	total := ticketSubtotal + screenSurcharge(showtime.screenID, len(seats)) - discount
	if total < 0 {
		total = 0
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return reservationCreateResponse{}, err
	}
	defer tx.Rollback()

	nowTime := time.Now().UTC()
	now := nowTime.Format(time.RFC3339)
	if err := expireStaleSeatHoldsTx(ctx, tx, now); err != nil {
		return reservationCreateResponse{}, err
	}

	if err := ensureSeatsAvailable(ctx, tx, showtime.id, seats, now); err != nil {
		return reservationCreateResponse{}, err
	}

	reservationID, err := createNumericID(ctx, tx, "reservations", "R", 10)
	if err != nil {
		return reservationCreateResponse{}, err
	}

	customer := req.Customer
	var memberID any = nil
	if member != nil {
		memberID = member.ID
		if customer.Name == "" {
			customer.Name = member.Name
		}
		if customer.NameKana == "" {
			customer.NameKana = member.NameKana
		}
		if customer.Email == "" {
			customer.Email = member.Email
		}
		if customer.Tel == "" {
			customer.Tel = member.Tel
		}
	}

	status := "confirmed"
	var seatHoldExpiresAt any = nil
	if req.PaymentMethod == "konbini" {
		status = "pending"
		seatHoldExpiresAt = nowTime.Add(reservationSeatHoldDuration).Format(time.RFC3339)
	}

	_, err = tx.ExecContext(
		ctx,
		`INSERT INTO reservations
			(id, schedule_id, member_id, coupon_id, customer_name, customer_name_kana,
			 customer_email, customer_tel, status, reserved_at, seat_hold_expires_at, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		reservationID,
		showtime.id,
		memberID,
		nullableString(couponID),
		customer.Name,
		customer.NameKana,
		customer.Email,
		customer.Tel,
		status,
		now,
		seatHoldExpiresAt,
		now,
		now,
	)
	if err != nil {
		return reservationCreateResponse{}, err
	}

	nextSeat := 0
	for _, ticket := range tickets {
		detailID, err := createNumericID(ctx, tx, "reservation_details", "RD", 10)
		if err != nil {
			return reservationCreateResponse{}, err
		}
		detailSeatCount := ticket.requiredSeatCount * ticket.count
		detailSeats := seats[nextSeat : nextSeat+detailSeatCount]
		nextSeat += detailSeatCount

		_, err = tx.ExecContext(
			ctx,
			`INSERT INTO reservation_details
				(id, reservation_id, ticket_type_id, quantity, unit_price, subtotal, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			detailID,
			reservationID,
			ticket.id,
			ticket.count,
			effectiveTicketPrice(ticket.code, ticket.price, req.Date),
			effectiveTicketPrice(ticket.code, ticket.price, req.Date)*ticket.count,
			now,
			now,
		)
		if err != nil {
			return reservationCreateResponse{}, err
		}

		for _, seat := range detailSeats {
			_, err = tx.ExecContext(
				ctx,
				`INSERT INTO reservation_seats
					(reservation_detail_id, schedule_id, seat_id, created_at)
				 VALUES (?, ?, ?, ?)`,
				detailID,
				showtime.id,
				seat.id,
				now,
			)
			if err != nil {
				if isUniqueConstraintError(err) {
					return reservationCreateResponse{}, errSeatAlreadyReserved
				}
				return reservationCreateResponse{}, err
			}
		}
	}

	paymentID, err := createNumericID(ctx, tx, "payments", "P", 10)
	if err != nil {
		return reservationCreateResponse{}, err
	}
	paymentStatus := "paid"
	var paidAt any = now
	var paymentDueAt any = nil
	if req.PaymentMethod == "konbini" {
		paymentStatus = "unpaid"
		paidAt = nil
		paymentDueAt = seatHoldExpiresAt
	}
	_, err = tx.ExecContext(
		ctx,
		`INSERT INTO payments
			(id, reservation_id, payment_method_id, amount, status, paid_at, payment_due_at, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		paymentID,
		reservationID,
		paymentMethodID,
		total,
		paymentStatus,
		paidAt,
		paymentDueAt,
		now,
		now,
	)
	if err != nil {
		return reservationCreateResponse{}, err
	}

	if err := tx.Commit(); err != nil {
		return reservationCreateResponse{}, err
	}

	return reservationCreateResponse{
		ReservationID:  reservationID,
		ConfirmationNo: reservationID,
		Amount:         total,
		Status:         status,
	}, nil
}

func (s *reservationStore) resolveShowtime(ctx context.Context, req reservationCreateRequest) (resolvedShowtime, error) {
	movieID, err := normalizeMovieID(req.MovieID)
	if err != nil {
		return resolvedShowtime{}, err
	}
	screenID, err := normalizeScreenID(req.Screen)
	if err != nil {
		return resolvedShowtime{}, err
	}
	startTime := normalizeClock(req.Start)
	if startTime == "" {
		return resolvedShowtime{}, validationError("上映開始時刻を指定してください。")
	}

	var showtime resolvedShowtime
	err = s.db.QueryRowContext(
		ctx,
		`SELECT id, movie_id, screen_id, start_at
		   FROM schedules
		  WHERE movie_id = ?
		    AND screen_id = ?
		    AND substr(start_at, 12, 5) = ?
		  ORDER BY start_at
		  LIMIT 1`,
		movieID,
		screenID,
		startTime,
	).Scan(&showtime.id, &showtime.movieID, &showtime.screenID, &showtime.startAt)
	if errors.Is(err, sql.ErrNoRows) {
		return resolvedShowtime{}, errShowtimeNotFound
	}
	if err != nil {
		return resolvedShowtime{}, err
	}
	return showtime, nil
}

func (s *reservationStore) resolveSeats(ctx context.Context, screenID string, seatCodes []string) ([]resolvedSeat, error) {
	if len(seatCodes) == 0 {
		return nil, validationError("座席を選択してください。")
	}

	seats := make([]resolvedSeat, 0, len(seatCodes))
	for _, seatCode := range seatCodes {
		var seat resolvedSeat
		err := s.db.QueryRowContext(
			ctx,
			`SELECT id, seat_code
			   FROM seats
			  WHERE screen_id = ?
			    AND seat_code = ?
			    AND is_active = 1`,
			screenID,
			seatCode,
		).Scan(&seat.id, &seat.code)
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("%w: %s", errSeatNotFound, seatCode)
		}
		if err != nil {
			return nil, err
		}
		seats = append(seats, seat)
	}

	return seats, nil
}

func (s *reservationStore) resolveTickets(ctx context.Context, requested map[string]int) ([]resolvedTicket, error) {
	tickets := []resolvedTicket{}
	for code, count := range requested {
		code = strings.TrimSpace(strings.ToLower(code))
		if code == "" || count <= 0 {
			continue
		}

		var ticket resolvedTicket
		err := s.db.QueryRowContext(
			ctx,
			`SELECT id, code, price, required_seat_count
			   FROM ticket_types
			  WHERE code = ?
			    AND is_active = 1`,
			code,
		).Scan(&ticket.id, &ticket.code, &ticket.price, &ticket.requiredSeatCount)
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("%w: %s", errTicketTypeNotFound, code)
		}
		if err != nil {
			return nil, err
		}
		ticket.count = count
		tickets = append(tickets, ticket)
	}

	if len(tickets) == 0 {
		return nil, validationError("券種を選択してください。")
	}
	sort.Slice(tickets, func(i, j int) bool {
		return tickets[i].id < tickets[j].id
	})
	return tickets, nil
}

func (s *reservationStore) resolvePaymentMethod(ctx context.Context, code string) (string, error) {
	code = strings.TrimSpace(strings.ToLower(code))
	if code == "" {
		return "", validationError("支払方法を選択してください。")
	}

	var id string
	err := s.db.QueryRowContext(
		ctx,
		`SELECT id FROM payment_methods WHERE code = ? AND is_active = 1`,
		code,
	).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return "", fmt.Errorf("%w: %s", errPaymentMethodNotFound, code)
	}
	if err != nil {
		return "", err
	}
	return id, nil
}

func (s *reservationStore) resolveCoupon(ctx context.Context, code string, startAt string, seatCount int, subtotal int) (string, int, error) {
	coupon, discount, err := s.resolveCouponInfo(ctx, code, startAt, seatCount, subtotal)
	if err != nil {
		return "", 0, err
	}
	return coupon.id, discount, nil
}

func (s *reservationStore) resolveCouponInfo(ctx context.Context, code string, startAt string, seatCount int, subtotal int) (resolvedCoupon, int, error) {
	code = strings.TrimSpace(strings.ToUpper(code))
	if code == "" {
		return resolvedCoupon{}, 0, nil
	}

	var coupon resolvedCoupon
	err := s.db.QueryRowContext(
		ctx,
		`SELECT id, code, rule_code, name, COALESCE(description, ''), discount_amount
		   FROM coupons
		  WHERE code = ?
		    AND is_active = 1`,
		code,
	).Scan(&coupon.id, &coupon.code, &coupon.ruleCode, &coupon.name, &coupon.description, &coupon.discountAmount)
	if errors.Is(err, sql.ErrNoRows) {
		return resolvedCoupon{}, 0, validationError("このクーポンコードは利用できません。")
	}
	if err != nil {
		return resolvedCoupon{}, 0, err
	}

	switch coupon.ruleCode {
	case "late_show":
		if showtimeHour(startAt) < 20 {
			return resolvedCoupon{}, 0, validationError("この上映回ではレイトショー割引を利用できません。")
		}
	case "group":
		if seatCount < 4 {
			return resolvedCoupon{}, 0, validationError("グループ割引は4席以上で利用できます。")
		}
	}

	discount := coupon.discountAmount * seatCount
	if discount > subtotal {
		discount = subtotal
	}
	return coupon, discount, nil
}

func ensureSeatsAvailable(ctx context.Context, tx *sql.Tx, scheduleID string, seats []resolvedSeat, now string) error {
	for _, seat := range seats {
		var code string
		err := tx.QueryRowContext(
			ctx,
			`SELECT st.seat_code
			   FROM reservation_seats AS rs
			   JOIN seats AS st ON st.id = rs.seat_id
			   JOIN reservation_details AS rd ON rd.id = rs.reservation_detail_id
			   JOIN reservations AS r ON r.id = rd.reservation_id
			  WHERE rs.schedule_id = ?
			    AND rs.seat_id = ?
			    AND (
			        r.status IN ('confirmed', 'used')
			        OR (r.status = 'pending' AND r.seat_hold_expires_at > ?)
			    )
			  LIMIT 1`,
			scheduleID,
			seat.id,
			now,
		).Scan(&code)
		if errors.Is(err, sql.ErrNoRows) {
			continue
		}
		if err != nil {
			return err
		}
		return fmt.Errorf("%w: %s", errSeatAlreadyReserved, code)
	}
	return nil
}

func normalizeReservationRequest(req reservationCreateRequest) reservationCreateRequest {
	req.MovieID = strings.TrimSpace(req.MovieID)
	req.Screen = strings.TrimSpace(req.Screen)
	req.Start = normalizeClock(req.Start)
	req.End = normalizeClock(req.End)
	req.Date = strings.TrimSpace(req.Date)
	req.CouponCode = strings.TrimSpace(strings.ToUpper(req.CouponCode))
	req.PaymentMethod = strings.TrimSpace(strings.ToLower(req.PaymentMethod))
	req.Customer.Name = strings.TrimSpace(req.Customer.Name)
	req.Customer.NameKana = strings.TrimSpace(req.Customer.NameKana)
	req.Customer.Email = strings.ToLower(strings.TrimSpace(req.Customer.Email))
	req.Customer.Tel = strings.TrimSpace(req.Customer.Tel)

	seenSeats := map[string]bool{}
	normalizedSeats := []string{}
	for _, seat := range req.Seats {
		seat = strings.ToUpper(strings.TrimSpace(seat))
		if seat == "" || seenSeats[seat] {
			continue
		}
		seenSeats[seat] = true
		normalizedSeats = append(normalizedSeats, seat)
	}
	req.Seats = normalizedSeats
	return req
}

func normalizeReservationLookupRequest(req reservationLookupRequest) reservationLookupRequest {
	if strings.TrimSpace(req.ReservationID) == "" {
		req.ReservationID = req.ConfirmationNo
	}
	req.ReservationID = strings.ToUpper(strings.TrimSpace(req.ReservationID))
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Tel = strings.TrimSpace(req.Tel)
	return req
}

func validateReservationRequest(req reservationCreateRequest) error {
	if req.MovieID == "" || req.Screen == "" || req.Start == "" {
		return validationError("上映回を指定してください。")
	}
	if exceedsRunes(req.Date, maxDateLabelRunes) || hasControlChars(req.Date) {
		return validationError("鑑賞日を正しく指定してください。")
	}
	if req.Customer.Name == "" {
		return validationError("購入者氏名を入力してください。")
	}
	if req.Customer.NameKana == "" {
		return validationError("購入者氏名（かな）を入力してください。")
	}
	if exceedsRunes(req.Customer.Name, maxPersonNameRunes) {
		return validationError("購入者氏名は40文字以内で入力してください。")
	}
	if exceedsRunes(req.Customer.NameKana, maxPersonKanaRunes) {
		return validationError("購入者氏名（かな）は60文字以内で入力してください。")
	}
	if hasControlChars(req.Customer.Name) || hasControlChars(req.Customer.NameKana) {
		return validationError("購入者氏名を正しく入力してください。")
	}
	if !validEmailAddress(req.Customer.Email) {
		return validationError("メールアドレスを正しく入力してください。")
	}
	if !memberPhonePattern.MatchString(req.Customer.Tel) {
		return validationError("電話番号をハイフンなしで入力してください。")
	}
	if req.PaymentMethod == "" {
		return validationError("支払方法を選択してください。")
	}
	if len(req.PaymentMethod) > maxPaymentMethodLength || hasControlChars(req.PaymentMethod) {
		return validationError("支払方法を正しく指定してください。")
	}
	if req.CouponCode != "" {
		if len(req.CouponCode) > maxCouponCodeLength || !couponCodePattern.MatchString(req.CouponCode) {
			return validationError("クーポンコードを正しく入力してください。")
		}
	}
	if len(req.Tickets) > maxTicketTypeCount {
		return validationError("券種の指定数が多すぎます。")
	}
	for code, count := range req.Tickets {
		if len(code) > 32 || hasControlChars(code) {
			return validationError("券種を正しく指定してください。")
		}
		if count < 0 || count > 6 {
			return validationError("券種の枚数を正しく指定してください。")
		}
	}
	if len(req.Seats) == 0 {
		return validationError("座席を選択してください。")
	}
	if len(req.Seats) > 6 {
		return validationError("一度に予約できる座席は6席までです。")
	}
	for _, seat := range req.Seats {
		if len(seat) > maxSeatCodeLength || hasControlChars(seat) {
			return validationError("座席を正しく指定してください。")
		}
	}
	return nil
}

func validateReservationLookupRequest(req reservationLookupRequest) error {
	if req.ReservationID == "" || len(req.ReservationID) > 32 || hasControlChars(req.ReservationID) {
		return validationError("予約番号を正しく入力してください。")
	}
	if !strings.HasPrefix(req.ReservationID, "R") {
		return validationError("予約番号を正しく入力してください。")
	}
	if !validEmailAddress(req.Email) {
		return validationError("メールアドレスを正しく入力してください。")
	}
	if !memberPhonePattern.MatchString(req.Tel) {
		return validationError("電話番号をハイフンなしで入力してください。")
	}
	return nil
}

func normalizeMovieID(value string) (string, error) {
	value = strings.TrimSpace(strings.ToUpper(value))
	if value == "" {
		return "", validationError("作品IDを指定してください。")
	}
	if strings.HasPrefix(value, "M") {
		return value, nil
	}
	number, err := strconv.Atoi(value)
	if err != nil || number <= 0 {
		return "", validationError("作品IDを正しく指定してください。")
	}
	return fmt.Sprintf("M%03d", number), nil
}

func normalizeScreenID(value string) (string, error) {
	value = strings.TrimSpace(strings.ToUpper(value))
	if value == "" {
		return "", validationError("スクリーンIDを指定してください。")
	}
	if strings.HasPrefix(value, "SCR") {
		return value, nil
	}
	number, err := strconv.Atoi(value)
	if err != nil || number <= 0 {
		return "", validationError("スクリーンIDを正しく指定してください。")
	}
	return fmt.Sprintf("SCR%03d", number), nil
}

func normalizeClock(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	parts := strings.Split(value, ":")
	if len(parts) < 2 {
		return value
	}
	hour, errHour := strconv.Atoi(parts[0])
	minute, errMinute := strconv.Atoi(parts[1])
	if errHour != nil || errMinute != nil {
		return value
	}
	return fmt.Sprintf("%02d:%02d", hour, minute)
}

func isServiceDay(dateLabel string) bool {
	matchValue := strings.TrimSpace(dateLabel)
	for _, fragment := range []string{"/13(", "-13", "/13", " 13"} {
		if strings.Contains(matchValue, fragment) {
			return true
		}
	}
	return false
}

func effectiveTicketPrice(code string, price int, dateLabel string) int {
	if !isServiceDay(dateLabel) {
		return price
	}
	switch code {
	case "pair":
		return 2600
	case "adult", "university", "student", "senior":
		return 1300
	default:
		return price
	}
}

func screenSurcharge(screenID string, seatCount int) int {
	switch screenID {
	case "SCR001", "SCR002", "SCR003":
		return 400 * seatCount
	default:
		return 0
	}
}

func showtimeHour(startAt string) int {
	clock := startAt
	if len(startAt) >= 16 {
		clock = startAt[11:16]
	}
	parts := strings.Split(clock, ":")
	if len(parts) == 0 {
		return 0
	}
	hour, _ := strconv.Atoi(parts[0])
	return hour
}

func nullableString(value string) any {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}

// createNumericID allocates an ID of the form prefix + digitCount 桁のゼロ埋め数字
// (例: R0000000042 / P007)。連番ではなく毎回ランダムな数字を採番し、既存IDと
// 衝突した場合は別の値で採番し直す。桁数は schema.sql の CHECK 制約と一致させる。
func createNumericID(ctx context.Context, tx *sql.Tx, table string, prefix string, digitCount int) (string, error) {
	if digitCount <= 0 {
		return "", fmt.Errorf("invalid digit count for %s", table)
	}

	limit := int64(1)
	for i := 0; i < digitCount; i++ {
		limit *= 10
	}

	existsQuery := fmt.Sprintf("SELECT 1 FROM %s WHERE id = ? LIMIT 1", table)

	// 桁数が小さい(例: P+3桁)ほど候補が枯渇しやすいので、空き番号探索の上限を
	// 候補数に応じて広げつつ固定上限でも頭打ちにする。
	maxAttempts := 100
	if limit < int64(maxAttempts) {
		maxAttempts = int(limit)
	}

	for attempt := 0; attempt < maxAttempts; attempt++ {
		number, err := randomNumberBelow(limit)
		if err != nil {
			return "", err
		}
		candidate := fmt.Sprintf("%s%0*d", prefix, digitCount, number)

		var exists int
		err = tx.QueryRowContext(ctx, existsQuery, candidate).Scan(&exists)
		if errors.Is(err, sql.ErrNoRows) {
			return candidate, nil
		}
		if err != nil {
			return "", err
		}
		// 衝突したので別の番号で採番し直す。
	}

	return "", fmt.Errorf("could not allocate unique id for %s", table)
}

// randomNumberBelow returns a uniformly distributed integer in [0, limit).
func randomNumberBelow(limit int64) (int64, error) {
	number, err := rand.Int(rand.Reader, big.NewInt(limit))
	if err != nil {
		return 0, err
	}
	return number.Int64(), nil
}
