package main

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func registerMemberRoutes(api *gin.RouterGroup, store *memberStore) {
	members := api.Group("/members")
	{
		members.POST("/register", func(c *gin.Context) {
			var req memberRegisterRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				writeAPIError(c, http.StatusBadRequest, "入力内容を確認してください。")
				return
			}

			member, token, err := store.Register(c.Request.Context(), req)
			if err != nil {
				writeMemberStoreError(c, err)
				return
			}

			c.JSON(http.StatusCreated, memberAuthResponse{
				Member: member,
				Token:  token,
			})
		})

		members.POST("/login", func(c *gin.Context) {
			var req memberLoginRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				writeAPIError(c, http.StatusBadRequest, "入力内容を確認してください。")
				return
			}

			member, token, err := store.Login(c.Request.Context(), req)
			if err != nil {
				writeMemberStoreError(c, err)
				return
			}

			c.JSON(http.StatusOK, memberAuthResponse{
				Member: member,
				Token:  token,
			})
		})

		members.GET("/me", func(c *gin.Context) {
			member, err := store.MemberByToken(c.Request.Context(), bearerToken(c))
			if err != nil {
				writeMemberStoreError(c, err)
				return
			}

			c.JSON(http.StatusOK, gin.H{"member": member})
		})

		members.POST("/logout", func(c *gin.Context) {
			if err := store.Logout(c.Request.Context(), bearerToken(c)); err != nil {
				writeMemberStoreError(c, err)
				return
			}

			c.JSON(http.StatusOK, gin.H{"status": "ok"})
		})
	}
}

func bearerToken(c *gin.Context) string {
	header := strings.TrimSpace(c.GetHeader("Authorization"))
	if strings.HasPrefix(strings.ToLower(header), "bearer ") {
		return strings.TrimSpace(header[7:])
	}
	return strings.TrimSpace(c.GetHeader("X-Member-Token"))
}

func writeMemberStoreError(c *gin.Context, err error) {
	var validation validationError
	switch {
	case errors.As(err, &validation):
		writeAPIError(c, http.StatusBadRequest, validation.Error())
	case errors.Is(err, errDuplicateEmail):
		writeAPIError(c, http.StatusConflict, "このメールアドレスはすでに登録されています。")
	case errors.Is(err, errInvalidCredentials):
		writeAPIError(c, http.StatusUnauthorized, "IDまたはパスワードが正しくありません。")
	case errors.Is(err, errUnauthorized):
		writeAPIError(c, http.StatusUnauthorized, "ログイン情報を確認してください。")
	default:
		writeAPIError(c, http.StatusInternalServerError, "会員情報の処理に失敗しました。")
	}
}

func writeAPIError(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"error": message})
}
