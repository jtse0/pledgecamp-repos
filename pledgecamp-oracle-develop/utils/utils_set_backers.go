package utils

import (
	"database/sql"
	"encoding/json"
	"log"
	"os"
	"strconv"

	"github.com/imroc/req"
	"github.com/lib/pq"
	"github.com/pledgecamp/pledgecamp-oracle/constants"
	"github.com/pledgecamp/pledgecamp-oracle/models"
	"github.com/pledgecamp/pledgecamp-oracle/structs"
)

// SetBackers()
// TODO Add comments
func SetBackers(setBackersRequest RequestSetBackers) error {

	// Activity Definitions
	projectId := strconv.Itoa(setBackersRequest.FkProjectId)
	activityReference := string(constants.SetBackers)
	oracleCallbackURL := os.Getenv("APP_DOMAIN") + "/projects/" + projectId + "/callback/" + activityReference
	nodeServerURL := "/manager/projects/" + projectId + "/" + activityReference

	// Prepare project parameters with information from incoming request
	var projectParams = ProjectParameters{
		Backers:         pq.Int64Array(setBackersRequest.Beneficiaries),
		Amounts:         pq.Int64Array(setBackersRequest.Amounts),
		FundingComplete: setBackersRequest.FundingComplete,
	}
	var inInterface map[string]interface{}
	inrec, _ := json.Marshal(projectParams)
	json.Unmarshal(inrec, &inInterface)

	// Create project activity for tracking deployment
	projectActivity, err := models.SetProjectActivity(setBackersRequest.FkProjectId, constants.SetBackers)
	if err != nil {
		log.Fatal(err)
	}

	// Create the base project
	project, _ := models.ProjectFetchById(setBackersRequest.FkProjectId)
	if err != nil {
		log.Fatal(err)
		return err
	}

	// Pass incoming request to Nodeserver
	requestParameters := req.Param{
		"transaction_type": activityReference,
		"beneficiaries":    projectParams.Backers,
		"amounts":          projectParams.Amounts,
		"funding_complete": projectParams.FundingComplete,
		"total_amount":     setBackersRequest.TotalAmount,
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

// TODO Add comments
// SetBackersCallback()
func SetBackersCallback(transactionResponse NodeServerModel, projectActivity ProjectActivity) error {

	// Only process if Nodeserver postback response successful
	log.Printf("Project status: %v", transactionResponse.Status)

	if transactionResponse.Status == structs.Complete {

		// Update Activity status to success
		projectActivity.Status = constants.ActivitySuccess
		projectActivity.TransactionHash = sql.NullString{String: transactionResponse.Hash, Valid: true}
		_, err := models.ProjectActivityUpdateFields(projectActivity)
		if err != nil {
			log.Fatal(err)
		}

		// Update project status & completed activity
		project, err := models.ProjectFetchById(projectActivity.ProjectId)
		if err != nil {
			log.Fatal(err)
		}
		project.Status = constants.ProjectMilestonePhase
		project.ActivitiesCompleted = append(project.ActivitiesCompleted, string(constants.SetBackers))
		project, err = models.ProjectUpdateFields(project)
		if err != nil {
			log.Fatal(err)
		}

		// Create list of required activities to mark PROJECT_CREATE process as complete
		// TODO Copy this postback across all the subsequent PROJECT_CREATE events, they may complete out of order
		activitiesToComplete := [3]constants.ActivityReference{}
		activitiesToComplete[0] = constants.ProjectDeploy
		activitiesToComplete[1] = constants.SetBackers
		activitiesToComplete[2] = constants.SetProjectInfo
		activitiesCompleted := true
		for _, targetActivity := range activitiesToComplete {
			activitiesCompleted = models.CheckCompletedActivity(targetActivity, project.ActivitiesCompleted)
			if activitiesCompleted == false {
				break
			}
		}

		// Send response back to backend if activities required are completed
		if activitiesCompleted {
			projectId := strconv.Itoa(project.Id)
			backendURL := "/events/blockchain/projects/" + projectId + "/" + string(constants.ProjectComplete)
			requestParameters := req.Param{
				"event_type":       constants.ProjectComplete,
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

	}

	return nil
}
