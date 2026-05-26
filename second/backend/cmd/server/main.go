package main

import (
	"net/http"
	"os"
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

func main() {
	router := gin.Default()

	router.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"service": "halcinema-second-api",
			"message": "Gin backend is running",
		})
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
	}

	if err := router.Run(":" + getEnv("PORT", "8080")); err != nil {
		panic(err)
	}
}

func getEnv(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
