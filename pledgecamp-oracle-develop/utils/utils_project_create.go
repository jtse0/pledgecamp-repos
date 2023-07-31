package utils

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/imroc/req"
	"github.com/lib/pq"
	"github.com/pledgecamp/pledgecamp-oracle/constants"
	"github.com/pledgecamp/pledgecamp-oracle/models"
	"github.com/pledgecamp/pledgecamp-oracle/structs"
)

// ProjectCreate()
func ProjectCreate(projectRequest RequestProjectCreate) (Project, error) {

	// Check whether the Project already exists
	existingProject, _ := models.ProjectFetchById(projectRequest.ProjectId)
	if existingProject.Id != 0 {
		return existingProject, errors.New("Project already exists")
	}

	// Activity Definitions
	projectId := strconv.Itoa(projectRequest.ProjectId)
	activityReference := string(constants.ProjectDeploy)
	oracleCallbackURL := os.Getenv("APP_DOMAIN") + "/projects/" + projectId + "/callback/" + activityReference
	nodeServerURL := "/projects/" + projectId

	// Prepare project parameters with information from incoming request
	var projectParams = ProjectParameters{
		Milestones:      pq.Int64Array(projectRequest.Milestones),
		ReleasePercents: pq.Int64Array(projectRequest.ReleasePercents),
		Creator:         projectRequest.Creator,
	}
	var projectParamsInterface map[string]interface{}
	inrec, _ := json.Marshal(projectParams)
	json.Unmarshal(inrec, &projectParamsInterface)

	// Create the base project
	project := models.Project{
		Id:                projectRequest.ProjectId,
		CreatedAt:         time.Now(),
		Status:            constants.ProjectInactive,
		NextActivityDate:  time.Unix(projectParams.Milestones[0]/1000, 0),
		ProjectParameters: projectParamsInterface,
	}

	// Insert model into the project table for the new request
	projectEntity, err := models.ProjectInsert(project)
	if err != nil {
		log.Fatal(err)
		return project, err
	}

	fmt.Printf("Inserting project: %v", projectEntity)

	// Create project activity for tracking deployment
	projectActivity, err := models.SetProjectActivity(projectRequest.ProjectId, constants.ProjectDeploy)
	if err != nil {
		log.Fatal(err)
	}

	// Pass incoming request to Nodeserver
	requestParameters := req.Param{
		"transaction_type": constants.ProjectDeploy,
		"project_id":       projectRequest.ProjectId,
		"activity_id":      projectActivity.Id,
		"milestone_times":  projectRequest.Milestones,
		"release_percents": projectRequest.ReleasePercents,
		"url_callback":     oracleCallbackURL,
	}

	_, err = PostNodeServer(requestParameters, nodeServerURL)
	if err != nil {
		log.Fatal(err)
		return project, err
	}

	// TODO If error with node posting, set activity to failed status?
	return project, nil

}

// ProjectCreateCallback()
func ProjectCreateCallback(transactionResponse NodeServerModel, projectActivity ProjectActivity) error {
	//transactionStatus := string(transactionResponse.TransactionStatus)

	// Only process if Nodeserver postback response successful
	log.Printf("Project status: %v", transactionResponse.Status)

	if transactionResponse.Status == structs.Complete {

		// Update new contract address from Nodeserver
		newProjectAddress := ""
		contractInterface := transactionResponse.TransactionEvents.([]interface{})
		log.Println("Contract result")
		log.Println(contractInterface)

		for _, address := range contractInterface {
			newProjectAddress = address.(string)
		}

		log.Printf("Project deployed: %s", newProjectAddress)

		// Update Activity status to success
		projectActivity.Status = constants.ActivitySuccess
		projectActivity.TransactionHash = sql.NullString{String: transactionResponse.Hash, Valid: true}
		_, err := models.ProjectActivityUpdateFields(projectActivity)

		// Update project status, created contract address, & completed activity
		project, err := models.ProjectFetchById(projectActivity.ProjectId)
		if err != nil {
			log.Fatal(err)
		}
		project.Status = constants.ProjectDeployed
		project.ContractAddress = newProjectAddress
		project.ActivitiesCompleted = append(project.ActivitiesCompleted, string(constants.ProjectDeploy))
		project, err = models.ProjectUpdateFields(project)
		if err != nil {
			log.Fatal(err)
		}

		// Send response back to backend if activities required are completed
		projectId := strconv.Itoa(project.Id)
		backendURL := "/events/blockchain/projects/" + projectId + "/" + string(constants.ProjectCreate)
		requestParameters := req.Param{
			"event_type":       constants.ProjectCreate,
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
