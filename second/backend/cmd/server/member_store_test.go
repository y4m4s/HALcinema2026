package main

import (
	"context"
	"database/sql"
	"errors"
	"path/filepath"
	"strings"
	"testing"
)

func TestMemberStoreRegisterLoginAndSession(t *testing.T) {
	store, err := openMemberStore(filepath.Join(t.TempDir(), "members.sqlite3"))
	if err != nil {
		t.Fatalf("openMemberStore() error = %v", err)
	}
	defer store.Close()

	ctx := context.Background()
	req := memberRegisterRequest{
		Name:         "Test User",
		NameKana:     "test user",
		Email:        "test@example.com",
		Tel:          "09012345678",
		Password:     "password123",
		MailMagazine: true,
	}

	member, token, err := store.Register(ctx, req)
	if err != nil {
		t.Fatalf("Register() error = %v", err)
	}
	if member.ID == 0 || token == "" {
		t.Fatalf("Register() returned incomplete auth data: member=%+v token=%q", member, token)
	}
	if member.Email != req.Email || !member.MailMagazine {
		t.Fatalf("Register() member = %+v", member)
	}

	sessionMember, err := store.MemberByToken(ctx, token)
	if err != nil {
		t.Fatalf("MemberByToken() error = %v", err)
	}
	if sessionMember.ID != member.ID {
		t.Fatalf("MemberByToken() ID = %d, want %d", sessionMember.ID, member.ID)
	}

	loginMember, loginToken, err := store.Login(ctx, memberLoginRequest{
		Identifier: req.Email,
		Password:   req.Password,
	})
	if err != nil {
		t.Fatalf("Login() error = %v", err)
	}
	if loginMember.ID != member.ID || loginToken == "" {
		t.Fatalf("Login() returned member=%+v token=%q", loginMember, loginToken)
	}

	idLoginMember, _, err := store.Login(ctx, memberLoginRequest{
		Identifier: "1",
		Password:   req.Password,
	})
	if err != nil {
		t.Fatalf("Login() by member ID error = %v", err)
	}
	if idLoginMember.ID != member.ID {
		t.Fatalf("Login() by member ID returned member=%+v, want ID %d", idLoginMember, member.ID)
	}

	_, _, err = store.Register(ctx, req)
	if !errors.Is(err, errDuplicateEmail) {
		t.Fatalf("duplicate Register() error = %v, want %v", err, errDuplicateEmail)
	}

	_, _, err = store.Login(ctx, memberLoginRequest{
		Identifier: req.Email,
		Password:   "wrong-password",
	})
	if !errors.Is(err, errInvalidCredentials) {
		t.Fatalf("invalid Login() error = %v, want %v", err, errInvalidCredentials)
	}
}

func TestMemberStoreMigratesLegacyColumns(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "members.sqlite3")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("sql.Open() error = %v", err)
	}
	if _, err := db.Exec(`
		CREATE TABLE members (
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
		);
		CREATE TABLE member_sessions (
			token_hash TEXT PRIMARY KEY,
			member_id INTEGER NOT NULL,
			created_at TEXT NOT NULL,
			expires_at TEXT NOT NULL,
			FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
		);
		INSERT INTO members
			(member_no, name, name_kana, email, tel, password_hash, mail_magazine, points, created_at, updated_at)
		VALUES
			('HC2601TEST', 'Legacy User', 'れがしーゆーざー', 'legacy@example.com', '09012345678', 'hash', 1, 10, '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z');
		INSERT INTO member_sessions (token_hash, member_id, created_at, expires_at)
		VALUES ('legacy-token', 1, '2026-01-01T00:00:00Z', '2099-01-01T00:00:00Z');
	`); err != nil {
		db.Close()
		t.Fatalf("legacy schema setup error = %v", err)
	}
	db.Close()

	store, err := openMemberStore(dbPath)
	if err != nil {
		t.Fatalf("openMemberStore() error = %v", err)
	}
	defer store.Close()

	ctx := context.Background()
	var legacyColumnCount int
	if err := store.db.QueryRowContext(
		ctx,
		`SELECT COUNT(*) FROM pragma_table_info('members') WHERE name IN ('member_no', 'points', 'updated_at')`,
	).Scan(&legacyColumnCount); err != nil {
		t.Fatalf("legacy column query error = %v", err)
	}
	if legacyColumnCount != 0 {
		t.Fatalf("legacy column count = %d, want 0", legacyColumnCount)
	}

	member, _, err := store.Login(ctx, memberLoginRequest{
		Identifier: "1",
		Password:   "password",
	})
	if !errors.Is(err, errInvalidCredentials) {
		t.Fatalf("Login() legacy migrated password error = %v, want %v", err, errInvalidCredentials)
	}
	if member.ID != 0 {
		t.Fatalf("Login() legacy migrated member = %+v, want empty on invalid password", member)
	}

	var sessionCount int
	if err := store.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM member_sessions WHERE member_id = 1`).Scan(&sessionCount); err != nil {
		t.Fatalf("session count query error = %v", err)
	}
	if sessionCount != 1 {
		t.Fatalf("session count = %d, want 1", sessionCount)
	}
}

func TestMemberStoreRejectsInputLimits(t *testing.T) {
	_, err := normalizeRegisterRequest(memberRegisterRequest{
		Name:     strings.Repeat("あ", maxPersonNameRunes+1),
		NameKana: "てすとゆーざー",
		Email:    "test@example.com",
		Tel:      "09012345678",
		Password: "password123",
	})
	if !isValidationError(err) {
		t.Fatalf("oversized name error = %v, want validationError", err)
	}

	_, err = normalizeRegisterRequest(memberRegisterRequest{
		Name:     "Test User",
		NameKana: "てすとゆーざー",
		Email:    "Display Name <test@example.com>",
		Tel:      "09012345678",
		Password: "password123",
	})
	if !isValidationError(err) {
		t.Fatalf("display-name email error = %v, want validationError", err)
	}

	_, err = normalizeRegisterRequest(memberRegisterRequest{
		Name:     "Test User",
		NameKana: "てすとゆーざー",
		Email:    "test@example.com",
		Tel:      "09012345678",
		Password: strings.Repeat("a", maxPasswordRunes+1),
	})
	if !isValidationError(err) {
		t.Fatalf("oversized password error = %v, want validationError", err)
	}
}

func isValidationError(err error) bool {
	var target validationError
	return errors.As(err, &target)
}
