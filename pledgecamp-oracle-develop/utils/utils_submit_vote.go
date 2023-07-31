package utils

import (
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log"
	"math/big"
	"os"
	"strconv"
	"time"

	"github.com/imroc/req"
	solsha3 "github.com/miguelmota/go-solidity-sha3"
	"github.com/pledgecamp/pledgecamp-oracle/constants"
	"github.com/pledgecamp/pledgecamp-oracle/models"
	"github.com/pledgecamp/pledgecamp-oracle/structs"
)

// TODO Split this vote in to moderation vote / milestone vote workflows but, have vote encryption as utility
// SubmitVote() - submit both milestone and moderation votes
func SubmitVote(votingRequest RequestVote) (Vote, error) {

	// Activity Definitions
	var activityType constants.ActivityReference
	var activityReference string
	var vote Vote

	switch votingRequest.VoteType {
	case 0: // Milestone Votes
		activityType = constants.MilestoneVote
		activityReference = string(constants.MilestoneVote)
	case 1: // Moderation Votes
		activityType = constants.ModerationVote
		activityReference = string(constants.ModerationVote)
	default:
		log.Fatal(err)
		return vote, err
	}

	projectId := strconv.Itoa(votingRequest.FkProjectId)
	userId := strconv.Itoa(votingRequest.UserId)
	oracleCallbackURL := os.Getenv("APP_DOMAIN") + "/projects/" + projectId + "/callback/" + activityReference
	nodeServerUrl := "/manager/projects/" + projectId + "/" + activityReference + "/" + userId

	// Create project activity for tracking purposes
	projectActivity, err := models.SetProjectActivity(votingRequest.FkProjectId, activityType)
	if err != nil {
		log.Fatal(err)
		return vote, err
	}

	// Create the base project
	project, err := models.ProjectFetchById(votingRequest.FkProjectId)
	if err != nil {
		log.Fatal(err)
		return vote, err
	}

	var votingParams VotingParameters
	var encryptedVote string

	if votingRequest.VoteType == 1 {
		// Encryption

		firstParam := new(big.Int)
		firstParam.SetString(projectId, 10)
		secondParam := new(big.Int)
		secondParam.SetString(userId, 10)
		thirdParam := votingRequest.DecryptionKey
		fourthParam := votingRequest.Vote

		argCombined := solsha3.SoliditySHA3(
			// types
			[]string{"uint256", "uint256", "bytes32", "bool"},
			// values
			[]interface{}{
				firstParam,
				secondParam,
				thirdParam,
				fourthParam,
			},
		)
		log.Println("Encryption complete")
		encryptedVote = "0x" + hex.EncodeToString(argCombined)
		log.Println(encryptedVote)
		votingParams.EncryptedVote = encryptedVote

		// Create the base project
		votingParams.Vote = votingRequest.Vote
		votingParams.VoteType = votingRequest.VoteType
		votingParams.DecryptionKey = votingRequest.DecryptionKey
		var inInterface map[string]interface{}
		inrec, _ := json.Marshal(votingParams)
		json.Unmarshal(inrec, &inInterface)

		vote.VoteTime = time.Now()
		vote.UserId = votingRequest.UserId
		vote.ContractAddress = project.ContractAddress
		vote.FkProjectId = votingRequest.FkProjectId
		vote.VoteParameters = inInterface

		// Save the model
		vote, err = models.VoteInsert(vote)
		log.Print("Inside utils_submit_vote")
		log.Print(vote)
		if err != nil {
			log.Fatal(err)
			return vote, err
		}

	}

	// Detect path based on the VoteType
	switch votingRequest.VoteType {
	case 0: // Milestone Votes
		requestParameters := req.Param{
			"transaction_type": activityReference,
			"contract_address": project.ContractAddress,
			"user_id":          votingRequest.UserId,
			"vote":             votingRequest.Vote,
			"activity_id":      projectActivity.Id,
			"url_callback":     oracleCallbackURL,
		}

		_, err = PostNodeServer(requestParameters, nodeServerUrl)
		if err != nil {
			log.Fatal(err)
			return vote, err
		}
	case 1: // Cancellation Votes

		requestParameters := req.Param{
			"transaction_type": activityReference,
			"contract_address": project.ContractAddress,
			"user_id":          votingRequest.UserId,
			"encrypted_vote":   encryptedVote,
			"activity_id":      projectActivity.Id,
			"url_callback":     oracleCallbackURL,
		}

		_, err = PostNodeServer(requestParameters, nodeServerUrl)
		if err != nil {
			log.Fatal(err)
			return vote, err
		}
	default:
		err = errors.New("Error relating to vote type")
		log.Fatal(err)
		return vote, err
	}

	// Create project activity for tracking deployment
	switch votingRequest.VoteType {
	case 0: // Milestone Votes
		projectActivity.ProjectId = votingRequest.FkProjectId
		projectActivity.CreatedAt = time.Now()
		projectActivity.ModifiedAt = time.Now()
		projectActivity.Type = constants.MilestoneVote
	case 1: // Moderation Votes
		projectActivity.ProjectId = votingRequest.FkProjectId
		projectActivity.CreatedAt = time.Now()
		projectActivity.ModifiedAt = time.Now()
		projectActivity.Type = constants.ModerationVote
	default:
		log.Fatal(err)
	}

	projectActivity, err = models.ProjectActivityInsert(projectActivity)
	if err != nil {
		log.Fatal(err)
	}

	return vote, nil
}

func VoteCallback(transactionResponse NodeServerModel, projectActivity ProjectActivity) error {

	// Only process if Nodeserver postback response successful
	log.Printf("Project status: %v", transactionResponse.Status)

	if transactionResponse.Status == structs.Complete {

		// Update Activity status to success
		projectActivity.Status = constants.ActivitySuccess
		projectActivity.TransactionHash = sql.NullString{String: transactionResponse.Hash, Valid: true}
		_, err := models.ProjectActivityUpdateFields(projectActivity)
		if err != nil {
			log.Fatal(err)
			return err
		}

		var beneficiary int
		var voteBool bool
		var voteEncrypted string

		if projectActivity.Type == constants.MilestoneVote {
			log.Println("Milestone Vote Transaction Events:")
			voteInterface := transactionResponse.TransactionEvents.([]interface{})
			log.Println(voteInterface)
			for _, vote := range voteInterface {
				voteItem := vote.([]interface{})
				log.Println(vote)
				beneficiary, _ = strconv.Atoi(voteItem[0].(string))
				log.Println(beneficiary)
				voteBool, _ = voteItem[1].(bool)
				log.Println(voteBool)
			}
		} else if projectActivity.Type == constants.ModerationVote {
			log.Println("Moderation Vote Transaction Events:")
			voteInterface := transactionResponse.TransactionEvents.([]interface{})
			log.Println(voteInterface)
			for _, vote := range voteInterface {
				voteItem := vote.([]interface{})
				log.Println(vote)
				beneficiary, _ = strconv.Atoi(voteItem[1].(string))
				log.Println(beneficiary)
				voteEncrypted, _ = voteItem[2].(string)
				log.Println(voteEncrypted)
			}
		}

		// Prepare project parameters with information from incoming request
		var voteParams models.VoteParameters
		voteParams.Vote = voteBool
		if projectActivity.Type == constants.MilestoneVote {
			voteParams.VoteType = 0
		} else {
			voteParams.VoteType = 1
		}

		var voteParamsInterface map[string]interface{}
		inrec, _ := json.Marshal(voteParams)
		json.Unmarshal(inrec, &voteParamsInterface)

		var voteInfo Vote
		voteInfo.ContractAddress = transactionResponse.ContractAddress
		voteInfo.VoteTime = time.Now()
		voteInfo.UserId = beneficiary
		voteInfo.FkProjectId = projectActivity.ProjectId
		voteInfo.VoteParameters = voteParamsInterface

		_, err = models.VoteInsert(voteInfo)
		if err != nil {
			log.Fatal(err)
			return err
		}

		projectId := strconv.Itoa(voteInfo.FkProjectId)

		if projectActivity.Type == constants.MilestoneVote {
			backendURL := "/events/blockchain/projects/" + projectId + "/" + string(constants.MilestoneVoteEvent)
			requestParameters := req.Param{
				"event_type":       constants.MilestoneVoteEvent,
				"project_id":       voteInfo.FkProjectId,
				"user_id":          voteInfo.UserId,
				"project_contract": voteInfo.ContractAddress,
				"status":           true,
				"vote":             voteBool,
			}
			_, err = PostBackend(requestParameters, backendURL)
			if err != nil {
				log.Fatal(err)
				return err
			}
		} else {
			backendURL := "/events/blockchain/projects/" + projectId + "/" + string(constants.ModerationVoteEvent)
			requestParameters := req.Param{
				"event_type":       constants.ModerationVoteEvent,
				"project_id":       voteInfo.FkProjectId,
				"user_id":          voteInfo.UserId,
				"project_contract": voteInfo.ContractAddress,
				"status":           true,
				"vote":             voteEncrypted,
			}
			_, err = PostBackend(requestParameters, backendURL)
			if err != nil {
				log.Fatal(err)
				return err
			}
		}

		if projectActivity.Type == constants.ModerationVote {

			votes, err := models.VoteSearchProjectIdVoteType(voteInfo.FkProjectId, 1)
			if err != nil {
				log.Fatal(err)
				return err
			}

			var requestCommitVotes RequestCommitModerationVotes
			var encryptedVotes []string
			var decryptionKey []string

			if len(votes) >= 7 {
				for _, vote := range votes {
					log.Println(vote.VoteParameters["vote_type"].(float64))
					encryptedVotes = append(encryptedVotes, vote.VoteParameters["encrypted_vote"].(string))
					decryptionKey = append(decryptionKey, vote.VoteParameters["decryption_key"].(string))
					log.Println(requestCommitVotes)
				}

				requestCommitVotes.FkProjectId = voteInfo.FkProjectId
				requestCommitVotes.EncryptedVotes = encryptedVotes
				requestCommitVotes.DecryptionKeys = decryptionKey

				err := CommitModerationVotes(requestCommitVotes)
				if err != nil {
					log.Printf("An error was returned: %d", err)
				}

			}

		}
	}

	return nil
}
