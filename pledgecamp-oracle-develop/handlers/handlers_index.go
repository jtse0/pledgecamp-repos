package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func IndexHandler(c *gin.Context) {
	c.String(http.StatusOK, "Pledgecamp Oracle")
}
