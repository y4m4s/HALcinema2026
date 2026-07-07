package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"net/mail"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

const (
	memberSessionTTL       = 30 * 24 * time.Hour
	maxPersonNameRunes     = 40
	maxPersonKanaRunes     = 60
	maxEmailLength         = 254
	maxPasswordRunes       = 128
	maxCouponCodeLength    = 20
	maxLoginIdentifierSize = 254
	maxAPIJSONBodyBytes    = 32 * 1024
	maxSeatCodeLength      = 8
	maxPaymentMethodLength = 24
	maxDateLabelRunes      = 20
	maxTicketTypeCount     = 16
)

var (
	errDuplicateEmail     = errors.New("duplicate email")
	errInvalidCredentials = errors.New("invalid credentials")
	errUnauthorized       = errors.New("unauthorized")
	memberPhonePattern    = regexp.MustCompile(`^[0-9]{2,5}[0-9]{2,5}[0-9]{3,5}$`)
	couponCodePattern     = regexp.MustCompile(`^[A-Z0-9_-]+$`)
)

type validationError string

func (e validationError) Error() string {
	return string(e)
}

type memberStore struct {
	db *sql.DB
}

type memberRegisterRequest struct {
	Name         string `json:"name"`
	NameKana     string `json:"nameKana"`
	Email        string `json:"email"`
	Tel          string `json:"tel"`
	Password     string `json:"password"`
	MailMagazine bool   `json:"mailMagazine"`
}

type memberLoginRequest struct {
	Identifier string `json:"identifier"`
	Password   string `json:"password"`
}

type memberAuthResponse struct {
	Member memberResponse `json:"member"`
	Token  string         `json:"token"`
}

type memberResponse struct {
	ID           int64  `json:"id"`
	Name         string `json:"name"`
	NameKana     string `json:"nameKana"`
	Email        string `json:"email"`
	Tel          string `json:"tel"`
	MailMagazine bool   `json:"mailMagazine"`
	CreatedAt    string `json:"createdAt"`
}

type memberReservationHistoryItem struct {
	ReservationID string `json:"reservationId"`
	Status        string `json:"status"`
	ReservedAt    string `json:"reservedAt"`
	MovieTitle    string `json:"movieTitle"`
	Date          string `json:"date"`
	Start         string `json:"start"`
	End           string `json:"end"`
	Screen        string `json:"screen"`
	Seats         string `json:"seats"`
	PaymentMethod string `json:"paymentMethod"`
	PaymentStatus string `json:"paymentStatus"`
	Amount        int    `json:"amount"`
}

type memberRecord struct {
	memberResponse
	passwordHash string
}

func openMemberStore(dbPath string) (*memberStore, error) {
	if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
		return nil, err
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)

	store := &memberStore{db: db}
	if err := store.init(context.Background()); err != nil {
		db.Close()
		return nil, err
	}

	return store, nil
}

func (s *memberStore) Close() error {
	if s == nil || s.db == nil {
		return nil
	}
	return s.db.Close()
}

func (s *memberStore) init(ctx context.Context) error {
	statements := []string{
		`PRAGMA foreign_keys = ON`,
		`PRAGMA busy_timeout = 5000`,
		`CREATE TABLE IF NOT EXISTS members (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			name_kana TEXT NOT NULL,
			email TEXT NOT NULL UNIQUE COLLATE NOCASE,
			tel TEXT NOT NULL,
			password_hash TEXT NOT NULL,
			mail_magazine INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
		)`,
		`CREATE TABLE IF NOT EXISTS member_sessions (
			token_hash TEXT PRIMARY KEY,
			member_id INTEGER NOT NULL,
			created_at TEXT NOT NULL,
			expires_at TEXT NOT NULL,
			FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
		)`,
		`CREATE INDEX IF NOT EXISTS idx_member_sessions_member_id ON member_sessions(member_id)`,
		`CREATE INDEX IF NOT EXISTS idx_member_sessions_expires_at ON member_sessions(expires_at)`,
	}

	for _, statement := range statements {
		if _, err := s.db.ExecContext(ctx, statement); err != nil {
			return err
		}
	}

	return s.migrateMemberSchema(ctx)
}

func (s *memberStore) migrateMemberSchema(ctx context.Context) error {
	columns, err := s.memberTableColumns(ctx)
	if err != nil {
		return err
	}
	if !columns["member_no"] && !columns["points"] && !columns["updated_at"] {
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
		`DROP TABLE IF EXISTS members_new`,
		`CREATE TABLE members_new (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			name_kana TEXT NOT NULL,
			email TEXT NOT NULL UNIQUE COLLATE NOCASE,
			tel TEXT NOT NULL,
			password_hash TEXT NOT NULL,
			mail_magazine INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
		)`,
		`INSERT INTO members_new
			(id, name, name_kana, email, tel, password_hash, mail_magazine, created_at)
		 SELECT id, name, name_kana, email, tel, password_hash, mail_magazine, created_at
		   FROM members`,
		`DROP TABLE members`,
		`ALTER TABLE members_new RENAME TO members`,
	}
	for _, statement := range statements {
		if _, err := tx.ExecContext(ctx, statement); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *memberStore) memberTableColumns(ctx context.Context) (map[string]bool, error) {
	rows, err := s.db.QueryContext(ctx, `PRAGMA table_info(members)`)
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
	return columns, rows.Err()
}

func (s *memberStore) Register(ctx context.Context, req memberRegisterRequest) (memberResponse, string, error) {
	normalized, err := normalizeRegisterRequest(req)
	if err != nil {
		return memberResponse{}, "", err
	}

	exists, err := s.emailExists(ctx, normalized.Email)
	if err != nil {
		return memberResponse{}, "", err
	}
	if exists {
		return memberResponse{}, "", errDuplicateEmail
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(normalized.Password), bcrypt.DefaultCost)
	if err != nil {
		return memberResponse{}, "", err
	}

	now := time.Now().UTC().Format(time.RFC3339)
	result, err := s.db.ExecContext(
		ctx,
		`INSERT INTO members
			(name, name_kana, email, tel, password_hash, mail_magazine, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		normalized.Name,
		normalized.NameKana,
		normalized.Email,
		normalized.Tel,
		string(passwordHash),
		boolToInt(normalized.MailMagazine),
		now,
	)
	if err != nil {
		if isUniqueConstraintError(err) {
			if exists, checkErr := s.emailExists(ctx, normalized.Email); checkErr == nil && exists {
				return memberResponse{}, "", errDuplicateEmail
			}
		}
		return memberResponse{}, "", err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return memberResponse{}, "", err
	}

	member, err := s.memberByID(ctx, id)
	if err != nil {
		return memberResponse{}, "", err
	}

	token, err := s.createSession(ctx, id)
	if err != nil {
		return memberResponse{}, "", err
	}

	return member, token, nil
}

func (s *memberStore) Login(ctx context.Context, req memberLoginRequest) (memberResponse, string, error) {
	identifier := strings.ToLower(strings.TrimSpace(req.Identifier))
	password := strings.TrimSpace(req.Password)
	if identifier == "" || password == "" {
		return memberResponse{}, "", validationError("IDとパスワードを入力してください。")
	}
	if len(identifier) > maxLoginIdentifierSize || exceedsRunes(password, maxPasswordRunes) {
		return memberResponse{}, "", validationError("IDまたはパスワードが長すぎます。")
	}
	if hasControlChars(identifier) || hasControlChars(password) {
		return memberResponse{}, "", validationError("IDまたはパスワードを正しく入力してください。")
	}

	member, err := s.memberByIdentifier(ctx, identifier)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return memberResponse{}, "", errInvalidCredentials
		}
		return memberResponse{}, "", err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(member.passwordHash), []byte(password)); err != nil {
		return memberResponse{}, "", errInvalidCredentials
	}

	token, err := s.createSession(ctx, member.ID)
	if err != nil {
		return memberResponse{}, "", err
	}

	return member.memberResponse, token, nil
}

func (s *memberStore) MemberByToken(ctx context.Context, token string) (memberResponse, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return memberResponse{}, errUnauthorized
	}

	member, err := s.memberBySessionToken(ctx, token)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return memberResponse{}, errUnauthorized
		}
		return memberResponse{}, err
	}

	return member, nil
}

func (s *memberStore) Logout(ctx context.Context, token string) error {
	token = strings.TrimSpace(token)
	if token == "" {
		return errUnauthorized
	}

	_, err := s.db.ExecContext(ctx, `DELETE FROM member_sessions WHERE token_hash = ?`, hashToken(token))
	return err
}

func (s *memberStore) ReservationHistory(ctx context.Context, memberID int64, period string) ([]memberReservationHistoryItem, error) {
	where := `WHERE r.member_id = ?`
	args := []any{memberID}

	if since := reservationHistorySince(period); since != "" {
		where += ` AND r.reserved_at >= ?`
		args = append(args, since)
	}

	query := fmt.Sprintf(
		`SELECT r.id,
		        r.status,
		        r.reserved_at,
		        m.title,
		        sch.start_at,
		        sch.end_at,
		        scr.name,
		        COALESCE((
		          SELECT group_concat(seat_code, ' / ')
		            FROM (
		              SELECT st.seat_code
		                FROM reservation_details AS rd
		                JOIN reservation_seats AS rs ON rs.reservation_detail_id = rd.id
		                JOIN seats AS st ON st.id = rs.seat_id
		               WHERE rd.reservation_id = r.id
		               ORDER BY st.seat_code
		            )
		        ), ''),
		        COALESCE(pm.name, ''),
		        COALESCE(p.status, ''),
		        COALESCE(p.amount, 0)
		   FROM reservations AS r
		   JOIN schedules AS sch ON sch.id = r.schedule_id
		   JOIN movies AS m ON m.id = sch.movie_id
		   JOIN screens AS scr ON scr.id = sch.screen_id
		   LEFT JOIN payments AS p ON p.reservation_id = r.id
		   LEFT JOIN payment_methods AS pm ON pm.id = p.payment_method_id
		   %s
		   ORDER BY r.reserved_at DESC, r.id DESC
		   LIMIT 50`,
		where,
	)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []memberReservationHistoryItem{}
	for rows.Next() {
		var item memberReservationHistoryItem
		var startAt, endAt string
		if err := rows.Scan(
			&item.ReservationID,
			&item.Status,
			&item.ReservedAt,
			&item.MovieTitle,
			&startAt,
			&endAt,
			&item.Screen,
			&item.Seats,
			&item.PaymentMethod,
			&item.PaymentStatus,
			&item.Amount,
		); err != nil {
			return nil, err
		}
		item.Date = dateFromTimestamp(startAt)
		item.Start = clockFromTimestamp(startAt)
		item.End = clockFromTimestamp(endAt)
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func (s *memberStore) emailExists(ctx context.Context, email string) (bool, error) {
	var id int64
	err := s.db.QueryRowContext(ctx, `SELECT id FROM members WHERE email = ?`, email).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}

func (s *memberStore) memberByID(ctx context.Context, id int64) (memberResponse, error) {
	var member memberResponse
	var mailMagazine int
	err := s.db.QueryRowContext(
		ctx,
		`SELECT id, name, name_kana, email, tel, mail_magazine, created_at
		 FROM members
		 WHERE id = ?`,
		id,
	).Scan(
		&member.ID,
		&member.Name,
		&member.NameKana,
		&member.Email,
		&member.Tel,
		&mailMagazine,
		&member.CreatedAt,
	)
	if err != nil {
		return memberResponse{}, err
	}
	member.MailMagazine = mailMagazine == 1
	return member, nil
}

func (s *memberStore) memberByIdentifier(ctx context.Context, identifier string) (memberRecord, error) {
	var member memberRecord
	var mailMagazine int
	err := s.db.QueryRowContext(
		ctx,
		`SELECT id, name, name_kana, email, tel, password_hash, mail_magazine, created_at
		 FROM members
		 WHERE lower(email) = ? OR CAST(id AS TEXT) = ?`,
		identifier,
		identifier,
	).Scan(
		&member.ID,
		&member.Name,
		&member.NameKana,
		&member.Email,
		&member.Tel,
		&member.passwordHash,
		&mailMagazine,
		&member.CreatedAt,
	)
	if err != nil {
		return memberRecord{}, err
	}
	member.MailMagazine = mailMagazine == 1
	return member, nil
}

func (s *memberStore) memberBySessionToken(ctx context.Context, token string) (memberResponse, error) {
	var member memberResponse
	var mailMagazine int
	now := time.Now().UTC().Format(time.RFC3339)
	err := s.db.QueryRowContext(
		ctx,
		`SELECT m.id, m.name, m.name_kana, m.email, m.tel, m.mail_magazine, m.created_at
		 FROM member_sessions AS s
		 JOIN members AS m ON m.id = s.member_id
		 WHERE s.token_hash = ? AND s.expires_at > ?`,
		hashToken(token),
		now,
	).Scan(
		&member.ID,
		&member.Name,
		&member.NameKana,
		&member.Email,
		&member.Tel,
		&mailMagazine,
		&member.CreatedAt,
	)
	if err != nil {
		return memberResponse{}, err
	}
	member.MailMagazine = mailMagazine == 1
	return member, nil
}

func (s *memberStore) createSession(ctx context.Context, memberID int64) (string, error) {
	token, err := randomToken(32)
	if err != nil {
		return "", err
	}

	now := time.Now().UTC()
	if _, err := s.db.ExecContext(ctx, `DELETE FROM member_sessions WHERE expires_at <= ?`, now.Format(time.RFC3339)); err != nil {
		return "", err
	}

	_, err = s.db.ExecContext(
		ctx,
		`INSERT INTO member_sessions (token_hash, member_id, created_at, expires_at)
		 VALUES (?, ?, ?, ?)`,
		hashToken(token),
		memberID,
		now.Format(time.RFC3339),
		now.Add(memberSessionTTL).Format(time.RFC3339),
	)
	if err != nil {
		return "", err
	}

	return token, nil
}

func normalizeRegisterRequest(req memberRegisterRequest) (memberRegisterRequest, error) {
	normalized := memberRegisterRequest{
		Name:         strings.TrimSpace(req.Name),
		NameKana:     strings.TrimSpace(req.NameKana),
		Email:        strings.ToLower(strings.TrimSpace(req.Email)),
		Tel:          strings.TrimSpace(req.Tel),
		Password:     strings.TrimSpace(req.Password),
		MailMagazine: req.MailMagazine,
	}

	if normalized.Name == "" {
		return normalized, validationError("氏名を入力してください。")
	}
	if normalized.NameKana == "" {
		return normalized, validationError("氏名（かな）を入力してください。")
	}
	if exceedsRunes(normalized.Name, maxPersonNameRunes) {
		return normalized, validationError("氏名は40文字以内で入力してください。")
	}
	if exceedsRunes(normalized.NameKana, maxPersonKanaRunes) {
		return normalized, validationError("氏名（かな）は60文字以内で入力してください。")
	}
	if hasControlChars(normalized.Name) || hasControlChars(normalized.NameKana) {
		return normalized, validationError("氏名を正しく入力してください。")
	}
	if !validEmailAddress(normalized.Email) {
		return normalized, validationError("メールアドレスを正しく入力してください。")
	}
	if !memberPhonePattern.MatchString(normalized.Tel) {
		return normalized, validationError("電話番号をハイフンなしで入力してください。")
	}
	if len([]rune(normalized.Password)) < 8 {
		return normalized, validationError("パスワードは8文字以上で入力してください。")
	}
	if exceedsRunes(normalized.Password, maxPasswordRunes) {
		return normalized, validationError("パスワードは128文字以内で入力してください。")
	}
	if hasControlChars(normalized.Password) {
		return normalized, validationError("パスワードを正しく入力してください。")
	}

	return normalized, nil
}

func randomToken(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func isUniqueConstraintError(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "unique") || strings.Contains(message, "constraint")
}

func exceedsRunes(value string, max int) bool {
	return len([]rune(value)) > max
}

func hasControlChars(value string) bool {
	for _, char := range value {
		if char < 0x20 || (char >= 0x7f && char <= 0x9f) {
			return true
		}
	}
	return false
}

func validEmailAddress(value string) bool {
	if value == "" || len(value) > maxEmailLength || hasControlChars(value) {
		return false
	}
	parsed, err := mail.ParseAddress(value)
	return err == nil && parsed.Address == value
}

func boolToInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

func reservationHistorySince(period string) string {
	now := time.Now().UTC()
	switch strings.TrimSpace(strings.ToLower(period)) {
	case "30d":
		return now.AddDate(0, 0, -30).Format(time.RFC3339)
	case "90d":
		return now.AddDate(0, 0, -90).Format(time.RFC3339)
	case "1y":
		return now.AddDate(-1, 0, 0).Format(time.RFC3339)
	default:
		return ""
	}
}
