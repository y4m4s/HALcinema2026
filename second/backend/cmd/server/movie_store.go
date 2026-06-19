package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
)

var (
	errMovieSchemaMissing = errors.New("movie schema missing")
	errMovieNotFound      = errors.New("movie not found")
	errMovieInUse         = errors.New("movie in use")
)

type movieStore struct {
	db *sql.DB
}

// movieCreateRequest は admin 画面の映画追加フォームから送られる入力。
// title と durationMin は schema.sql の NOT NULL / CHECK 制約に合わせて必須。
type movieCreateRequest struct {
	Title       string `json:"title"`
	TitleKana   string `json:"titleKana"`
	TitleEn     string `json:"titleEn"`
	Rating      string `json:"rating"`
	DurationMin int    `json:"durationMin"`
	PosterURL   string `json:"posterUrl"`
	Tagline     string `json:"tagline"`
	Synopsis    string `json:"synopsis"`
	Genre       string `json:"genre"`
	Language    string `json:"language"`
	Director    string `json:"director"`
	MainActor   string `json:"mainActor"`
}

type movieDetail struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	TitleKana   string `json:"titleKana"`
	TitleEn     string `json:"titleEn"`
	Rating      string `json:"rating"`
	DurationMin int    `json:"durationMin"`
	PosterURL   string `json:"posterUrl"`
	Tagline     string `json:"tagline"`
	Synopsis    string `json:"synopsis"`
	Genre       string `json:"genre"`
	Language    string `json:"language"`
	Director    string `json:"director"`
	MainActor   string `json:"mainActor"`
}

func newMovieStore(db *sql.DB) (*movieStore, error) {
	store := &movieStore{db: db}
	if err := store.init(context.Background()); err != nil {
		return nil, err
	}
	return store, nil
}

func (s *movieStore) init(ctx context.Context) error {
	for _, table := range []string{"movies", "people", "movie_people"} {
		var name string
		err := s.db.QueryRowContext(
			ctx,
			`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
			table,
		).Scan(&name)
		if errors.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("%w: %s", errMovieSchemaMissing, table)
		}
		if err != nil {
			return err
		}
	}
	return nil
}

// List は登録済みの全作品を、監督名・主演名つきで ID 昇順に返す。
func (s *movieStore) List(ctx context.Context) ([]movieDetail, error) {
	rows, err := s.db.QueryContext(
		ctx,
		`SELECT m.id, m.title,
		        COALESCE(m.title_kana, ''), COALESCE(m.title_en, ''),
		        COALESCE(m.rating, ''), m.duration_min,
		        COALESCE(m.poster_url, ''), COALESCE(m.tagline, ''),
		        COALESCE(m.synopsis, ''), COALESCE(m.genre, ''),
		        COALESCE(m.language, ''),
		        COALESCE(dir.name, ''), COALESCE(act.name, '')
		   FROM movies AS m
		   LEFT JOIN people AS dir ON dir.id = m.director_person_id
		   LEFT JOIN people AS act ON act.id = m.main_actor_person_id
		  ORDER BY m.id`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	movies := []movieDetail{}
	for rows.Next() {
		var movie movieDetail
		if err := rows.Scan(
			&movie.ID, &movie.Title, &movie.TitleKana, &movie.TitleEn,
			&movie.Rating, &movie.DurationMin, &movie.PosterURL, &movie.Tagline,
			&movie.Synopsis, &movie.Genre, &movie.Language,
			&movie.Director, &movie.MainActor,
		); err != nil {
			return nil, err
		}
		movies = append(movies, movie)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return movies, nil
}

// Create は新しい作品を登録し、登録後の内容を返す。監督・主演は氏名から
// people を引き当て（無ければ作成）、movies と movie_people の双方に紐付ける。
func (s *movieStore) Create(ctx context.Context, req movieCreateRequest) (movieDetail, error) {
	req = normalizeMovieRequest(req)
	if err := validateMovieRequest(req); err != nil {
		return movieDetail{}, err
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return movieDetail{}, err
	}
	defer tx.Rollback()

	movieID, err := nextMovieID(ctx, tx)
	if err != nil {
		return movieDetail{}, err
	}

	directorID, err := resolvePersonID(ctx, tx, req.Director)
	if err != nil {
		return movieDetail{}, err
	}
	actorID, err := resolvePersonID(ctx, tx, req.MainActor)
	if err != nil {
		return movieDetail{}, err
	}

	_, err = tx.ExecContext(
		ctx,
		`INSERT INTO movies
			(id, director_person_id, main_actor_person_id, title, title_kana, title_en,
			 rating, duration_min, poster_url, tagline, synopsis, genre, language)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		movieID,
		directorID,
		actorID,
		req.Title,
		nullableString(req.TitleKana),
		nullableString(req.TitleEn),
		nullableString(req.Rating),
		req.DurationMin,
		nullableString(req.PosterURL),
		nullableString(req.Tagline),
		nullableString(req.Synopsis),
		nullableString(req.Genre),
		nullableString(req.Language),
	)
	if err != nil {
		return movieDetail{}, err
	}

	if directorID != nil {
		if err := linkMoviePerson(ctx, tx, movieID, directorID, "監督"); err != nil {
			return movieDetail{}, err
		}
	}
	if actorID != nil {
		if err := linkMoviePerson(ctx, tx, movieID, actorID, "出演"); err != nil {
			return movieDetail{}, err
		}
	}

	if err := tx.Commit(); err != nil {
		return movieDetail{}, err
	}

	return movieDetail{
		ID:          movieID,
		Title:       req.Title,
		TitleKana:   req.TitleKana,
		TitleEn:     req.TitleEn,
		Rating:      req.Rating,
		DurationMin: req.DurationMin,
		PosterURL:   req.PosterURL,
		Tagline:     req.Tagline,
		Synopsis:    req.Synopsis,
		Genre:       req.Genre,
		Language:    req.Language,
		Director:    req.Director,
		MainActor:   req.MainActor,
	}, nil
}

// Delete は作品を1件削除する。movie_people は ON DELETE CASCADE で一緒に消える。
// 上映スケジュールが紐づく作品（schedules.movie_id は ON DELETE RESTRICT）は
// 削除できず errMovieInUse を返す。
func (s *movieStore) Delete(ctx context.Context, id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return errMovieNotFound
	}

	result, err := s.db.ExecContext(ctx, `DELETE FROM movies WHERE id = ?`, id)
	if err != nil {
		if isForeignKeyConstraintError(err) {
			return errMovieInUse
		}
		return err
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return errMovieNotFound
	}
	return nil
}

// nextMovieID は既存の "M0xx" 形式IDの最大番号 + 1 を採番する。
func nextMovieID(ctx context.Context, tx *sql.Tx) (string, error) {
	rows, err := tx.QueryContext(ctx, `SELECT id FROM movies`)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	max := 0
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return "", err
		}
		if n := trailingInt(id); n > max {
			max = n
		}
	}
	if err := rows.Err(); err != nil {
		return "", err
	}
	return fmt.Sprintf("M%03d", max+1), nil
}

// resolvePersonID は氏名から people を引き当て、無ければ作成してIDを返す。
// 氏名が空のときは nil を返す（監督・主演は任意項目）。
func resolvePersonID(ctx context.Context, tx *sql.Tx, name string) (any, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, nil
	}

	var id int64
	err := tx.QueryRowContext(ctx, `SELECT id FROM people WHERE name = ? LIMIT 1`, name).Scan(&id)
	if err == nil {
		return id, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	result, err := tx.ExecContext(ctx, `INSERT INTO people (name) VALUES (?)`, name)
	if err != nil {
		return nil, err
	}
	id, err = result.LastInsertId()
	if err != nil {
		return nil, err
	}
	return id, nil
}

func linkMoviePerson(ctx context.Context, tx *sql.Tx, movieID string, personID any, role string) error {
	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO movie_people (movie_id, person_id, role, display_order)
		 VALUES (?, ?, ?, 1)`,
		movieID,
		personID,
		role,
	)
	return err
}

func normalizeMovieRequest(req movieCreateRequest) movieCreateRequest {
	req.Title = strings.TrimSpace(req.Title)
	req.TitleKana = strings.TrimSpace(req.TitleKana)
	req.TitleEn = strings.TrimSpace(req.TitleEn)
	req.Rating = strings.TrimSpace(req.Rating)
	req.PosterURL = strings.TrimSpace(req.PosterURL)
	req.Tagline = strings.TrimSpace(req.Tagline)
	req.Synopsis = strings.TrimSpace(req.Synopsis)
	req.Genre = strings.TrimSpace(req.Genre)
	req.Language = strings.TrimSpace(req.Language)
	req.Director = strings.TrimSpace(req.Director)
	req.MainActor = strings.TrimSpace(req.MainActor)
	return req
}

func validateMovieRequest(req movieCreateRequest) error {
	if req.Title == "" {
		return validationError("作品タイトルを入力してください。")
	}
	if req.DurationMin <= 0 {
		return validationError("上映時間（分）を1以上で入力してください。")
	}
	return nil
}
