package utils

import (
	"database/sql"
	"encoding/json"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/imroc/req"
	"github.com/pledgecamp/pledgecamp-oracle/constants"
	"github.com/pledgecamp/pledgecamp-oracle/models"
	"github.com/pledgecamp/pledgecamp-oracle/structs"
)

// StakePLG() - submit both milestone and moderation votes
func StakePLG(stakeRequest RequestStakePLG) (CampShares, error) {
	// fmt.Printf("%+v\n", project)
	userId := strconv.Itoa(stakeRequest.UserId)
	activityReference := string(constants.StakePLG)

	nodeServerURL := "/manager/cs/" + userId + "/" + activityReference
	oracleCallbackURL := os.Getenv("APP_DOMAIN") + "/cs/" + userId + "/callback/" + activityReference

	cs := models.CampShares{
		UserId:              stakeRequest.UserId,
		Amount:              stakeRequest.Amount,
		BalanceMovement:     stakeRequest.Amount,
		CSType:              0,
		CSTime:              time.Now(),
		UnstakeCompleteDate: time.Date(1970, time.January, 1, 0, 0, 0, 0, time.UTC),
	}

	var inInterface map[string]interface{}
	inrec, _ := json.Marshal(cs)
	json.Unmarshal(inrec, &inInterface)

	latestCs, err := models.GetlatestCSId()
	if err != nil {
		log.Println(err)
	}

	csId := latestCs.CSId + 1
	if csId < 1 {
		csId = 1
	}

	cs.CSId = csId

	// Input CS transaction into CampShare model
	cs, err = models.CSInsert(cs)
	if err != nil {
		log.Fatal(err)
	}

	// Create cs activity for tracking purposes
	csActivity, err := models.SetCSActivity(csId, constants.StakePLG)
	if err != nil {
		log.Fatal(err)
	}

	// Send request to stake PLG for CS to Nodeserver
	requestParameters := req.Param{
		"transaction_type": activityReference,
		"user_id":          cs.UserId,
		"amount":           cs.Amount,
		"activity_id":      csActivity.Id,
		"url_callback":     oracleCallbackURL,
	}

	_, err = PostNodeServer(requestParameters, nodeServerURL)
	if err != nil {
		log.Fatal(err)
		return cs, err
	}

	return cs, nil
}

// Follows default callback behavior in handlers_projects
func StakePLGCallback(transactionResponse NodeServerModel, csActivity models.CSActivity) error {

	// Only process if Nodeserver postback response successful
	log.Printf("Project status: %v", transactionResponse.Status)

	if transactionResponse.Status == structs.Complete {

		// Get the stake amount from event from Nodeserver
		var stakeAmount int
		stakeResultInterface := transactionResponse.TransactionEvents.([]interface{})
		log.Println("Stake result")
		log.Println(stakeResultInterface)

		for _, stakes := range stakeResultInterface {
			stakeItem := stakes.([]interface{})
			stakeAmount, _ = strconv.Atoi(stakeItem[1].(string))
		}

		// Update Activity status to success
		csActivity.Status = constants.ActivitySuccess
		csActivity.TransactionHash = sql.NullString{String: transactionResponse.Hash, Valid: true}
		_, err := models.CSActivityUpdateFields(csActivity)
		if err != nil {
			log.Fatal(err)
		}

		// Update project status & completed activity
		cs, err := models.CSSearchCSId(csActivity.CsId)
		if err != nil {
			log.Fatal(err)
		}

		if stakeAmount != cs.Amount {
			log.Printf("Error: Stake Amount of %v did not match stake amount from blockchain: %v \n", stakeAmount, cs.Amount)
		}

		// Send response back to backend if activities required are completed
		userId := strconv.Itoa(cs.UserId)
		backendURL := "/events/blockchain/cs/" + userId + "/" + string(constants.StakePLGEvent)
		requestParameters := req.Param{
			"event_type":  constants.StakePLGEvent,
			"activity_id": csActivity.Id,
			"user_id":     cs.UserId,
			"status":      true,
			"amount":      cs.Amount,
		}
		_, err = PostBackend(requestParameters, backendURL)
		if err != nil {
			log.Fatal(err)
			return err
		}

	}

	return nil
}
