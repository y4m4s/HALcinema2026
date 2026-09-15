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

func main() {
	router := gin.Default()
	frontendDist := getEnv("FRONTEND_DIST", filepath.Join("..", "frontend", "dist"))
	memberDBPath := getEnv("MEMBER_DB_PATH", defaultMemberDBPath())
	memberStore, err := openMemberStore(memberDBPath)
	if err != nil {
		panic(err)
	}
	defer memberStore.Close()
	reservationStore, err := newReservationStore(memberStore.db)
	if err != nil {
		panic(err)
	}

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

		registerMemberRoutes(api, memberStore)
		registerReservationRoutes(api, reservationStore, memberStore)
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

func defaultMemberDBPath() string {
	cwd, err := os.Getwd()
	if err != nil {
		return filepath.Join("..", "halcinema_members.sqlite3")
	}

	if filepath.Base(cwd) == "backend" && filepath.Base(filepath.Dir(cwd)) == "second" {
		return filepath.Join(filepath.Dir(cwd), "halcinema_members.sqlite3")
	}

	if filepath.Base(cwd) == "second" {
		return filepath.Join(cwd, "halcinema_members.sqlite3")
	}

	secondDir := filepath.Join(cwd, "second")
	if stat, err := os.Stat(secondDir); err == nil && stat.IsDir() {
		return filepath.Join(secondDir, "halcinema_members.sqlite3")
	}

	return filepath.Join("..", "halcinema_members.sqlite3")
}
