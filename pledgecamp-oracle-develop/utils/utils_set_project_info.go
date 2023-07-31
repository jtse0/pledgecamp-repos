package utils

import (
	"database/sql"
	"encoding/json"
	"log"
	"os"
	"reflect"
	"strconv"

	"github.com/imroc/req"
	"github.com/pledgecamp/pledgecamp-oracle/constants"
	"github.com/pledgecamp/pledgecamp-oracle/models"
	"github.com/pledgecamp/pledgecamp-oracle/structs"
)

// SetProjectInfo()
func SetProjectInfo(setInfoRequest RequestSetProjectInfo) error {

	// Activity Definitions
	projectId := strconv.Itoa(setInfoRequest.FkProjectId)
	activityReference := string(constants.SetProjectInfo)
	oracleCallbackURL := os.Getenv("APP_DOMAIN") + "/projects/" + projectId + "/callback/" + activityReference
	nodeServerURL := "/admin/projects/" + projectId + "/" + activityReference

	// Create the base project
	project, _ := models.ProjectFetchById(setInfoRequest.FkProjectId)
	if err != nil {
		log.Fatal(err)
		return err
	}
	// Prepare project parameters with information from incoming request
	var projectParams = ProjectParameters{
		FundingComplete: setInfoRequest.FundingComplete,
		Backers:         setInfoRequest.Beneficiaries,
		Amounts:         setInfoRequest.Amounts,
		ListingFee:      setInfoRequest.ListingFee,
		TotalRaised:     setInfoRequest.TotalRaised,
		TotalAmount:     setInfoRequest.TotalAmount,
	}
	milestones := project.ProjectParameters["milestones"]
	log.Println("Milestones", reflect.TypeOf(milestones))
	convertedMilestones := make([]int64, len(milestones.([]interface{})))
	for i := range milestones.([]interface{}) {
		if reflect.TypeOf(milestones.([]interface{})[i]).String() == "string" {
			milestoneInt, _ := strconv.Atoi(milestones.([]interface{})[i].(string))
			convertedMilestones[i] = int64(milestoneInt)
		} else {
			convertedMilestones[i] = int64(milestones.([]interface{})[i].(float64))
		}
	}
	projectParams.Milestones = convertedMilestones
	log.Println("ReleasePercents")
	releasePercents := project.ProjectParameters["release_percents"]
	log.Println("ReleasePercents", reflect.TypeOf(releasePercents))
	convertedRP := make([]int64, len(releasePercents.([]interface{})))
	for i := range releasePercents.([]interface{}) {
		convertedRP[i] = int64(releasePercents.([]interface{})[i].(float64))
	}
	projectParams.ReleasePercents = convertedRP
	if project.ProjectParameters["creator"] != nil {
		projectParams.Creator = int64(project.ProjectParameters["creator"].(float64))
	} else {
		log.Fatal("Creator was not defined")
	}
	var projectParamsInterface map[string]interface{}
	inrec, _ := json.Marshal(projectParams)
	json.Unmarshal(inrec, &projectParamsInterface)
	project.Status = constants.ProjectDeployed
	project.ProjectParameters = projectParamsInterface

	// Insert model into the project table for the new request
	_, err := models.ProjectUpdateFields(project)
	if err != nil {
		log.Fatal(err)
		return err
	}

	projectActivity, err := models.SetProjectActivity(setInfoRequest.FkProjectId, constants.SetProjectInfo)
	if err != nil {
		log.Fatal(err)
	}

	// Pass incoming request to Nodeserver
	requestParameters := req.Param{
		"transaction_type": activityReference,
		"contract_address": project.ContractAddress,
		"listing_fee":      setInfoRequest.ListingFee,
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

// SetProjectInfoCallback()
func SetProjectInfoCallback(transactionResponse NodeServerModel, projectActivity ProjectActivity) error {

	// Only process if Nodeserver postback response successful
	log.Printf("Project status: %v", transactionResponse.Status)

	if transactionResponse.Status == structs.Complete {
		log.Println("Inside the Set Project Info callback")

		// Update Activity record to complete
		projectActivity.Status = constants.ActivitySuccess
		projectActivity.TransactionHash = sql.NullString{String: transactionResponse.Hash, Valid: true}
		_, err := models.ProjectActivityUpdateFields(projectActivity)

		// Update project completed activity
		project, err := models.ProjectFetchById(projectActivity.ProjectId)
		if err != nil {
			log.Fatal(err)
		}
		project.ActivitiesCompleted = append(project.ActivitiesCompleted, string(constants.SetProjectInfo))
		project, err = models.ProjectUpdateFields(project)
		if err != nil {
			log.Fatal(err)
		}

		// TODO Add the activitiesCompleted Check
		// Create list of required activities to mark PROJECT_CREATE process as complete
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

		// Create request and initiate SetBackers()
		var sbReq RequestSetBackers
		sbReq.FkProjectId = project.Id
		backers := project.ProjectParameters["backers"]
		convertedBackers := make([]int64, len(backers.([]interface{})))
		for i := range backers.([]interface{}) {
			convertedBackers[i] = int64(backers.([]interface{})[i].(float64))
		}
		sbReq.Beneficiaries = convertedBackers
		amounts := project.ProjectParameters["amounts"]
		convertedAmounts := make([]int64, len(amounts.([]interface{})))
		for i := range amounts.([]interface{}) {
			convertedAmounts[i] = int64(amounts.([]interface{})[i].(float64))
		}
		sbReq.Amounts = convertedAmounts
		sbReq.FundingComplete = project.ProjectParameters["funding_complete"].(bool)
		sbReq.TotalAmount = int64(project.ProjectParameters["total_amount"].(float64))
		log.Printf("Setting Backers: %s", project.ProjectParameters["backers"])
		err = SetBackers(sbReq)
		if err != nil {
			log.Fatal(err)
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
