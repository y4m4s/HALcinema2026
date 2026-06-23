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

	return nil
}

func (s *reservationStore) Availability(ctx context.Context, req reservationCreateRequest) (reservationAvailabilityResponse, error) {
	showtime, err := s.resolveShowtime(ctx, req)
	if err != nil {
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
		    AND r.status IN ('pending', 'confirmed', 'used')
		  ORDER BY st.seat_code`,
		showtime.id,
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
	rows, err := s.db.QueryContext(
		ctx,
		`SELECT sch.id, sch.movie_id, sch.screen_id, sch.start_at, sch.end_at,
		        st.capacity,
		        (SELECT COUNT(*)
		           FROM reservation_seats AS rs
		           JOIN reservation_details AS rd ON rd.id = rs.reservation_detail_id
		           JOIN reservations AS r ON r.id = rd.reservation_id
		          WHERE rs.schedule_id = sch.id
		            AND r.status IN ('pending', 'confirmed', 'used')) AS reserved
		   FROM schedules AS sch
		   JOIN screens AS scr ON scr.id = sch.screen_id
		   JOIN screen_types AS st ON st.id = scr.screen_type_id
		  ORDER BY sch.start_at, sch.id`,
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
		`SELECT tt.code, tt.name, rd.price, tt.required_seat_count, COUNT(rs.seat_id)
		   FROM reservation_details AS rd
		   JOIN ticket_types AS tt ON tt.id = rd.ticket_type_id
		   LEFT JOIN reservation_seats AS rs ON rs.reservation_detail_id = rd.id
		  WHERE rd.reservation_id = ?
		  GROUP BY rd.id, tt.code, tt.name, rd.price, tt.required_seat_count, tt.display_order
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
		var requiredSeatCount, seatCount int
		if err := rows.Scan(&ticket.Code, &ticket.Name, &ticket.Price, &requiredSeatCount, &seatCount); err != nil {
			return nil, err
		}
		if requiredSeatCount <= 0 {
			requiredSeatCount = 1
		}
		ticket.Count = seatCount / requiredSeatCount
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

	if err := ensureSeatsAvailable(ctx, tx, showtime.id, seats); err != nil {
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

	now := time.Now().UTC().Format(time.RFC3339)
	status := "confirmed"
	if req.PaymentMethod == "konbini" {
		status = "pending"
	}

	_, err = tx.ExecContext(
		ctx,
		`INSERT INTO reservations
			(id, schedule_id, member_id, coupon_id, customer_name, customer_name_kana,
			 customer_email, customer_tel, status, reserved_at, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
				(id, reservation_id, ticket_type_id, price, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			detailID,
			reservationID,
			ticket.id,
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

	paymentID, err := createNumericID(ctx, tx, "payments", "P", 3)
	if err != nil {
		return reservationCreateResponse{}, err
	}
	paymentStatus := "paid"
	var paidAt any = now
	if req.PaymentMethod == "konbini" {
		paymentStatus = "unpaid"
		paidAt = nil
	}
	_, err = tx.ExecContext(
		ctx,
		`INSERT INTO payments
			(id, reservation_id, payment_method_id, amount, status, paid_at, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		paymentID,
		reservationID,
		paymentMethodID,
		total,
		paymentStatus,
		paidAt,
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
	code = strings.TrimSpace(strings.ToUpper(code))
	if code == "" {
		return "", 0, nil
	}

	var id string
	var discountAmount int
	err := s.db.QueryRowContext(
		ctx,
		`SELECT id, discount_amount
		   FROM coupons
		  WHERE code = ?
		    AND is_active = 1`,
		code,
	).Scan(&id, &discountAmount)
	if errors.Is(err, sql.ErrNoRows) {
		return "", 0, validationError("このクーポンコードは利用できません。")
	}
	if err != nil {
		return "", 0, err
	}

	switch code {
	case "LATE100":
		if showtimeHour(startAt) < 20 {
			return "", 0, validationError("この上映回ではレイトショー割引を利用できません。")
		}
	case "GRUP200":
		if seatCount < 4 {
			return "", 0, validationError("グループ割引は4席以上で利用できます。")
		}
	}

	discount := discountAmount * seatCount
	if discount > subtotal {
		discount = subtotal
	}
	return id, discount, nil
}

func ensureSeatsAvailable(ctx context.Context, tx *sql.Tx, scheduleID string, seats []resolvedSeat) error {
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
			    AND r.status IN ('pending', 'confirmed', 'used')
			  LIMIT 1`,
			scheduleID,
			seat.id,
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
		return validationError("電話番号をハイフン区切りで入力してください。")
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
