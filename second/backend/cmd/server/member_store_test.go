package main

import (
	"context"
	"errors"
	"path/filepath"
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
		Tel:          "090-1234-5678",
		Password:     "password123",
		MailMagazine: true,
	}

	member, token, err := store.Register(ctx, req)
	if err != nil {
		t.Fatalf("Register() error = %v", err)
	}
	if member.ID == 0 || member.MemberNo == "" || token == "" {
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
