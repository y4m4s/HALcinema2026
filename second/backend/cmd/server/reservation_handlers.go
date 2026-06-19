package main

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

func registerReservationRoutes(api *gin.RouterGroup, reservations *reservationStore, members *memberStore) {
	api.GET("/schedules/availability", func(c *gin.Context) {
		availability, err := reservations.SchedulesAvailability(c.Request.Context())
		if err != nil {
			writeReservationStoreError(c, err)
			return
		}
		c.JSON(http.StatusOK, availability)
	})

	group := api.Group("/reservations")
	{
		group.GET("/availability", func(c *gin.Context) {
			req := reservationCreateRequest{
				MovieID: c.Query("movie"),
				Screen:  c.Query("screen"),
				Start:   c.Query("start"),
				End:     c.Query("end"),
				Date:    c.Query("date"),
			}

			availability, err := reservations.Availability(c.Request.Context(), req)
			if err != nil {
				writeReservationStoreError(c, err)
				return
			}

			c.JSON(http.StatusOK, availability)
		})

		group.POST("", func(c *gin.Context) {
			limitJSONBody(c)

			var req reservationCreateRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				writeAPIError(c, http.StatusBadRequest, "入力内容を確認してください。")
				return
			}

			var member *memberResponse
			if token := bearerToken(c); token != "" {
				resolvedMember, err := members.MemberByToken(c.Request.Context(), token)
				if err != nil {
					writeMemberStoreError(c, err)
					return
				}
				member = &resolvedMember
			}

			result, err := reservations.Create(c.Request.Context(), req, member)
			if err != nil {
				writeReservationStoreError(c, err)
				return
			}

			c.JSON(http.StatusCreated, result)
		})
	}
}

func writeReservationStoreError(c *gin.Context, err error) {
	var validation validationError
	switch {
	case errors.As(err, &validation):
		writeAPIError(c, http.StatusBadRequest, validation.Error())
	case errors.Is(err, errReservationSchemaMissing):
		writeAPIError(c, http.StatusInternalServerError, "予約用データベースの初期化が完了していません。")
	case errors.Is(err, errShowtimeNotFound):
		writeAPIError(c, http.StatusNotFound, "指定された上映回が見つかりません。")
	case errors.Is(err, errSeatNotFound):
		writeAPIError(c, http.StatusBadRequest, "指定された座席が見つかりません。")
	case errors.Is(err, errSeatAlreadyReserved):
		writeAPIError(c, http.StatusConflict, "選択した座席はすでに予約されています。")
	case errors.Is(err, errTicketTypeNotFound):
		writeAPIError(c, http.StatusBadRequest, "指定された券種が見つかりません。")
	case errors.Is(err, errPaymentMethodNotFound):
		writeAPIError(c, http.StatusBadRequest, "指定された支払方法が見つかりません。")
	default:
		writeAPIError(c, http.StatusInternalServerError, "予約情報の処理に失敗しました。")
	}
}
