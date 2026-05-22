PRAGMA foreign_keys = ON;

-- ============================================================
-- DROP (再作成用)
-- ============================================================
DROP TABLE IF EXISTS reservations;
DROP TABLE IF EXISTS seats;
DROP TABLE IF EXISTS schedule_prices;
DROP TABLE IF EXISTS price_rules;
DROP TABLE IF EXISTS special_price_days; -- 旧スキーマ互換の掃除用
DROP TABLE IF EXISTS ticket_types;
DROP TABLE IF EXISTS schedules;
DROP TABLE IF EXISTS movie_actors;
DROP TABLE IF EXISTS actors;
DROP TABLE IF EXISTS screens;
DROP TABLE IF EXISTS news;
DROP TABLE IF EXISTS movies;
DROP TABLE IF EXISTS users;

-- ============================================================
-- movies: 作品情報
-- ============================================================
CREATE TABLE movies (
    id               INTEGER PRIMARY KEY,
    tmdb_id          INTEGER UNIQUE,        -- TMDB 連携時の作品 ID
    title            TEXT    NOT NULL,
    title_en         TEXT,                  -- 画面の英字/副題表示用 (TMDB original_title 等)
    title_kana       TEXT,
    synopsis         TEXT,
    director         TEXT,
    duration_min     INTEGER CHECK (duration_min > 0),
    rating           TEXT,                  -- 'G' / 'PG12' / 'R15+' / 'R18+'
    genre            TEXT,                  -- カンマ区切り例: 'ホラー,スリラー'
    poster_url       TEXT,
    trailer_url      TEXT,
    release_date     TEXT,                  -- 元の劇場公開日 'YYYY-MM-DD'
    screening_start  TEXT,                  -- HALcinema 上映開始日 'YYYY-MM-DD'
    screening_end    TEXT,                  -- HALcinema 上映終了日 'YYYY-MM-DD'
    screening_status TEXT    NOT NULL DEFAULT 'coming'
                              CHECK (screening_status IN ('now','coming','ended')),
    note             TEXT,                  -- 年齢制限等の注意書き
    is_feature       INTEGER NOT NULL DEFAULT 0,   -- 1:特集上映 / 0:通常
    is_published     INTEGER NOT NULL DEFAULT 1    -- 1:公開 / 0:非公開
);

-- ============================================================
-- actors: 出演者情報
-- ============================================================
CREATE TABLE actors (
    id         INTEGER PRIMARY KEY,
    name       TEXT    NOT NULL,
    name_kana  TEXT,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- movie_actors: 作品と出演者の中間テーブル
-- ============================================================
CREATE TABLE movie_actors (
    movie_id      INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    actor_id      INTEGER NOT NULL REFERENCES actors(id) ON DELETE RESTRICT,
    role_name     TEXT,
    billing_order INTEGER NOT NULL DEFAULT 999,  -- 表示順 (小さいほど上位)
    PRIMARY KEY (movie_id, actor_id)
);

-- ============================================================
-- screens: シアター情報
-- ============================================================
CREATE TABLE screens (
    id          INTEGER PRIMARY KEY,
    name        TEXT    NOT NULL UNIQUE,    -- 'スクリーン1' 等
    screen_type TEXT    NOT NULL DEFAULT '大スクリーン',  -- '大スクリーン' / '中スクリーン' / '小スクリーン'
    capacity    INTEGER NOT NULL CHECK (capacity > 0),
    equipment   TEXT,                       -- カンマ区切り例: 'Dolby Atmos,4K レーザープロジェクター'
    description TEXT
);

-- ============================================================
-- schedules: 上映スケジュール
-- ============================================================
CREATE TABLE schedules (
    id                  INTEGER PRIMARY KEY,
    movie_id            INTEGER NOT NULL REFERENCES movies(id),
    screen_id           INTEGER NOT NULL REFERENCES screens(id),
    start_at            TEXT    NOT NULL,          -- 'YYYY-MM-DD HH:MM'
    end_at              TEXT    NOT NULL,          -- start_at + duration_min で算出
    format              TEXT    NOT NULL DEFAULT 'standard',  -- 'standard' / '3D' / 'IMAX'
    surcharge           INTEGER NOT NULL DEFAULT 0 CHECK (surcharge >= 0),
    availability_status TEXT    NOT NULL DEFAULT 'ok'
                                     CHECK (availability_status IN ('ok','few','soldout')),
    is_published        INTEGER NOT NULL DEFAULT 1,
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
-- ticket_types: 料金区分
-- ============================================================
CREATE TABLE ticket_types (
    id            INTEGER PRIMARY KEY,
    code          TEXT    NOT NULL UNIQUE,  -- 'adult' / 'student' / 'child' / 'senior' 等
    name          TEXT    NOT NULL,         -- '一般' / '学生' / '幼児' / 'シニア' 等
    base_price    INTEGER NOT NULL CHECK (base_price >= 0),
    note          TEXT,                     -- '学生証提示' / '身分証提示' 等
    display_order INTEGER NOT NULL DEFAULT 999,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- schedule_prices: 上映回別の価格上書き
-- 通常料金は ticket_types.base_price を使い、特別興行等だけここで上書きする。
-- ============================================================
CREATE TABLE schedule_prices (
    id             INTEGER PRIMARY KEY,
    schedule_id    INTEGER NOT NULL REFERENCES schedules(id)     ON DELETE CASCADE,
    ticket_type_id INTEGER NOT NULL REFERENCES ticket_types(id)  ON DELETE RESTRICT,
    price          INTEGER NOT NULL CHECK (price >= 0),
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (schedule_id, ticket_type_id)
);

-- ============================================================
-- price_rules: 割引デー・特典
-- condition_kind/value は適用条件を表す。予約時の金額は reservations.price_at_booking に保存する。
-- ============================================================
CREATE TABLE price_rules (
    id              INTEGER PRIMARY KEY,
    code            TEXT    NOT NULL UNIQUE,
    name            TEXT    NOT NULL,
    rule_kind       TEXT    NOT NULL CHECK (rule_kind IN ('fixed_price','discount')),
    amount          INTEGER NOT NULL CHECK (amount >= 0),
    condition_kind  TEXT    NOT NULL
                            CHECK (condition_kind IN ('monthly_day','last_show','group_size_min')),
    condition_value TEXT,           -- monthly_day='13' / group_size_min='4' / last_show=NULL
    note            TEXT,
    display_order   INTEGER NOT NULL DEFAULT 999,
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- news: お知らせ
-- ============================================================
CREATE TABLE news (
    id           INTEGER PRIMARY KEY,
    title        TEXT    NOT NULL,
    body         TEXT    NOT NULL,
    category     TEXT,                      -- 'お知らせ' / 'イベント' / 'キャンペーン' 等
    published_at TEXT    NOT NULL,
    is_published INTEGER NOT NULL DEFAULT 1
);

-- ============================================================
-- users: 会員情報 (二次開発用)
-- ============================================================
CREATE TABLE users (
    id                  INTEGER PRIMARY KEY,
    email               TEXT    NOT NULL UNIQUE,
    password_hash       TEXT    NOT NULL,
    name                TEXT    NOT NULL,
    name_kana           TEXT,
    phone               TEXT,
    birth_date          TEXT,
    email_verified_at   TEXT,
    is_active           INTEGER NOT NULL DEFAULT 1,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- seats: 座席情報 (二次開発用)
-- ============================================================
CREATE TABLE seats (
    id          INTEGER PRIMARY KEY,
    screen_id   INTEGER NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
    row_label   TEXT    NOT NULL,            -- 'A' / 'B' 等
    col_number  INTEGER NOT NULL,
    seat_type   TEXT    NOT NULL DEFAULT 'standard',  -- 'standard' / 'wheelchair' 等
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (screen_id, row_label, col_number)
);

-- ============================================================
-- reservations: 予約 (二次開発用)
-- ============================================================
CREATE TABLE reservations (
    id                INTEGER PRIMARY KEY,
    schedule_id       INTEGER NOT NULL REFERENCES schedules(id)     ON DELETE RESTRICT,
    seat_id           INTEGER NOT NULL REFERENCES seats(id)         ON DELETE RESTRICT,
    user_id           INTEGER NOT NULL REFERENCES users(id)         ON DELETE RESTRICT,
    ticket_type_id    INTEGER NOT NULL REFERENCES ticket_types(id)  ON DELETE RESTRICT,
    price_at_booking  INTEGER NOT NULL CHECK (price_at_booking >= 0),
    status            TEXT    NOT NULL DEFAULT 'confirmed'
                              CHECK (status IN ('pending','confirmed','cancelled','used')),
    reservation_code  TEXT    NOT NULL UNIQUE,
    reserved_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    cancelled_at      TEXT,
    created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- cancelled の席は再販売できるよう、アクティブな予約だけ重複を禁止する。
CREATE UNIQUE INDEX idx_reservations_active_seat
    ON reservations (schedule_id, seat_id)
    WHERE status IN ('pending','confirmed','used');

CREATE INDEX idx_schedules_start_at ON schedules (start_at);
CREATE INDEX idx_schedules_movie_start_at ON schedules (movie_id, start_at);


-- ============================================================
-- サンプルデータ
-- ============================================================

-- ------------------------------------------------------------
-- screens
-- ------------------------------------------------------------
INSERT INTO screens (id, name, screen_type, capacity, equipment, description) VALUES
(1, 'スクリーン1', '大スクリーン', 200, 'Dolby Atmos,4K レーザープロジェクター,バリアフリー対応,車椅子スペース 4席', '大スクリーン・車椅子スペース完備'),
(2, 'スクリーン2', '大スクリーン', 200, 'Dolby Atmos,4K レーザープロジェクター,バリアフリー対応',                   '大スクリーン'),
(3, 'スクリーン3', '大スクリーン', 200, 'IMAX互換スクリーン,Dolby Atmos,4K レーザープロジェクター',                '大スクリーン・IMAX互換'),
(4, 'スクリーン4', '中スクリーン', 120, 'Dolby Digital,4K プロジェクター,バリアフリー対応',                        '中スクリーン'),
(5, 'スクリーン5', '中スクリーン', 120, 'Dolby Digital,4K プロジェクター',                                         '中スクリーン'),
(6, 'スクリーン6', '小スクリーン',  70, '7.1ch サラウンド,2K プロジェクター',                                      '小スクリーン'),
(7, 'スクリーン7', '小スクリーン',  70, 'Dolby Atmos,4K レーザープロジェクター',                                   '小スクリーン・2025年リニューアル'),
(8, 'スクリーン8', '小スクリーン',  70, 'Dolby Atmos,4K レーザープロジェクター,バリアフリー対応',                  '小スクリーン・2025年リニューアル・バリアフリー');

-- ------------------------------------------------------------
-- movies
-- release_date: 元の劇場公開日 / screening_start: HALcinema 上映開始日
-- 曜日タブ等は schedules の実日付から生成する。
-- ------------------------------------------------------------
INSERT INTO movies (id, tmdb_id, title, title_en, title_kana, synopsis, director, duration_min, rating, genre,
                    poster_url, release_date, screening_start, screening_end, screening_status,
                    note, is_feature, is_published) VALUES
(1,  68341, '冷たい熱帯魚',     '冷たい熱帯魚', 'つめたいねったいぎょ',
     '死別した前妻の娘と現在の妻。折り合いの悪い二人に挟まれながら小さな熱帯魚店を営む社本信行。娘の万引き事件をきっかけに、大型熱帯魚店を経営する村田と関わり始め、引き返せない顛末へと引き込まれていく。',
     '園子温', 146, 'R18+', 'ドラマ,スリラー,犯罪,ホラー',
     'https://image.tmdb.org/t/p/w500/8jzXKuuSMNYU0jSakJkdkzQcZbL.jpg',
     '2011-01-29', '2026-05-01', '2026-07-31', 'now',
     'R18+ 指定作品。18歳未満は入場不可です。', 1, 1),

(2,  57238, '黒い家',           '黒い家', 'くろいいえ',
     '保険会社の社員・若槻慎二は訪問先の家で首吊り死体を発見する。自殺として処理された事件に疑問を抱いた若槻が独自に調査を始めると、夫婦の保険金をめぐる異常な行動が次第に明らかになっていく。',
     '森田芳光', 118, 'R15+', 'ホラー,謎',
     'https://image.tmdb.org/t/p/w500/s6JLXxlWUH2OVWKTw8XqfXPu4Cw.jpg',
     '1999-11-13', '2026-05-01', '2026-06-30', 'now',
     'R15+ 指定作品。15歳未満のご入場はできません。', 0, 1),

(3,  12205, '仄暗い水の底から', '仄暗い水の底から', 'ほのぐらいみずのそこから',
     '離婚調停中の淑美は娘・郁子と新しいマンションに引っ越す。雨漏りや異音が続く中、2年前に行方不明になった少女の霊が郁子に近づいていることを感じ始め、恐慌に陥っていく。',
     '中田秀夫', 101, 'PG12', 'ホラー,謎,スリラー',
     'https://image.tmdb.org/t/p/w500/7JpBzb3Eb2fryzzSd9q64GwcDfe.jpg',
     '2002-01-19', '2026-05-01', '2026-06-15', 'now',
     'PG12 指定作品。小学生以下は保護者の助言・指導が必要です。', 0, 1),

(4,  1188456, '変な家',        '変な家', 'へんないえ',
     'オカルト系ユーチューバーの雨宮が不可解な間取り図の謎を解き明かそうとするうちに、その家にまつわる恐ろしい真実に近づいていく。',
     '石川淳一', 110, 'PG12', 'スリラー,謎',
     'https://image.tmdb.org/t/p/w500/ArUTdQ84QNni5Uz0Mk54qc8wyJ.jpg',
     '2024-03-15', '2026-07-01', '2026-08-31', 'coming',
     'PG12 指定作品。小学生以下は保護者の助言・指導が必要です。', 0, 1),

(5,  959439, 'きさらぎ駅',     'きさらぎ駅', 'きさらぎえき',
     '2004年、女性がSNSにリアルタイム実況しながら見知らぬ無人駅「きさらぎ駅」に迷い込み、消息不明になった実話をベースにしたホラー。',
     '永江二朗', 82, 'R15+', 'ホラー',
     'https://image.tmdb.org/t/p/w500/fkH85I3onRvT2E2Fod4G3mjim4h.jpg',
     '2022-06-03', '2026-07-01', '2026-08-15', 'coming',
     'R15+ 指定作品。15歳未満のご入場はできません。', 0, 1),

(6,  54186, '告白',            '告白', 'こくはく',
     '娘を殺された中学教師の森口悠子が終業式のホームルームで衝撃的な告白をする。そこから始まる連鎖する告白と復讐の物語。',
     '中島哲也', 107, 'R15+', 'ドラマ,スリラー,謎',
     'https://image.tmdb.org/t/p/w500/p8vr7jVwflsSqAq91nWcOPZ2RIv.jpg',
     '2010-06-05', '2026-05-01', '2026-06-30', 'now',
     'R15+ 指定作品。15歳未満のご入場はできません。', 0, 1),

(7,  1464533, '爆弾',          '爆弾', 'ばくだん',
     '酔っ払いとして連行された謎の中年男・スズキタゴサクが都内の爆弾を予告。刑事たちの問いかけをのらりくらりとかわしながら謎のクイズを出し始める。彼の正体と爆弾の真相とは。',
     '永井聡', 136, 'PG12', 'スリラー,謎,犯罪',
     'https://image.tmdb.org/t/p/w500/7d4Gb3R1W6OByg46V5TSCNbbpUW.jpg',
     '2025-10-31', '2026-05-01', '2026-06-30', 'now',
     'PG12 指定作品。小学生以下は保護者の助言・指導が必要です。', 0, 1),

(8,  890526, '死刑にいたる病', '死刑にいたる病', 'しけいにいたるやまい',
     '大学生・雅也のもとに稀代の連続殺人鬼・榛村から「最後の事件だけは冤罪だ」という手紙が届く。独自調査を始めた雅也が直面する、想像を超えた残酷な真相。',
     '白石和彌', 128, 'G', '謎,ドラマ,犯罪',
     'https://image.tmdb.org/t/p/w500/oMAnlf97UOyfQrFOGUE4bqPbmLo.jpg',
     '2022-05-06', '2026-05-01', '2026-07-15', 'now',
     NULL, 0, 1),

(9,  392681, 'ミュージアム',   'ミュージアム', 'みゅーじあむ',
     '雨の日だけに起こる猟奇殺人事件を追う刑事・沢村久志。カエルのマスクを被った犯人「カエル男」との息詰まる追跡劇。',
     '大友啓史', 132, 'G', 'ドラマ,スリラー',
     'https://image.tmdb.org/t/p/w500/oHy3ntbb4PmK7iDouwftaLSabVy.jpg',
     '2016-11-12', '2026-05-01', '2026-06-30', 'now',
     NULL, 0, 1),

(10, 1404791, 'ドールハウス', 'ドールハウス', 'どーるはうす',
     '5歳の娘を亡くした夫婦が骨董市で娘に似た人形を迎えたことをきっかけに不可解な出来事が続発する。捨てても戻ってくる人形の秘密に迫るホラー。',
     '矢口史靖', 110, 'G', 'ホラー,謎',
     'https://image.tmdb.org/t/p/w500/gBCT1BbU5i0p9yj4M12Vvd2rVM2.jpg',
     '2025-06-13', '2026-07-01', '2026-08-31', 'coming',
     NULL, 0, 1);

-- ------------------------------------------------------------
-- actors
-- ------------------------------------------------------------
INSERT INTO actors (id, name, name_kana) VALUES
( 1, '吹越満',     'ふきこしみつる'),
( 2, 'でんでん',   'でんでん'),
( 3, '黒沢あすか', 'くろさわあすか'),
( 4, '神楽坂恵',   'かぐらざかめぐみ'),
( 5, '内野聖陽',   'うちのせいよう'),
( 6, '大竹しのぶ', 'おおたけしのぶ'),
( 7, '西村雅彦',   'にしむらまさひこ'),
( 8, '黒木瞳',     'くろきひとみ'),
( 9, '菅野莉央',   'かんのりお'),
(10, '松たか子',   'まつたかこ'),
(11, '岡田将生',   'おかだまさき'),
(12, '木村佳乃',   'きむらよしの'),
(13, '山田裕貴',   'やまだゆうき'),
(14, '伊藤沙莉',   'いとうさいり'),
(15, '染谷将太',   'そめたにしょうた'),
(16, '間宮祥太朗', 'まみやしょうたろう'),
(17, '佐藤二朗',   'さとうじろう'),
(18, '恒松祐里',   'つねまつゆり'),
(19, '阿部サダヲ', 'あべさだを'),
(20, '水上恒司',   'みずかみこうじ'),
(21, '小栗旬',     'おぐりしゅん'),
(22, '尾野真千子', 'おのまちこ'),
(23, '長澤まさみ', 'ながさわまさみ'),
(24, '瀬戸康史',   'せとこうじ');

-- ------------------------------------------------------------
-- movie_actors
-- ------------------------------------------------------------
INSERT INTO movie_actors (movie_id, actor_id, role_name, billing_order) VALUES
-- 冷たい熱帯魚
(1,  1, '社本信行',       1),
(1,  2, '村田照夫',       2),
(1,  3, '村田愛子',       3),
(1,  4, '社本妙子',       4),
-- 黒い家
(2,  5, '若槻慎二',       1),
(2,  6, '菰田幸子',       2),
(2,  7, '三善康夫',       3),
-- 仄暗い水の底から
(3,  8, '淑美',           1),
(3,  9, '郁子',           2),
-- 告白
(6, 10, '森口悠子',       1),
(6, 11, '修哉',           2),
(6, 12, '直樹の母',       3),
-- 爆弾
(7, 13, '島田',           1),
(7, 14, '東島',           2),
(7, 15, 'スズキタゴサク', 3),
-- 変な家
(4, 16, '雨宮',           1),
(4, 17, '栗原',           2),
-- きさらぎ駅
(5, 18, 'はすみ',         1),
-- 死刑にいたる病
(8, 19, '榛村大和',       1),
(8, 20, '筧雅也',         2),
-- ミュージアム
(9, 21, '沢村久志',       1),
(9, 22, '沢村の妻',       2),
-- ドールハウス
(10,23, '佳恵',           1),
(10,24, '忠彦',           2);

-- ------------------------------------------------------------
-- ticket_types
-- ------------------------------------------------------------
INSERT INTO ticket_types (id, code, name, base_price, note, display_order) VALUES
(1, 'adult',    '一般',               1800, NULL,                        1),
(2, 'college',  '大学生・専門学生',   1600, '学生証提示',                2),
(3, 'student',  '中学・高校生',       1400, '学生証提示',                3),
(4, 'child',    '小学生・幼児',       1000, NULL,                        4),
(5, 'senior',   'シニア（60歳以上）', 1200, '身分証提示',                5),
(6, 'disabled', '障がい者',           1000, '手帳提示、同伴者1名も同額', 6);

-- ------------------------------------------------------------
-- price_rules
-- ------------------------------------------------------------
INSERT INTO price_rules (id, code, name, rule_kind, amount, condition_kind, condition_value, note, display_order, is_active) VALUES
(1, 'cursed_service_day', '呪いのサービスデー', 'fixed_price', 1300, 'monthly_day',    '13', '全席・全年齢均一。特別興行や一部イベント上映は対象外。', 1, 1),
(2, 'late_show',          'レイトショー割引',     'discount',     100, 'last_show',       NULL, '最終回上映のみ対象。',                                  2, 1),
(3, 'group_discount',     'グループ割引',         'discount',     200, 'group_size_min', '4',  '4名以上のグループ来場で1名ごとに適用。',              3, 1);

-- ------------------------------------------------------------
-- schedules (今週分サンプル: 2026-05-22 基準)
-- ※ 上映中の映画のみ / end_at = start_at + duration_min
-- ※ 変な家 / きさらぎ駅 / ドールハウス は coming のためスケジュールなし
-- ------------------------------------------------------------
INSERT INTO schedules (id, movie_id, screen_id, start_at, end_at, availability_status, is_published) VALUES
-- 冷たい熱帯魚 (146min) / スクリーン1
( 1, 1, 1, '2026-05-23 10:00', '2026-05-23 12:26', 'soldout', 1),
( 2, 1, 1, '2026-05-23 17:00', '2026-05-23 19:26', 'ok',      1),
-- 冷たい熱帯魚 / スクリーン3
( 3, 1, 3, '2026-05-23 13:30', '2026-05-23 15:56', 'few',     1),
( 4, 1, 3, '2026-05-23 20:30', '2026-05-23 22:56', 'ok',      1),
-- 黒い家 (118min) / スクリーン2
( 5, 2, 2, '2026-05-22 11:20', '2026-05-22 13:18', 'soldout', 1),
( 6, 2, 2, '2026-05-22 18:30', '2026-05-22 20:28', 'ok',      1),
-- 黒い家 / スクリーン5
( 7, 2, 5, '2026-05-22 14:50', '2026-05-22 16:48', 'few',     1),
-- 仄暗い水の底から (101min) / スクリーン4
( 8, 3, 4, '2026-05-22 12:00', '2026-05-22 13:41', 'ok',      1),
( 9, 3, 4, '2026-05-22 20:00', '2026-05-22 21:41', 'ok',      1),
-- 仄暗い水の底から / スクリーン6
(10, 3, 6, '2026-05-23 16:20', '2026-05-23 18:01', 'soldout', 1),
-- 告白 (107min) / スクリーン2
(11, 6, 2, '2026-05-23 10:30', '2026-05-23 12:17', 'soldout', 1),
(12, 6, 2, '2026-05-23 13:00', '2026-05-23 14:47', 'few',     1),
(13, 6, 2, '2026-05-23 19:00', '2026-05-23 20:47', 'ok',      1),
-- 告白 / スクリーン7 (data.js に合わせ 3 スロット)
(14, 6, 7, '2026-05-23 11:00', '2026-05-23 12:47', 'ok',      1),
(15, 6, 7, '2026-05-23 14:00', '2026-05-23 15:47', 'soldout', 1),
(16, 6, 7, '2026-05-23 20:00', '2026-05-23 21:47', 'ok',      1),
-- 爆弾 (136min) / スクリーン3 (data.js に合わせ 4 スロット)
(17, 7, 3, '2026-05-22 09:50', '2026-05-22 12:06', 'ok',      1),
(18, 7, 3, '2026-05-22 12:30', '2026-05-22 14:46', 'soldout', 1),
(19, 7, 3, '2026-05-22 16:00', '2026-05-22 18:16', 'few',     1),
(20, 7, 3, '2026-05-22 20:30', '2026-05-22 22:46', 'ok',      1),
-- 爆弾 / スクリーン8 (data.js に合わせ 4 スロット)
(21, 7, 8, '2026-05-22 10:20', '2026-05-22 12:36', 'few',     1),
(22, 7, 8, '2026-05-22 13:00', '2026-05-22 15:16', 'ok',      1),
(23, 7, 8, '2026-05-22 17:30', '2026-05-22 19:46', 'soldout', 1),
(24, 7, 8, '2026-05-22 21:00', '2026-05-22 23:16', 'ok',      1),
-- 死刑にいたる病 (128min) / スクリーン1
(25, 8, 1, '2026-05-22 09:40', '2026-05-22 11:48', 'ok',      1),
(26, 8, 1, '2026-05-22 21:10', '2026-05-22 23:18', 'few',     1),
-- 死刑にいたる病 / スクリーン4
(27, 8, 4, '2026-05-22 15:20', '2026-05-22 17:28', 'ok',      1),
-- ミュージアム (132min) / スクリーン5
(28, 9, 5, '2026-05-22 10:50', '2026-05-22 13:02', 'few',     1),
(29, 9, 5, '2026-05-22 20:20', '2026-05-22 22:32', 'ok',      1),
-- ミュージアム / スクリーン6
(30, 9, 6, '2026-05-22 16:40', '2026-05-22 18:52', 'soldout', 1);

-- schedule_prices は特別興行等で ticket_types.base_price を上書きするときに追加する。

-- ------------------------------------------------------------
-- news
-- ------------------------------------------------------------
INSERT INTO news (id, title, body, category, published_at, is_published) VALUES
(1, 'GWスペシャル「ドールハウス」舞台挨拶 — 5月3日(土)開催決定',
    'GWスペシャル企画として、「ドールハウス」の舞台挨拶付き上映を5月3日(土)に開催します。登壇者やチケット販売方法などの詳細は、決まり次第このページでお知らせします。',
    'お知らせ', '2025-04-20', 1),

(2, '第3回 HALシネマ ホラー映画祭 2025年6月開催決定',
    '第3回 HALシネマ ホラー映画祭を2025年6月に開催します。新旧の注目作上映に加え、監督トークや深夜上映などの特別企画を予定しています。',
    'イベント', '2025-04-15', 1),

(3, '毎月13日は「呪いのサービスデー」— 全作品1,300円均一',
    '毎月13日は「呪いのサービスデー」として、全作品を1,300円均一でご鑑賞いただけます。特別興行や一部イベント上映は対象外となる場合があります。',
    'キャンペーン', '2025-04-10', 1),

(4, 'スクリーン7・8リニューアル完了 — 最新ドルビーアトモス導入',
    'スクリーン7・8のリニューアル工事が完了し、最新のドルビーアトモス環境を導入しました。より立体的で緊張感のある音響体験を、ホラー・ミステリー・サスペンス作品でお楽しみください。',
    'お知らせ', '2025-04-01', 1),

(5, '4月8日(火)システムメンテナンスのため終日休業',
    '4月8日(火)はシステムメンテナンスのため、全館終日休業いたします。オンラインチケット購入およびお問い合わせフォームも一部時間帯でご利用いただけません。',
    'メンテナンス', '2025-03-28', 1),

(6, '「呪縛の家」2025年6月公開決定',
    '「呪縛の家」の公開が2025年6月に決定しました。予告映像や上映スケジュールは、決まり次第お知らせします。',
    '新作情報', '2025-03-15', 1),

(7, '「深淵より」2025年7月公開決定',
    '深海を舞台にした新感覚ホラー「深淵より」が2025年7月に公開予定です。詳細な上映情報は後日公開します。',
    '新作情報', '2025-03-01', 1),

(8, '「カラダ探し」特集上映を開催',
    '「カラダ探し」の特集上映を開催します。監督トークショー付きのスペシャル上映です。',
    'イベント', '2025-02-20', 1),

(9, '公式スマートフォンアプリをリリース',
    '公式スマートフォンアプリのリリースにより、オンライン予約機能がより便利になりました。チケット購入や上映情報の確認にご利用ください。',
    'お知らせ', '2025-02-01', 1);
