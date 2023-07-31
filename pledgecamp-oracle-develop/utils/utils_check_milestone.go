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

// CheckMilestones
func CheckMilestones(milestoneRequest RequestCheckMilestones) error {
	projectId := strconv.Itoa(milestoneRequest.FkProjectId)
	activityReference := string(constants.CheckMilestone)
	oracleCallbackURL := os.Getenv("APP_DOMAIN") + "/projects/" + projectId + "/callback/" + activityReference
	nodeServerURL := "/projects/" + projectId + "/" + activityReference

	projectActivity, err := models.SetProjectActivity(milestoneRequest.FkProjectId, constants.CheckMilestone)
	if err != nil {
		log.Fatal(err)
	}

	// Get project information
	project, _ := models.ProjectFetchById(milestoneRequest.FkProjectId)
	if err != nil {
		log.Fatal(err)
		return err
	}

	milestones := project.ProjectParameters["milestones"]
	convertedMilestones := make([]int64, len(milestones.([]interface{})))
	for i := range milestones.([]interface{}) {
		convertedMilestones[i] = int64(milestones.([]interface{})[i].(float64))
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

func CheckMilestoneCallback(transactionResponse NodeServerModel, projectActivity ProjectActivity) error {

	// Only process if Nodeserver postback response successful
	log.Printf("Project status: %v", transactionResponse.Status)

	if transactionResponse.Status == structs.Complete {

		// Update project status & completed activity
		project, err := models.ProjectFetchById(projectActivity.ProjectId)
		if err != nil {
			log.Fatal(err)
		}

		// Update status depending on the milestone result event from Nodeserver
		var milestoneResult bool
		milestoneResultInterface := transactionResponse.TransactionEvents.([]interface{})
		log.Println("Coming from nodeserver")
		log.Println(milestoneResultInterface)
		for _, item := range milestoneResultInterface {
			milestoneItem := item.([]interface{})
			log.Println(item)
			milestoneResult, _ = milestoneItem[1].(bool)
			log.Println(milestoneResult)
		}

		switch milestoneResult {
		// If success_result == true then notify backend
		case true:

			// Update Activity status to success
			projectActivity.Status = constants.ActivitySuccess
			projectActivity.TransactionHash = sql.NullString{String: transactionResponse.Hash, Valid: true}
			_, err := models.ProjectActivityUpdateFields(projectActivity)
			if err != nil {
				log.Fatal(err)
			}

			var withdrawRequest RequestReleaseFunds
			withdrawRequest.TransactionType = string(constants.WithdrawFunds)
			withdrawRequest.FkProjectId = project.Id
			withdrawRequest.UserId = int(project.ProjectParameters["creator"].(float64))

			// Handling to update next_activity_date
			filled := false
			milestones := project.ProjectParameters["milestones"]
			convertedMilestones := make([]int64, len(milestones.([]interface{})))
			for i := range milestones.([]interface{}) {
				convertedMilestones[i] = int64(milestones.([]interface{})[i].(float64))
			}

			// Loop through to find the next milestone
			for _, milestone := range convertedMilestones {
				if milestone > time.Now().Unix() && filled == false {
					newProject := project
					milestoneTime := time.Unix(milestone, 0)
					newProject.NextActivityDate = milestoneTime
					project, err = models.ProjectUpdateFields(newProject)
					filled = true
					if err != nil {
						log.Fatal(err)
						return err
					}
				}
			}

			// If we have already hit the final milestone, mark as complete
			if filled == false {
				lastArrayItem := len(convertedMilestones) - 1
				epochLastDate := convertedMilestones[lastArrayItem]
				lastMilestoneDate := time.Unix(epochLastDate, 0)
				if len(convertedMilestones) == 1 { // For cases where there is only 1 milestone
					project.CompletedAt = time.Now()
					project.Status = constants.ProjectMilestoneSuccess
					project, err = models.ProjectUpdateFields(project)
					if err != nil {
						log.Fatal(err)
						return err
					}
				} else if lastMilestoneDate.Format("2020-08-31") == (project.NextActivityDate).Format("2020-08-31") { // For cases with multiple milestones
					project.CompletedAt = time.Now()
					project.Status = constants.ProjectMilestoneSuccess
					project, err = models.ProjectUpdateFields(project)
					if err != nil {
						log.Fatal(err)
						return err
					}
				} else {
					log.Fatal("Something went wrong with the milestone checking")
				}
			}

			projectId := strconv.Itoa(project.Id)
			backendURL := "/events/blockchain/projects/" + projectId + "/" + string(constants.MilestoneRelease)
			requestParameters := req.Param{
				"event_type":       constants.MilestoneRelease,
				"project_id":       project.Id,
				"project_contract": project.ContractAddress,
				"status":           true,
			}
			_, err = PostBackend(requestParameters, backendURL)
			if err != nil {
				log.Fatal(err)
			}

		// If success_result == false then change project.Status => 2 (Milestone Failed)
		case false:
			// Update status of project
			project.Status = constants.ProjectMilestoneFailed
			project, err = models.ProjectUpdateFields(project)
			if err != nil {
				log.Fatal(err)
				return err
			}

			// Update Activity status to success
			projectActivity.Status = constants.ActivitySuccess
			projectActivity.TransactionHash = sql.NullString{String: transactionResponse.Hash, Valid: true}
			_, err := models.ProjectActivityUpdateFields(projectActivity)
			if err != nil {
				log.Fatal(err)
			}

			backers := project.ProjectParameters["backers"]
			convertedBackers := make([]int, len(backers.([]interface{})))
			for i := range backers.([]interface{}) {
				convertedBackers[i] = int(backers.([]interface{})[i].(float64))
			}

			log.Println("Distributing refunds")
			for _, backer := range convertedBackers {
				var refundRequest RequestReleaseFunds
				refundRequest.TransactionType = string(constants.RequestRefund)
				refundRequest.FkProjectId = project.Id
				refundRequest.UserId = backer

				err = ReleaseFunds(refundRequest)
				if err != nil {
					log.Fatal(err)
				}
			}

			projectId := strconv.Itoa(project.Id)
			backendURL := "/events/blockchain/projects/" + projectId + "/" + string(constants.MilestoneRelease)
			requestParameters := req.Param{
				"event_type":       constants.MilestoneRelease,
				"project_id":       project.Id,
				"project_contract": project.ContractAddress,
				"status":           false,
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
