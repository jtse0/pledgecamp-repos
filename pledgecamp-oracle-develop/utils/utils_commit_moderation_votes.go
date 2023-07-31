package utils

import (
	"database/sql"
	"errors"
	"log"
	"os"
	"strconv"

	"github.com/imroc/req"
	"github.com/pledgecamp/pledgecamp-oracle/constants"
	"github.com/pledgecamp/pledgecamp-oracle/models"
	"github.com/pledgecamp/pledgecamp-oracle/structs"
)

// CommitModerationVotes
func CommitModerationVotes(commitRequest RequestCommitModerationVotes) error {
	projectId := strconv.Itoa(commitRequest.FkProjectId)
	activityReference := string(constants.CommitFinalVotes)

	nodeServerURL := "/moderator/projects/" + projectId + "/" + activityReference
	oracleCallbackURL := os.Getenv("APP_DOMAIN") + "/projects/" + projectId + "/callback/" + activityReference

	// Create project activity for tracking purposes
	projectActivity, err := models.SetProjectActivity(commitRequest.FkProjectId, constants.CommitFinalVotes)
	if err != nil {
		log.Fatal(err)
	}

	// Get project information
	project, _ := models.ProjectFetchById(commitRequest.FkProjectId)
	if err != nil {
		log.Fatal(err)
		return err
	}

	if len(commitRequest.EncryptedVotes) >= 7 {

		projectVotes, _ := models.VoteSearchProjectId(commitRequest.FkProjectId)
		decryptionKeys := make([]string, len(projectVotes))
		finalVotes := make([]bool, len(projectVotes))
		userIds := make([]int, len(projectVotes))

		for i := 0; i < len(projectVotes); i++ {
			currentVote := projectVotes[i]
			log.Println(currentVote)
			if int64(currentVote.VoteParameters["vote_type"].(float64)) == 1 {
				finalVotes[i] = currentVote.VoteParameters["vote"].(bool)
				decryptionKeys[i] = currentVote.VoteParameters["decryption_key"].(string)
				userIds[i] = currentVote.UserId
			}
		}

		// Get parameters from the above structs
		requestParameters := req.Param{
			"transaction_type": activityReference,
			"votes":            finalVotes,
			"decryption_keys":  decryptionKeys,
			"user_ids":         userIds,
			"contract_address": project.ContractAddress,
			"project_id":       commitRequest.FkProjectId,
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

	err = errors.New("There are not enough votes to commit")
	return err
}

func CommitModerationVotesCallback(transactionResponse NodeServerModel, projectActivity ProjectActivity) error {
	//transactionStatus := string(transactionResponse.TransactionStatus)

	// Only process if Nodeserver postback response successful
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
		project.Status = constants.ProjectReadyToCancel
		project.ActivitiesCompleted = append(project.ActivitiesCompleted, string(constants.CommitFinalVotes))
		project, err = models.ProjectUpdateFields(project)
		if err != nil {
			log.Fatal(err)
		}

		// Create request and initiate CancelProject()
		var cpReq RequestCancelProject
		cpReq.FkProjectId = project.Id
		err = CancelProject(cpReq)
		if err != nil {
			log.Fatal(err)
		}
	}

	return nil
}
