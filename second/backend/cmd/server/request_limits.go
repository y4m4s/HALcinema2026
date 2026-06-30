package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func limitJSONBody(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxAPIJSONBodyBytes)
}
