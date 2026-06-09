PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

-- ============================================================
-- HAL Cinema second schema
-- D_IA33_03_データ項目一覧.xlsx を基にした SQLite 用DDL。
-- ============================================================

-- ============================================================
-- DROP (再作成用)
-- ============================================================
DROP TRIGGER IF EXISTS trg_schedules_no_overlap_insert;
DROP TRIGGER IF EXISTS trg_schedules_no_overlap_update;

DROP TABLE IF EXISTS member_sessions;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS reservation_seats;
DROP TABLE IF EXISTS reservation_details;
DROP TABLE IF EXISTS reservations;
DROP TABLE IF EXISTS seats;
DROP TABLE IF EXISTS schedules;
DROP TABLE IF EXISTS movie_people;
DROP TABLE IF EXISTS movies;
DROP TABLE IF EXISTS people;
DROP TABLE IF EXISTS screens;
DROP TABLE IF EXISTS screen_types;
DROP TABLE IF EXISTS coupons;
DROP TABLE IF EXISTS payment_methods;
DROP TABLE IF EXISTS ticket_types;
DROP TABLE IF EXISTS inquiries;
DROP TABLE IF EXISTS news;
DROP TABLE IF EXISTS members;

BEGIN;

-- ============================================================
-- members: 会員
-- xlsx: 会員ID / メールアドレス / パスワードハッシュ / 氏名 / 氏名かな / 電話番号 / メールマガジン希望
-- member_no / points / created_at / updated_at は second/backend の会員機能で使用。
-- ============================================================
CREATE TABLE members (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    member_no      TEXT    NOT NULL UNIQUE,
    email          TEXT    NOT NULL COLLATE NOCASE UNIQUE,
    password_hash  TEXT    NOT NULL,
    name           TEXT    NOT NULL,
    name_kana      TEXT    NOT NULL,
    tel            TEXT    NOT NULL,
    mail_magazine  INTEGER NOT NULL DEFAULT 0 CHECK (mail_magazine IN (0, 1)),
    points         INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE member_sessions (
    token_hash  TEXT PRIMARY KEY,
    member_id   INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    created_at  TEXT    NOT NULL,
    expires_at  TEXT    NOT NULL
);

-- ============================================================
-- coupons: クーポン
-- xlsx: クーポンID / クーポンコード / 割引額
-- ============================================================
CREATE TABLE coupons (
    id               TEXT    PRIMARY KEY,
    code             TEXT    NOT NULL UNIQUE,
    discount_amount  INTEGER NOT NULL CHECK (discount_amount >= 0),
    is_active        INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- payment_methods: 支払い方法
-- xlsx: 支払い方法ID / 支払い方法名
-- ============================================================
CREATE TABLE payment_methods (
    id             TEXT    PRIMARY KEY,
    code           TEXT    NOT NULL UNIQUE,
    name           TEXT    NOT NULL UNIQUE,
    display_order  INTEGER NOT NULL DEFAULT 999,
    is_active      INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- screen_types: スクリーン種別
-- xlsx: スクリーン種別ID / スクリーン種別名 / 座席数
-- ============================================================
CREATE TABLE screen_types (
    id         TEXT    PRIMARY KEY,
    name       TEXT    NOT NULL UNIQUE,
    capacity   INTEGER NOT NULL CHECK (capacity > 0),
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- screens: スクリーン
-- xlsx: スクリーンID / スクリーン種別ID / スクリーン名
-- ============================================================
CREATE TABLE screens (
    id              TEXT    PRIMARY KEY,
    screen_type_id  TEXT    NOT NULL REFERENCES screen_types(id) ON DELETE RESTRICT,
    name            TEXT    NOT NULL UNIQUE,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- seats: 座席情報
-- xlsx: 座席ID / スクリーンID / 座席コード
-- ============================================================
CREATE TABLE seats (
    id          INTEGER PRIMARY KEY,
    screen_id   TEXT    NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
    seat_code   TEXT    NOT NULL,
    is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (screen_id, seat_code)
);

-- ============================================================
-- people: 人物
-- xlsx: 人物ID / 人物名
-- ============================================================
CREATE TABLE people (
    id         INTEGER PRIMARY KEY,
    name       TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- movies: 作品
-- xlsx: 作品ID / 監督 / 出演者 / タイトル / タイトルかな / 英語タイトル /
--       レーティング / 上映時間 / ポスター画像URL / キャッチコピー / あらすじ / 作成日時 / 更新日時
-- データ項目一覧の ジャンル / 言語 も作品属性として保持。
-- ============================================================
CREATE TABLE movies (
    id                    TEXT    PRIMARY KEY,
    director_person_id    INTEGER REFERENCES people(id) ON DELETE SET NULL,
    main_actor_person_id  INTEGER REFERENCES people(id) ON DELETE SET NULL,
    title                 TEXT    NOT NULL,
    title_kana            TEXT,
    title_en              TEXT,
    rating                TEXT,
    duration_min          INTEGER NOT NULL CHECK (duration_min > 0),
    poster_url            TEXT,
    tagline               TEXT,
    synopsis              TEXT,
    genre                 TEXT,
    language              TEXT,
    created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- movie_people: 作品関係者
-- xlsx: 作品ID / 人物ID / 役割 / 表示順
-- ============================================================
CREATE TABLE movie_people (
    movie_id       TEXT    NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    person_id      INTEGER NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
    role           TEXT    NOT NULL,
    display_order  INTEGER NOT NULL DEFAULT 999 CHECK (display_order > 0),
    PRIMARY KEY (movie_id, person_id, role)
);

-- ============================================================
-- schedules: スケジュール
-- xlsx: スケジュールID / 作品ID / スクリーンID / 上映開始日時 / 上映終了日時
-- ============================================================
CREATE TABLE schedules (
    id          TEXT PRIMARY KEY,
    movie_id    TEXT NOT NULL REFERENCES movies(id) ON DELETE RESTRICT,
    screen_id   TEXT NOT NULL REFERENCES screens(id) ON DELETE RESTRICT,
    start_at    TEXT NOT NULL,
    end_at      TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (end_at > start_at),
    UNIQUE (screen_id, start_at)
);

CREATE TRIGGER trg_schedules_no_overlap_insert
BEFORE INSERT ON schedules
FOR EACH ROW
WHEN EXISTS (
    SELECT 1
      FROM schedules
     WHERE screen_id = NEW.screen_id
       AND start_at < NEW.end_at
       AND end_at > NEW.start_at
)
BEGIN
    SELECT RAISE(ABORT, 'schedule overlaps another showtime on the same screen');
END;

CREATE TRIGGER trg_schedules_no_overlap_update
BEFORE UPDATE OF screen_id, start_at, end_at ON schedules
FOR EACH ROW
WHEN EXISTS (
    SELECT 1
      FROM schedules
     WHERE id <> NEW.id
       AND screen_id = NEW.screen_id
       AND start_at < NEW.end_at
       AND end_at > NEW.start_at
)
BEGIN
    SELECT RAISE(ABORT, 'schedule overlaps another showtime on the same screen');
END;

-- ============================================================
-- ticket_types: 券種
-- xlsx: チケット種別ID / チケット種別名 / 料金 / 必要座席数
-- ============================================================
CREATE TABLE ticket_types (
    id                   INTEGER PRIMARY KEY,
    code                 TEXT    NOT NULL UNIQUE,
    name                 TEXT    NOT NULL UNIQUE,
    price                INTEGER NOT NULL CHECK (price >= 0),
    required_seat_count  INTEGER NOT NULL DEFAULT 1 CHECK (required_seat_count > 0),
    display_order        INTEGER NOT NULL DEFAULT 999,
    is_active            INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- reservations: 予約
-- xlsx: 予約ID / スケジュールID / 会員ID / クーポンID / 予約ステータス / 予約日時
-- ============================================================
CREATE TABLE reservations (
    id                  TEXT    PRIMARY KEY,
    schedule_id         TEXT    NOT NULL REFERENCES schedules(id) ON DELETE RESTRICT,
    member_id           INTEGER REFERENCES members(id) ON DELETE RESTRICT,
    coupon_id           TEXT    REFERENCES coupons(id) ON DELETE SET NULL,
    customer_name       TEXT    NOT NULL,
    customer_name_kana  TEXT,
    customer_email      TEXT    NOT NULL,
    customer_tel        TEXT    NOT NULL,
    status              TEXT    NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'confirmed', 'cancelled', 'used', 'expired')),
    reserved_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- reservation_details: 予約明細
-- xlsx: 予約明細ID / 予約ID / チケット種別ID / 料金
-- ============================================================
CREATE TABLE reservation_details (
    id              TEXT    PRIMARY KEY,
    reservation_id  TEXT    NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    ticket_type_id  INTEGER NOT NULL REFERENCES ticket_types(id) ON DELETE RESTRICT,
    price           INTEGER NOT NULL CHECK (price >= 0),
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- reservation_seats: 予約座席
-- xlsx: 予約明細ID / 座席ID
-- ============================================================
CREATE TABLE reservation_seats (
    reservation_detail_id  TEXT    NOT NULL REFERENCES reservation_details(id) ON DELETE CASCADE,
    schedule_id             TEXT    NOT NULL REFERENCES schedules(id) ON DELETE RESTRICT,
    seat_id                INTEGER NOT NULL REFERENCES seats(id) ON DELETE RESTRICT,
    created_at             TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (reservation_detail_id, seat_id),
    UNIQUE (schedule_id, seat_id)
);

-- ============================================================
-- payments: 支払い
-- xlsx: 支払いID / 予約ID / 支払い方法ID / 支払金額 / 支払いステータス / 支払い日時
-- ============================================================
CREATE TABLE payments (
    id                 TEXT    PRIMARY KEY,
    reservation_id     TEXT    NOT NULL REFERENCES reservations(id) ON DELETE RESTRICT,
    payment_method_id  TEXT    NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT,
    amount             INTEGER NOT NULL CHECK (amount >= 0),
    status             TEXT    NOT NULL DEFAULT 'unpaid'
                            CHECK (status IN ('unpaid', 'paid', 'failed', 'refunded', 'cancelled')),
    paid_at            TEXT,
    created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- inquiries: 問い合わせ
-- xlsx: お問い合わせID / 氏名 / メールアドレス / カテゴリ / メッセージ /
--       受付日時 / ステータス / 対応内容 / 対応日時 / 対応者
-- ============================================================
CREATE TABLE inquiries (
    id             TEXT    PRIMARY KEY,
    name           TEXT    NOT NULL,
    email          TEXT    NOT NULL,
    category       TEXT    NOT NULL,
    message        TEXT    NOT NULL,
    received_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    status         TEXT    NOT NULL DEFAULT 'new'
                          CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
    response_body  TEXT,
    responded_at   TEXT,
    respondent     TEXT,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- news: お知らせ
-- xlsx: お知らせID / タイトル / 本文 / タグ / 公開日時
-- ============================================================
CREATE TABLE news (
    id            TEXT    PRIMARY KEY,
    title         TEXT    NOT NULL,
    body          TEXT    NOT NULL,
    tag           TEXT,
    published_at  TEXT    NOT NULL,
    is_published  INTEGER NOT NULL DEFAULT 1 CHECK (is_published IN (0, 1)),
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_member_sessions_member_id ON member_sessions(member_id);
CREATE INDEX idx_member_sessions_expires_at ON member_sessions(expires_at);

CREATE INDEX idx_screens_screen_type_id ON screens(screen_type_id);
CREATE INDEX idx_seats_screen_id ON seats(screen_id);
CREATE INDEX idx_movies_title ON movies(title);
CREATE INDEX idx_movie_people_person_id ON movie_people(person_id);
CREATE INDEX idx_schedules_movie_start_at ON schedules(movie_id, start_at);
CREATE INDEX idx_schedules_screen_start_at ON schedules(screen_id, start_at);

CREATE INDEX idx_reservations_member_reserved_at ON reservations(member_id, reserved_at);
CREATE INDEX idx_reservations_schedule_id ON reservations(schedule_id);
CREATE INDEX idx_reservation_details_reservation_id ON reservation_details(reservation_id);
CREATE INDEX idx_reservation_seats_schedule_id ON reservation_seats(schedule_id);
CREATE INDEX idx_reservation_seats_seat_id ON reservation_seats(seat_id);
CREATE INDEX idx_payments_reservation_id ON payments(reservation_id);
CREATE INDEX idx_inquiries_status_received_at ON inquiries(status, received_at);
CREATE INDEX idx_news_published_at ON news(published_at);

COMMIT;
