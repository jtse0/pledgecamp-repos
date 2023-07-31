package utils

import (
	"database/sql"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/imroc/req"
	"github.com/pledgecamp/pledgecamp-oracle/constants"
	"github.com/pledgecamp/pledgecamp-oracle/models"
	"github.com/pledgecamp/pledgecamp-oracle/structs"
)

// FailedFundRecovery
func FailedFundRecovery(recoveryRequest RequestFailedFundRecovery) error {
	projectId := strconv.Itoa(recoveryRequest.FkProjectId)
	activityReference := string(constants.FailedFundRecovery)

	nodeServerURL := "/projects/" + projectId + "/" + activityReference
	oracleCallbackURL := os.Getenv("APP_DOMAIN") + "/projects/" + projectId + "/callback/" + activityReference

	// Get project information
	project, _ := models.ProjectFetchById(recoveryRequest.FkProjectId)
	if err != nil {
		log.Fatal(err)
		return err
	}

	// Create project activity for tracking purposes
	projectActivity, err := models.SetProjectActivity(recoveryRequest.FkProjectId, constants.FailedFundRecovery)
	if err != nil {
		log.Fatal(err)
	}

	// Get parameters from the above structs
	requestParameters := req.Param{
		"transaction_type": activityReference,
		"contract_address": project.ContractAddress,
		"activity_id":      projectActivity.Id,
		"url_callback":     oracleCallbackURL,
	}

	_, err = PostNodeServer(requestParameters, nodeServerURL)
	if err != nil {
		log.Fatal(err)
		return err
	}

	return nil
}

func FailedFundRecoveryCallback(transactionResponse NodeServerModel, projectActivity ProjectActivity) error {

	// Only process if Nodeserver postback response successful
	log.Printf("Project status: %v", transactionResponse.Status)

	if transactionResponse.Status == structs.Complete {

		// Update funds recovered amount from Nodeserver
		fundsRecovered := 0
		fundsInterface := transactionResponse.TransactionEvents.([]interface{})
		log.Println("Funds recovered result")
		log.Println(fundsInterface)

		for _, funds := range fundsInterface {
			fundItem := funds.([]interface{})
			log.Println(funds)
			fundsRecovered, _ = strconv.Atoi(fundItem[0].(string))
			log.Println(fundsRecovered)
		}

		// Update Activity status to success
		projectActivity.Status = constants.ActivitySuccess
		projectActivity.TransactionHash = sql.NullString{String: transactionResponse.Hash, Valid: true}
		_, err := models.ProjectActivityUpdateFields(projectActivity)

		// Update project status, created contract address, & completed activity
		project, err := models.ProjectFetchById(projectActivity.ProjectId)
		if err != nil {
			log.Fatal(err)
		}

		// Reset NextActivityDate fields for projects that have had their funds recovered
		project.NextActivityDate, _ = time.Parse("0001-01-01 00:00:00", "2020-08-31 18:27:18")
		project.Status = constants.ProjectFundsRecovered

		project, err = models.ProjectUpdateFields(project)
		if err != nil {
			log.Fatal(err)
		}

		// Send response back to backend if activities required are completed
		projectId := strconv.Itoa(project.Id)
		backendURL := "/events/blockchain/projects/" + projectId + "/" + string(constants.FailedFundRecoveryEvent)
		requestParameters := req.Param{
			"event_type":       constants.FailedFundRecoveryEvent,
			"project_id":       project.Id,
			"project_contract": project.ContractAddress,
			"status":           true,
			"funds_released":   fundsRecovered,
		}
		_, err = PostBackend(requestParameters, backendURL)
		if err != nil {
			log.Fatal(err)
			return err
		}

	}

	return nil

}
