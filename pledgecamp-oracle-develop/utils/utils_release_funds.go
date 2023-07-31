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

// ReleaseFunds
func ReleaseFunds(releaseRequest RequestReleaseFunds) error {

	// Activity Definitions
	projectId := strconv.Itoa(releaseRequest.FkProjectId)
	var activityType constants.ActivityReference
	if releaseRequest.TransactionType == string(constants.WithdrawFunds) {
		activityType = constants.WithdrawFunds
	} else if releaseRequest.TransactionType == string(constants.RequestRefund) {
		activityType = constants.RequestRefund
	}

	activityReference := string(activityType)
	nodeServerURL := "/manager/projects/" + projectId + "/" + activityReference
	oracleCallbackURL := os.Getenv("APP_DOMAIN") + "/projects/" + projectId + "/callback/" + activityReference

	// Get project information
	project, _ := models.ProjectFetchById(releaseRequest.FkProjectId)
	if err != nil {
		log.Fatal(err)
		return err
	}

	projectActivity, err := models.SetProjectActivity(releaseRequest.FkProjectId, activityType)
	if err != nil {
		log.Fatal(err)
	}

	// Get parameters from the above structs
	requestParameters := req.Param{
		"transaction_type": activityReference,
		"contract_address": project.ContractAddress,
		"user_id":          releaseRequest.UserId,
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

// WithdrawFundsCallback()
func WithdrawFundsCallback(transactionResponse NodeServerModel, projectActivity ProjectActivity) error {

	// Only process if Nodeserver postback response successful
	log.Printf("Project status: %v", transactionResponse.Status)

	if transactionResponse.Status == structs.Complete {

		// Update withdrawal amount from Nodeserver
		withdrawalAmount := 0
		withdrawalInterface := transactionResponse.TransactionEvents.([]interface{})
		log.Println("Withdrawal result")
		log.Println(withdrawalInterface)

		for _, funds := range withdrawalInterface {
			withdrawalAmount := funds.(string)
			log.Println(withdrawalAmount)
		}

		// Update Activity status to success
		projectActivity.Status = constants.ActivitySuccess
		projectActivity.TransactionHash = sql.NullString{String: transactionResponse.Hash, Valid: true}
		_, err := models.ProjectActivityUpdateFields(projectActivity)
		if err != nil {
			log.Fatal(err)
		}

		// Update project completed activity
		project, err := models.ProjectFetchById(projectActivity.ProjectId)
		if err != nil {
			log.Fatal(err)
		}

		// Send response back to backend if activities required are completed
		if project.Status == constants.ProjectMilestoneSuccess {

			project.Status = constants.ProjectEnded
			project, err = models.ProjectUpdateFields(project)
			if err != nil {
				log.Fatal(err)
				return err
			}

			projectId := strconv.Itoa(project.Id)
			backendURL := "/events/blockchain/projects/" + projectId + "/" + string(constants.FundWithdrawal)
			// TODO: Funds released
			requestParameters := req.Param{
				"event_type":       constants.FundWithdrawal,
				"project_id":       project.Id,
				"project_contract": project.ContractAddress,
				"status":           true,
				"funds_released":   withdrawalAmount,
			}
			_, err = PostBackend(requestParameters, backendURL)
			if err != nil {
				log.Fatal(err)
				return err
			}
		}

	}

	return nil
}

// RequestRefundCallback()
func RequestRefundCallback(transactionResponse NodeServerModel, projectActivity ProjectActivity) error {

	// TODO Use constants map
	// Only process if Nodeserver postback response successful
	if transactionResponse.Status == 2 {

		// Update refund amount from Nodeserver
		refundAmount := 0
		refundInterface := transactionResponse.TransactionEvents.([]interface{})
		log.Println("Refund result")
		log.Println(refundInterface)

		for _, funds := range refundInterface {
			fundItem := funds.([]interface{})
			log.Println(funds)
			refundAmount, _ = strconv.Atoi(fundItem[0].(string))
			log.Println(refundAmount)
		}

		// Update Activity status to success
		projectActivity.Status = constants.ActivitySuccess
		projectActivity.TransactionHash = sql.NullString{String: transactionResponse.Hash, Valid: true}
		_, err := models.ProjectActivityUpdateFields(projectActivity)
		if err != nil {
			log.Fatal(err)
		}

		// Update project completed activity
		project, err := models.ProjectFetchById(projectActivity.ProjectId)
		if err != nil {
			log.Fatal(err)
		}

		// Send response back to backend if activities required are completed
		if project.Status == constants.ProjectMilestoneFailed {

			project.Status = constants.ProjectFailed
			project, err = models.ProjectUpdateFields(project)
			if err != nil {
				log.Fatal(err)
				return err
			}

			projectId := strconv.Itoa(project.Id)
			backendURL := "/events/blockchain/projects/" + projectId + "/" + string(constants.FundWithdrawal)
			// TODO: Funds released
			requestParameters := req.Param{
				"event_type":       constants.FundWithdrawal,
				"project_id":       project.Id,
				"project_contract": project.ContractAddress,
				"status":           true,
				"funds_released":   refundAmount,
			}
			_, err = PostBackend(requestParameters, backendURL)
			if err != nil {
				log.Fatal(err)
				return err
			}
		}
	}

	return nil

}
