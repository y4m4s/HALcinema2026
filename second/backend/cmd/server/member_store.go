package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
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
	MemberNo     string `json:"memberNo"`
	Name         string `json:"name"`
	NameKana     string `json:"nameKana"`
	Email        string `json:"email"`
	Tel          string `json:"tel"`
	MailMagazine bool   `json:"mailMagazine"`
	Points       int    `json:"points"`
	CreatedAt    string `json:"createdAt"`
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
			member_no TEXT NOT NULL UNIQUE,
			name TEXT NOT NULL,
			name_kana TEXT NOT NULL,
			email TEXT NOT NULL UNIQUE COLLATE NOCASE,
			tel TEXT NOT NULL,
			password_hash TEXT NOT NULL,
			mail_magazine INTEGER NOT NULL DEFAULT 0,
			points INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
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

	return nil
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
	for attempt := 0; attempt < 5; attempt++ {
		memberNo, err := generateMemberNo()
		if err != nil {
			return memberResponse{}, "", err
		}

		result, err := s.db.ExecContext(
			ctx,
			`INSERT INTO members
				(member_no, name, name_kana, email, tel, password_hash, mail_magazine, points, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
			memberNo,
			normalized.Name,
			normalized.NameKana,
			normalized.Email,
			normalized.Tel,
			string(passwordHash),
			boolToInt(normalized.MailMagazine),
			now,
			now,
		)
		if err != nil {
			if isUniqueConstraintError(err) {
				if exists, checkErr := s.emailExists(ctx, normalized.Email); checkErr == nil && exists {
					return memberResponse{}, "", errDuplicateEmail
				}
				continue
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

	return memberResponse{}, "", fmt.Errorf("failed to allocate member number")
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
		`SELECT id, member_no, name, name_kana, email, tel, mail_magazine, points, created_at
		 FROM members
		 WHERE id = ?`,
		id,
	).Scan(
		&member.ID,
		&member.MemberNo,
		&member.Name,
		&member.NameKana,
		&member.Email,
		&member.Tel,
		&mailMagazine,
		&member.Points,
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
		`SELECT id, member_no, name, name_kana, email, tel, password_hash, mail_magazine, points, created_at
		 FROM members
		 WHERE lower(email) = ? OR lower(member_no) = ?`,
		identifier,
		identifier,
	).Scan(
		&member.ID,
		&member.MemberNo,
		&member.Name,
		&member.NameKana,
		&member.Email,
		&member.Tel,
		&member.passwordHash,
		&mailMagazine,
		&member.Points,
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
		`SELECT m.id, m.member_no, m.name, m.name_kana, m.email, m.tel, m.mail_magazine, m.points, m.created_at
		 FROM member_sessions AS s
		 JOIN members AS m ON m.id = s.member_id
		 WHERE s.token_hash = ? AND s.expires_at > ?`,
		hashToken(token),
		now,
	).Scan(
		&member.ID,
		&member.MemberNo,
		&member.Name,
		&member.NameKana,
		&member.Email,
		&member.Tel,
		&mailMagazine,
		&member.Points,
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

func generateMemberNo() (string, error) {
	randomPart, err := randomToken(5)
	if err != nil {
		return "", err
	}

	randomPart = strings.ToUpper(strings.NewReplacer("-", "", "_", "").Replace(randomPart))
	if len(randomPart) > 8 {
		randomPart = randomPart[:8]
	}

	return fmt.Sprintf("HC%s%s", time.Now().UTC().Format("0601"), randomPart), nil
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
		if char < 0x20 || char == 0x7f {
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
