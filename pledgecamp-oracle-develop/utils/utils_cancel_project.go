package utils

import (
	"database/sql"
	"log"
	"os"
	"strconv"

	"github.com/imroc/req"
	"github.com/lib/pq"
	"github.com/pledgecamp/pledgecamp-oracle/constants"
	"github.com/pledgecamp/pledgecamp-oracle/models"
	"github.com/pledgecamp/pledgecamp-oracle/structs"
)

// CheckMilestones
func CancelProject(cancelRequest RequestCancelProject) error {
	projectId := strconv.Itoa(cancelRequest.FkProjectId)
	activityReference := string(constants.CancelProject)

	oracleCallbackURL := os.Getenv("APP_DOMAIN") + "/projects/" + projectId + "/callback/" + activityReference
	nodeServerURL := "/moderator/projects/" + projectId + "/" + activityReference

	// Create project activity for tracking purposes
	projectActivity, err := models.SetProjectActivity(cancelRequest.FkProjectId, constants.CancelProject)
	if err != nil {
		log.Fatal(err)
	}

	// Get project information
	project, _ := models.ProjectFetchById(cancelRequest.FkProjectId)
	if err != nil {
		log.Fatal(err)
		return err
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

func CancelProjectCallback(transactionResponse NodeServerModel, projectActivity ProjectActivity) error {

	// Only process if Nodeserver postback response successful
	log.Printf("Project status: %v", transactionResponse.Status)

	if transactionResponse.Status == structs.Complete {

		// Update status depending on the milestone result event from Nodeserver
		var cancelResult bool
		cancelResultInterface := transactionResponse.TransactionEvents.([]interface{})
		log.Println("Cancel result")
		log.Println(cancelResultInterface)

		cancelResult, _ = cancelResultInterface[1].(bool)
		log.Println(cancelResult)

		// Update Activity status to success
		projectActivity.Status = constants.ActivitySuccess
		projectActivity.TransactionHash = sql.NullString{String: transactionResponse.Hash, Valid: true}
		_, err := models.ProjectActivityUpdateFields(projectActivity)
		if err != nil {
			log.Fatal(err)
		}

		var activitiesCompletedList pq.StringArray

		// Update project status & completed activity
		project, err := models.ProjectFetchById(projectActivity.ProjectId)
		if err != nil {
			log.Fatal(err)
		}

		// Update status for cancelled projects
		log.Println(transactionResponse)
		switch cancelResult {
		case true:

			project.Status = constants.ProjectCancelled
			project.ActivitiesCompleted = append(project.ActivitiesCompleted, string(constants.CancelProject))
			project, err = models.ProjectUpdateFields(project)
			if err != nil {
				log.Fatal(err)
			}

			activitiesCompletedList = project.ActivitiesCompleted

		case false:

			project.Status = constants.ProjectMilestonePhase
			project.ActivitiesCompleted = append(project.ActivitiesCompleted, string(constants.CancelProject))
			project, err = models.ProjectUpdateFields(project)
			if err != nil {
				log.Fatal(err)
			}

			activitiesCompletedList = project.ActivitiesCompleted

		}

		// Create list of required activities to mark PROJECT_END_MODERATION process as complete
		activitiesToComplete := [2]constants.ActivityReference{}
		activitiesToComplete[0] = constants.CommitFinalVotes
		activitiesToComplete[1] = constants.CancelProject
		activitiesCompleted := true
		for _, targetActivity := range activitiesToComplete {
			activitiesCompleted = models.CheckCompletedActivity(targetActivity, activitiesCompletedList)
			if activitiesCompleted == false {
				break
			}
		}

		// Send response back to backend if activities required are completed
		if activitiesCompleted {
			projectId := strconv.Itoa(project.Id)
			backendURL := "/events/blockchain/projects/" + projectId + "/" + string(constants.EndModeration)
			requestParameters := req.Param{
				"event_type":       constants.EndModeration,
				"project_id":       project.Id,
				"project_contract": project.ContractAddress,
				"status":           true,
				"result":           cancelResult,
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
