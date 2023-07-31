package handlers

import (
	"database/sql"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/imroc/req"
	"github.com/pledgecamp/pledgecamp-oracle/constants"
	"github.com/pledgecamp/pledgecamp-oracle/models"
	"github.com/pledgecamp/pledgecamp-oracle/structs"
	"github.com/pledgecamp/pledgecamp-oracle/utils"
)

func ProjectCallbackHandler(c *gin.Context) {

	var projectNSResp structs.NodeServerModel
	err := c.BindJSON(&projectNSResp)
	if err != nil {
		log.Println(err)
		c.JSON(http.StatusBadRequest, gin.H{
			"msg": "Invalid Request Data",
		})
		return
	}

	// Get Project Activity Record
	projectActivityId := projectNSResp.ParentID
	targetActivity, err := models.ProjectActivitySearchActivityID(projectActivityId)
	if err != nil {
		log.Fatal(err)
	}
	// TODO Set transaction hash on activity
	targetActivity.TransactionHash = sql.NullString{String: projectNSResp.Hash, Valid: true}
	updatedActivity, err := models.ProjectActivityUpdateFields(targetActivity)
	if err != nil {
		log.Fatal(err)
	}

	// TODO Generic response failure handler
	var errorResponse error
	log.Println("Type: ", projectNSResp.Type)
	if projectNSResp.Status <= 2 {
		log.Println("Project Status")
		log.Println(projectNSResp.Status)
		switch projectNSResp.Type {
		case string(constants.ProjectDeploy):
			errorResponse = utils.ProjectCreateCallback(projectNSResp, updatedActivity)
		case string(constants.SetBackers):
			errorResponse = utils.SetBackersCallback(projectNSResp, updatedActivity)
		case string(constants.SetProjectInfo):
			errorResponse = utils.SetProjectInfoCallback(projectNSResp, updatedActivity)
		case string(constants.SetModerators):
			errorResponse = utils.SetModeratorsCallback(projectNSResp, updatedActivity)
		case string(constants.CommitFinalVotes):
			errorResponse = utils.CommitModerationVotesCallback(projectNSResp, updatedActivity)
		case string(constants.CancelProject):
			errorResponse = utils.CancelProjectCallback(projectNSResp, updatedActivity)
		case string(constants.MilestoneVote):
			errorResponse = utils.VoteCallback(projectNSResp, updatedActivity)
		case string(constants.ModerationVote):
			errorResponse = utils.VoteCallback(projectNSResp, updatedActivity)
		case string(constants.CheckMilestone):
			errorResponse = utils.CheckMilestoneCallback(projectNSResp, updatedActivity)
		case string(constants.WithdrawFunds):
			errorResponse = utils.WithdrawFundsCallback(projectNSResp, updatedActivity)
		case string(constants.RequestRefund):
			errorResponse = utils.RequestRefundCallback(projectNSResp, updatedActivity)
		case string(constants.FailedFundRecovery):
			errorResponse = utils.FailedFundRecoveryCallback(projectNSResp, updatedActivity)

		// Dumb transactions with no advanced behaviour but simple postback to backend
		default:
			// TODO Generic success handler
			if projectNSResp.Status == structs.Complete {

				// Update Activity status to success
				targetActivity.Status = constants.ActivitySuccess
				targetActivity.TransactionHash = sql.NullString{String: projectNSResp.Hash, Valid: true}
				_, err := models.ProjectActivityUpdateFields(targetActivity)
				if err != nil {
					log.Fatal(err)
				}

				log.Println("The following callback has been completed: ", projectNSResp.Type)

				backendEventType, err := constants.GetEventType(targetActivity.Type)
				if err != nil {
					log.Fatal(err)
				}

				backendCallbackURL := "/events/blockchain/projects/" + strconv.Itoa(updatedActivity.ProjectId) + "/callback/" + string(projectNSResp.Type)
				requestParameters := req.Param{
					"eventType":       backendEventType,
					"projectId":       updatedActivity.ProjectId,
					"contractAddress": projectNSResp.ContractAddress,
					"status":          true,
				}
				_, err = utils.PostBackend(requestParameters, backendCallbackURL)
				if err != nil {
					log.Fatal(err)
				}
			}
		}
	} else {
		log.Println("Function failed: ", projectNSResp.Status)

		switch projectNSResp.Status {
		case structs.FailedTimeout:
			updatedActivity.Status = constants.ActivityTimeout
		case structs.FailedGas:
			updatedActivity.Status = constants.ActivityGasError
		case structs.FailedInitial:
			updatedActivity.Status = constants.ActivityInitialError
		case structs.FailedReceipt:
			updatedActivity.Status = constants.ActivityReceiptError
		case structs.FailedPending:
			updatedActivity.Status = constants.ActivityPendingError
		}
		updatedActivity.TransactionHash = sql.NullString{String: projectNSResp.Hash, Valid: true}
		updatedActivity.ModifiedAt = time.Now()
		_, err := models.ProjectActivityUpdateFields(updatedActivity)
		if err != nil {
			log.Fatal(err)
		}

		backendEventType, err := constants.GetEventType(updatedActivity.Type)
		if err != nil {
			log.Fatal(err)
		}

		// Send response back to backend if activities required are completed
		backendCallbackURL := "/events/blockchain/projects/" + strconv.Itoa(updatedActivity.ProjectId) + "/callback/" + string(projectNSResp.Type)
		requestParameters := req.Param{
			"eventType":       backendEventType,
			"projectId":       updatedActivity.ProjectId,
			"contractAddress": projectNSResp.ContractAddress,
			"status":          false,
		}
		_, err = utils.PostBackend(requestParameters, backendCallbackURL)
		if err != nil {
			log.Fatal(err)
		}
	}

	if errorResponse != nil {
		log.Fatal(errorResponse)
		c.JSON(http.StatusBadRequest, gin.H{
			"msg": "Utility callback failed",
		})
	} else {
		c.JSON(http.StatusOK, gin.H{
			"msg": "Project callback is OK",
		})
	}
}

func CsCallbackHandler(c *gin.Context) {
	var csNSResp structs.NodeServerModel
	err := c.BindJSON(&csNSResp)
	if err != nil {
		log.Println(err)
		c.JSON(http.StatusBadRequest, gin.H{
			"msg": "Invalid Request Data",
		})
		return
	}

	// Get CS Activity Record
	csActivityId := csNSResp.ParentID
	targetCsActivity, err := models.CSActivitySearchActivityID(csActivityId)
	if err != nil {
		log.Fatal(err)
	}
	// TODO Set transaction hash on activity
	targetCsActivity.TransactionHash = sql.NullString{String: csNSResp.Hash, Valid: true}
	updatedCsActivity, err := models.CSActivityUpdateFields(targetCsActivity)
	if err != nil {
		log.Fatal(err)
	}

	// TODO Generic response failure handler
	var errorResponse error
	log.Println("Type: ", csNSResp.Type)
	if csNSResp.Status <= 2 {
		log.Println("CS Status")
		log.Println(csNSResp.Status)
		switch csNSResp.Type {
		case string(constants.StakePLG):
			errorResponse = utils.StakePLGCallback(csNSResp, updatedCsActivity)
		case string(constants.UnstakePLG):
			errorResponse = utils.UnstakePLGCallback(csNSResp, updatedCsActivity)
		case string(constants.WithdrawInterest):
			errorResponse = utils.WithdrawInterestCallback(csNSResp, updatedCsActivity)
		case string(constants.ReinvestPLG):
			errorResponse = utils.ReinvestPLGCallback(csNSResp, updatedCsActivity)
		case string(constants.PostInterest):
			errorResponse = utils.PostInterestCallback(csNSResp, updatedCsActivity)

		// Dumb transactions with no advanced behaviour but simple postback to backend
		default:
			// TODO Generic success handler
			if csNSResp.Status == structs.Complete {

				// Update Activity status to success
				targetCsActivity.Status = constants.ActivitySuccess
				targetCsActivity.TransactionHash = sql.NullString{String: csNSResp.Hash, Valid: true}
				updatedCsActivity, err := models.CSActivityUpdateFields(targetCsActivity)
				if err != nil {
					log.Fatal(err)
				}

				updatedCS, err := models.CSSearchCSId(updatedCsActivity.CsId)
				if err != nil {
					log.Fatal(err)
				}

				log.Println("The following callback has been completed: ", csNSResp.Type)

				backendEventType, err := constants.GetEventType(targetCsActivity.Type)
				if err != nil {
					log.Fatal(err)
				}

				backendCallbackURL := "/events/blockchain/cs/" + strconv.Itoa(updatedCS.UserId) + "/callback/" + string(csNSResp.Type)
				requestParameters := req.Param{
					"eventType": backendEventType,
					"projectId": updatedCS.UserId,
					"status":    true,
				}
				_, err = utils.PostBackend(requestParameters, backendCallbackURL)
				if err != nil {
					log.Fatal(err)
				}
			}
		}
	} else {
		log.Println("Function failed: ", csNSResp.Status)

		switch csNSResp.Status {
		case structs.FailedTimeout:
			updatedCsActivity.Status = constants.ActivityTimeout
		case structs.FailedGas:
			updatedCsActivity.Status = constants.ActivityGasError
		case structs.FailedInitial:
			updatedCsActivity.Status = constants.ActivityInitialError
		case structs.FailedReceipt:
			updatedCsActivity.Status = constants.ActivityReceiptError
		case structs.FailedPending:
			updatedCsActivity.Status = constants.ActivityPendingError
		}
		updatedCsActivity.TransactionHash = sql.NullString{String: csNSResp.Hash, Valid: true}
		updatedCsActivity.ModifiedAt = time.Now()
		_, err := models.CSActivityUpdateFields(updatedCsActivity)
		if err != nil {
			log.Fatal(err)
		}

		updatedCS, err := models.CSSearchCSId(updatedCsActivity.CsId)
		if err != nil {
			log.Fatal(err)
		}

		backendEventType, err := constants.GetEventType(updatedCsActivity.Type)
		if err != nil {
			log.Fatal(err)
		}

		// Send response back to backend if activities required are completed
		backendCallbackURL := "/events/blockchain/cs/" + strconv.Itoa(updatedCS.UserId) + "/callback/" + string(csNSResp.Type)
		requestParameters := req.Param{
			"eventType":       backendEventType,
			"userId":          updatedCS.UserId,
			"contractAddress": csNSResp.ContractAddress,
			"status":          false,
		}
		_, err = utils.PostBackend(requestParameters, backendCallbackURL)
		if err != nil {
			log.Fatal(err)
		}
	}

	if errorResponse != nil {
		log.Fatal(errorResponse)
		c.JSON(http.StatusBadRequest, gin.H{
			"msg": "Utility callback failed",
		})
	} else {
		c.JSON(http.StatusOK, gin.H{
			"msg": "Project callback is OK",
		})
	}
}

// POST requests
func ProjectCreateHandler(c *gin.Context) {
	var projectRequest structs.RequestProjectCreate
	if err := c.BindJSON(&projectRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"msg": "Invalid Request Data",
		})
		return
	}
	_, err := utils.ProjectCreate(projectRequest)
	if err != nil {
		log.Printf("%v", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"msg": err.Error(),
		})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"msg": "Project create accepted",
	})
}

func SetBackersHandler(c *gin.Context) {
	var setBackersRequest structs.RequestSetBackers
	if err := c.BindJSON(&setBackersRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"msg": "Invalid Request Data",
		})
		return
	}
	utils.SetBackers(setBackersRequest)

	c.JSON(http.StatusAccepted, gin.H{
		"msg": "Set Backers accepted",
	})
}

func SetProjectInfoHandler(c *gin.Context) {
	var setProjectInfoRequest structs.RequestSetProjectInfo
	if err := c.BindJSON(&setProjectInfoRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"msg": "Invalid Request Data",
		})
		return
	}
	utils.SetProjectInfo(setProjectInfoRequest)

	c.JSON(http.StatusAccepted, gin.H{
		"msg": "Set Project Info accepted",
	})

}

func VoteHandler(c *gin.Context) {

	var voteRequest structs.RequestVote
	if err := c.BindJSON(&voteRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"msg": "Invalid Request Data",
		})
		return
	}

	utils.SubmitVote(voteRequest)

	c.JSON(http.StatusAccepted, gin.H{
		"msg": "Submit Vote accepted",
	})
}

func SetModeratorsHandler(c *gin.Context) {
	var moderatorRequest structs.RequestSetModerators
	if err := c.BindJSON(&moderatorRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"msg": "Invalid Request Data",
		})
		return
	}
	utils.SetModerators(moderatorRequest)

	c.JSON(http.StatusAccepted, gin.H{
		"msg": "Set moderators accepted",
	})
}

func CommitModerationVoteHandler(c *gin.Context) {
	var moderationVoteRequest structs.RequestCommitModerationVotes
	if err := c.BindJSON(&moderationVoteRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"msg": "Invalid Request Data",
		})
		return
	}
	utils.CommitModerationVotes(moderationVoteRequest)

	c.JSON(http.StatusAccepted, gin.H{
		"msg": "Commit moderation accepted",
	})
}

func CancelHandler(c *gin.Context) {
	var cancelRequest structs.RequestCancelProject
	if err := c.BindJSON(&cancelRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"msg": "Invalid Request Data",
		})
		return
	}
	utils.CancelProject(cancelRequest)

	c.JSON(http.StatusAccepted, gin.H{
		"msg": "Cancel project accepted",
	})
}

func ReleaseFundsHandler(c *gin.Context) {
	var releaseFundRequest structs.RequestReleaseFunds
	if err := c.BindJSON(&releaseFundRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"msg": "Invalid Request Data",
		})
		return
	}
	utils.ReleaseFunds(releaseFundRequest)

	c.JSON(http.StatusAccepted, gin.H{
		"msg": "Release funds accepted",
	})
}

func FundRecoveryHandler(c *gin.Context) {
	var fundRecoveryRequest structs.RequestFailedFundRecovery
	if err := c.BindJSON(&fundRecoveryRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"msg": "Invalid Request Data",
		})
		return
	}
	utils.FailedFundRecovery(fundRecoveryRequest)

	c.JSON(http.StatusAccepted, gin.H{
		"msg": "Failed Fund recovery accepted",
	})
}

func StakeHandler(c *gin.Context) {
	var stakeRequest structs.RequestStakePLG
	if err := c.BindJSON(&stakeRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"msg": "Invalid Request Data",
		})
		return
	}
	utils.StakePLG(stakeRequest)

	c.JSON(http.StatusAccepted, gin.H{
		"msg": "Stake PLG accepted",
	})
}

func UnstakeHandler(c *gin.Context) {
	var unstakeRequest structs.RequestUnstakePLG
	if err := c.BindJSON(&unstakeRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"msg": "Invalid Request Data",
		})
		return
	}
	utils.UnstakePLG(unstakeRequest)

	c.JSON(http.StatusAccepted, gin.H{
		"msg": "Unstake PLG accepted",
	})
}

func WithdrawInterestHandler(c *gin.Context) {
	var withdrawInterestRequest structs.RequestWithdrawInterest
	if err := c.BindJSON(&withdrawInterestRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"msg": "Invalid Request Data",
		})
		return
	}
	utils.WithdrawInterest(withdrawInterestRequest)

	c.JSON(http.StatusAccepted, gin.H{
		"msg": "Withdraw Interest accepted",
	})
}

func ReinvestHandler(c *gin.Context) {
	var reinvestRequest structs.RequestReinvestPLG
	if err := c.BindJSON(&reinvestRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"msg": "Invalid Request Data",
		})
		return
	}
	utils.ReinvestPLG(reinvestRequest)

	c.JSON(http.StatusAccepted, gin.H{
		"msg": "Request reinvest accepted",
	})
}

func PostInterestHandler(c *gin.Context) {
	var postInterestRequest structs.RequestPostInterest
	if err := c.BindJSON(&postInterestRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"msg": "Invalid Request Data",
		})
		return
	}
	utils.PostInterest(postInterestRequest)

	c.JSON(http.StatusAccepted, gin.H{
		"msg": "Request post interest accepted",
	})
}

func CheckMilestonesHandler(c *gin.Context) {
	var milestoneCheckRequest structs.RequestCheckMilestones
	if err := c.BindJSON(&milestoneCheckRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"msg": "Invalid Request Data",
		})
		return
	}
	utils.CheckMilestones(milestoneCheckRequest)

	c.JSON(http.StatusAccepted, gin.H{
		"msg": "Milestone Check accepted",
	})
}

// GET requests
func ProjectStateHandler(c *gin.Context) {
	var projectRequest structs.RequestProjectState
	if err := c.BindJSON(&projectRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"msg": "Invalid Request Data",
		})
		return
	}
	projectState, err := utils.ProjectGetState(projectRequest)
	if err != nil {
		log.Printf("%v", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"msg": err.Error(),
		})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"msg": projectState,
	})
}

func CsStateHandler(c *gin.Context) {
	var csRequest structs.RequestCsState
	if err := c.BindJSON(&csRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"msg": "Invalid Request Data",
		})
		return
	}
	csState, err := utils.CsGetState(csRequest)
	if err != nil {
		log.Printf("%v", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"msg": err.Error(),
		})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"msg": csState,
	})
}

func CsGainsHandler(c *gin.Context) {
	var gainsRequest structs.RequestCsGains
	if err := c.BindJSON(&gainsRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"msg": "Invalid Request Data",
		})
		return
	}
	csGains, err := utils.CsGains(gainsRequest)
	if err != nil {
		log.Printf("%v", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"msg": err.Error(),
		})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"msg": csGains,
	})
}

func UserBalanceHandler(c *gin.Context) {
	var balanceRequest structs.RequestUserBalance
	if err := c.BindJSON(&balanceRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"msg": "Invalid Request Data",
		})
		return
	}
	userBalance, err := utils.GetBalance(balanceRequest)
	if err != nil {
		log.Printf("%v", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"msg": err.Error(),
		})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"msg": userBalance,
	})
}
