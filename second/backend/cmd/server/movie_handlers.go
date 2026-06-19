package main

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

// adminAccounts は admin 画面用の Basic 認証アカウント。
// 映画追加など更新系の API を保護する。
var adminAccounts = gin.Accounts{
	"admin": "pass",
}

func registerMovieRoutes(api *gin.RouterGroup, store *movieStore) {
	api.GET("/movies", func(c *gin.Context) {
		movies, err := store.List(c.Request.Context())
		if err != nil {
			writeMovieStoreError(c, err)
			return
		}
		c.JSON(http.StatusOK, movies)
	})

	admin := api.Group("/admin", gin.BasicAuth(adminAccounts))
	{
		// admin 画面のログイン確認と登録済み一覧の取得を兼ねる保護済みエンドポイント。
		admin.GET("/movies", func(c *gin.Context) {
			movies, err := store.List(c.Request.Context())
			if err != nil {
				writeMovieStoreError(c, err)
				return
			}
			c.JSON(http.StatusOK, movies)
		})

		admin.POST("/movies", func(c *gin.Context) {
			var req movieCreateRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				writeAPIError(c, http.StatusBadRequest, "入力内容を確認してください。")
				return
			}

			movie, err := store.Create(c.Request.Context(), req)
			if err != nil {
				writeMovieStoreError(c, err)
				return
			}

			c.JSON(http.StatusCreated, movie)
		})

		admin.DELETE("/movies/:id", func(c *gin.Context) {
			if err := store.Delete(c.Request.Context(), c.Param("id")); err != nil {
				writeMovieStoreError(c, err)
				return
			}
			c.JSON(http.StatusOK, gin.H{"status": "ok"})
		})
	}
}

func writeMovieStoreError(c *gin.Context, err error) {
	var validation validationError
	switch {
	case errors.As(err, &validation):
		writeAPIError(c, http.StatusBadRequest, validation.Error())
	case errors.Is(err, errMovieSchemaMissing):
		writeAPIError(c, http.StatusInternalServerError, "作品用データベースの初期化が完了していません。")
	case errors.Is(err, errMovieNotFound):
		writeAPIError(c, http.StatusNotFound, "指定された作品が見つかりません。")
	case errors.Is(err, errMovieInUse):
		writeAPIError(c, http.StatusConflict, "上映スケジュールが登録されている作品は削除できません。")
	default:
		writeAPIError(c, http.StatusInternalServerError, "作品情報の処理に失敗しました。")
	}
}
