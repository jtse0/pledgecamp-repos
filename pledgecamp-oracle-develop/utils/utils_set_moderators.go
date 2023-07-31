package utils

import (
	"database/sql"
	"log"
	"os"
	"strconv"

	"github.com/imroc/req"
	"github.com/pledgecamp/pledgecamp-oracle/constants"
	"github.com/pledgecamp/pledgecamp-oracle/models"
	"github.com/pledgecamp/pledgecamp-oracle/structs"
)

// SetModerators - set moderators for moderation votes
func SetModerators(moderatorRequest RequestSetModerators) error {

	// Activity Definitions
	projectId := strconv.Itoa(moderatorRequest.FkProjectId)
	activityReference := string(constants.SetModerators)
	nodeServerURL := "/cs/projects/" + projectId + "/" + activityReference
	oracleCallbackURL := os.Getenv("APP_DOMAIN") + "/projects/" + projectId + "/callback/" + activityReference

	projectActivity, err := models.SetProjectActivity(moderatorRequest.FkProjectId, constants.SetModerators)
	if err != nil {
		log.Fatal(err)
	}

	// Create the base project
	project, _ := models.ProjectFetchById(moderatorRequest.FkProjectId)
	if err != nil {
		log.Fatal(err)
		return err
	}

	// Send request to stake PLG for CS to Nodeserver
	requestParameters := req.Param{
		"transaction_type":    activityReference,
		"contract_address":    project.ContractAddress,
		"moderators":          moderatorRequest.Moderators,
		"moderation_end_time": moderatorRequest.ModerationEndTime,
		"activity_id":         projectActivity.Id,
		"url_callback":        oracleCallbackURL,
	}

	_, err = PostNodeServer(requestParameters, nodeServerURL)
	if err != nil {
		log.Fatal(err)
		return err
	}

	return nil
}

// SetModeratorsCallback()
func SetModeratorsCallback(transactionResponse NodeServerModel, projectActivity ProjectActivity) error {

	// Only process if Nodeserver postback response successful
	log.Printf("Project status: %v", transactionResponse.Status)

	if transactionResponse.Status == structs.Complete {

		// Update Activity status to success
		projectActivity.Status = constants.ActivitySuccess
		projectActivity.TransactionHash = sql.NullString{String: transactionResponse.Hash, Valid: true}
		_, err := models.ProjectActivityUpdateFields(projectActivity)

		// Update project status & completed activity
		project, err := models.ProjectFetchById(projectActivity.ProjectId)
		if err != nil {
			log.Fatal(err)
		}
		project.Status = constants.ProjectModerationPhase
		project, err = models.ProjectUpdateFields(project)
		if err != nil {
			log.Fatal(err)
		}

		log.Println("The project moderators have been set.")

		projectId := strconv.Itoa(project.Id)
		backendURL := "/events/blockchain/projects/" + projectId + "/" + string(constants.StartModeration)
		requestParameters := req.Param{
			"event_type":       constants.StartModeration,
			"project_id":       project.Id,
			"project_contract": project.ContractAddress,
			"status":           true,
		}
		_, err = PostBackend(requestParameters, backendURL)
		if err != nil {
			log.Fatal(err)
			return err
		}

	}

	return nil
}
