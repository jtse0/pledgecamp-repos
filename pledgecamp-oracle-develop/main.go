package main

import (
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/pledgecamp/pledgecamp-oracle/connect"
	"github.com/pledgecamp/pledgecamp-oracle/constants"
	"github.com/pledgecamp/pledgecamp-oracle/handlers"
	"github.com/pledgecamp/pledgecamp-oracle/utils"
)

func TokenAuth() gin.HandlerFunc {
	requiredToken := "Bearer " + os.Getenv("APP_AUTH_ACCESS_TOKEN")

	// We want to make sure the token is set, bail if not
	if requiredToken == "" {
		log.Fatal("Please set APP_AUTH_ACCESS_TOKEN environment variable")
	}

	return func(c *gin.Context) {
		log.Println("Inside the authorization section")
		log.Println(c.Request)
		token := c.Request.Header.Get("Authorization")
		if token == requiredToken {
			tokenArray := strings.Fields(token)
			inputToken := tokenArray[1]
			if inputToken == requiredToken {
				c.Next()
			}
		} else {
			log.Println("Inputted token: ", token)
			c.AbortWithStatusJSON(401, gin.H{"error": "Invalid APP_AUTH_ACCESS_TOKEN"})
			return
		}
	}
}

func setupRouter() *gin.Engine {
	log.Print("Setting up router")
	r := gin.Default()

	corsConfig := cors.DefaultConfig()

	corsOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
	log.Println("CORS Origins: " + corsOrigins)

	// CORS
	if corsOrigins == "*" {
		corsConfig.AllowAllOrigins = true
	} else {
		corsConfig.AllowOrigins = []string{corsOrigins}
	}
	corsConfig.AllowHeaders = []string{"*"}
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
	r.Use(cors.New(corsConfig))

	// Route Definition
	r.GET("/", handlers.IndexHandler)
	r.GET("/projects/:id", handlers.ProjectStateHandler)
	r.GET("/cs/:id", handlers.CsStateHandler)
	r.GET("/cs/:id/"+string(constants.GetGains), handlers.CsGainsHandler)
	r.GET("/users/:id/"+string(constants.GetBalance), handlers.UserBalanceHandler)
	r.OPTIONS("/*anything", preflight)

	r.Use(TokenAuth())

	// Project Actions
	r.POST("/projects/:id/callback/:transaction_type", handlers.ProjectCallbackHandler)
	r.POST("/cs/:id/callback/:transaction_type", handlers.CsCallbackHandler)
	r.POST("/projects/:id", handlers.ProjectCreateHandler)
	r.POST("/projects/:id/"+string(constants.SetBackers), handlers.SetBackersHandler)
	r.POST("/projects/:id/"+string(constants.SetProjectInfo), handlers.SetProjectInfoHandler)
	r.POST("/projects/:id/"+string(constants.SetModerators), handlers.SetModeratorsHandler)
	r.POST("/projects/:id/"+string(constants.MilestoneVote), handlers.VoteHandler)
	r.POST("/projects/:id/"+string(constants.CheckMilestone), handlers.CheckMilestonesHandler)
	r.POST("/projects/:id/"+string(constants.ModerationVote), handlers.VoteHandler)
	r.POST("/projects/:id/"+string(constants.CommitFinalVotes), handlers.CommitModerationVoteHandler)
	r.POST("/projects/:id/"+string(constants.FailedFundRecovery), handlers.FundRecoveryHandler)
	r.POST("/projects/:id/"+string(constants.WithdrawFunds), handlers.ReleaseFundsHandler)
	r.POST("/projects/:id/"+string(constants.RequestRefund), handlers.ReleaseFundsHandler)
	r.POST("/projects/:id/"+string(constants.CancelProject), handlers.CancelHandler)
	r.POST("/cs/:id/"+string(constants.StakePLG), handlers.StakeHandler)
	r.POST("/cs/:id/"+string(constants.UnstakePLG), handlers.UnstakeHandler)
	r.POST("/cs/:id/"+string(constants.WithdrawInterest), handlers.WithdrawInterestHandler)
	r.POST("/cs/:id/"+string(constants.ReinvestPLG), handlers.ReinvestHandler)
	r.POST("/cs/:id/"+string(constants.PostInterest), handlers.PostInterestHandler)

	return r
}

func main() {
	log.Print("Pledgecamp Oracle started")
	_ = godotenv.Load()
	connect.PostgresMigrations()
	// envVar := connect.LookupEnvOrExit("ENV_MODE")
	// if strings.ToLower(envVar) == "test" {
	// 	connect.SqLiteMigrations()
	// } else {
	// 	connect.PostgresMigrations()
	// }

	utils.Warmup()
	router := setupRouter()

	if err := router.Run(":" + os.Getenv("APP_PORT")); err != nil {
		log.Fatal(err)
	}

}

func preflight(c *gin.Context) {
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Allow-Headers", "access-control-allow-origin, access-control-allow-headers")
	c.JSON(http.StatusOK, struct{}{})
}
