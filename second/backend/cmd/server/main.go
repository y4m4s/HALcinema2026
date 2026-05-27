package main

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type healthResponse struct {
	Service string `json:"service"`
	Status  string `json:"status"`
	Version string `json:"version"`
	Time    string `json:"time"`
}

type movieSummary struct {
	ID          int    `json:"id"`
	Title       string `json:"title"`
	Genre       string `json:"genre"`
	ReleaseYear int    `json:"releaseYear"`
}

type pageSummary struct {
	Path  string `json:"path"`
	Title string `json:"title"`
}

func main() {
	router := gin.Default()
	frontendDist := getEnv("FRONTEND_DIST", filepath.Join("..", "frontend", "dist"))

	router.GET("/", func(c *gin.Context) {
		serveFrontend(c, frontendDist)
	})

	api := router.Group("/api")
	{
		api.GET("/health", func(c *gin.Context) {
			c.JSON(http.StatusOK, healthResponse{
				Service: "Gin API",
				Status:  "ok",
				Version: "v0.1.0",
				Time:    time.Now().Format(time.RFC3339),
			})
		})

		api.GET("/movies", func(c *gin.Context) {
			c.JSON(http.StatusOK, []movieSummary{
				{ID: 1, Title: "境界のシアター", Genre: "Mystery", ReleaseYear: 2026},
				{ID: 2, Title: "午前零時の上映会", Genre: "Horror", ReleaseYear: 2026},
				{ID: 3, Title: "沈黙のスクリーン", Genre: "Suspense", ReleaseYear: 2026},
			})
		})

		api.GET("/pages", func(c *gin.Context) {
			c.JSON(http.StatusOK, []pageSummary{
				{Path: "/", Title: "トップ"},
				{Path: "/works", Title: "上映作品一覧"},
				{Path: "/schedule", Title: "上映スケジュール"},
				{Path: "/theater", Title: "劇場案内"},
				{Path: "/access", Title: "交通案内"},
				{Path: "/tickets", Title: "料金案内"},
				{Path: "/question", Title: "よくある質問"},
				{Path: "/contact", Title: "お問い合わせ"},
				{Path: "/news", Title: "お知らせ"},
			})
		})
	}

	router.Static("/assets", filepath.Join(frontendDist, "assets"))
	router.Static("/css", filepath.Join(frontendDist, "css"))

	router.NoRoute(func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/api/") {
			c.JSON(http.StatusNotFound, gin.H{"error": "api route not found"})
			return
		}
		serveFrontend(c, frontendDist)
	})

	if err := router.Run(":" + getEnv("PORT", "8080")); err != nil {
		panic(err)
	}
}

func serveFrontend(c *gin.Context, frontendDist string) {
	indexPath := filepath.Join(frontendDist, "index.html")
	if _, err := os.Stat(indexPath); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"service": "halcinema-second-api",
			"message": "Gin backend is running. Build frontend to serve React from this process.",
		})
		return
	}

	c.File(indexPath)
}

func getEnv(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
