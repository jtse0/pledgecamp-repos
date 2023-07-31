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

// PostInterest() - post interest payment for CS holders
func PostInterest(postInterestRequest RequestPostInterest) (CampShares, error) {
	activityReference := string(constants.PostInterest)

	oracleCallbackURL := os.Getenv("APP_DOMAIN") + "/cs/0/callback/" + activityReference
	nodeServerURL := "/cs/" + activityReference

	cs := models.CampShares{
		Amount: postInterestRequest.Amount,
		CSType: 4,
		CSTime: time.Now(),
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
	csActivity, err := models.SetCSActivity(csId, constants.PostInterest)
	if err != nil {
		log.Fatal(err)
	}

	// Send request to collect interest to Nodeserver
	requestParameters := req.Param{
		"transaction_type": activityReference,
		"activity_id":      csActivity.Id,
		"amount":           postInterestRequest.Amount,
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
func PostInterestCallback(transactionResponse NodeServerModel, csActivity models.CSActivity) error {

	// Only process if Nodeserver postback response successful
	log.Printf("Project status: %v", transactionResponse.Status)

	if transactionResponse.Status == structs.Complete {

		// Get the interest amount from event from Nodeserver
		var interestAmount int
		interestResultInterface := transactionResponse.TransactionEvents.([]interface{})
		log.Println("Post interest result")
		log.Println(interestResultInterface)

		for _, interests := range interestResultInterface {
			interestItem := interests.(string)
			interestAmount, _ = strconv.Atoi(interestItem)
		}

		// Update Activity status to success
		csActivity.Status = constants.ActivitySuccess
		csActivity.TransactionHash = sql.NullString{String: transactionResponse.Hash, Valid: true}
		_, err := models.CSActivityUpdateFields(csActivity)
		if err != nil {
			log.Fatal(err)
		}

		// Update project status & completed activity
		interestCS, err := models.CSSearchCSId(csActivity.CsId)
		if err != nil {
			log.Fatal(err)
		}

		// Amount reflects interest in PLG posted
		interestCS.Amount = interestAmount

		_, err = models.CSUpdateFields(interestCS)
		if err != nil {
			log.Println(err)
		}

		// Send response back to backend if activities required are completed
		backendURL := "/events/blockchain/cs/" + string(constants.PostInterestEvent) + "/"
		requestParameters := req.Param{
			"event_type":      constants.PostInterestEvent,
			"activity_id":     csActivity.Id,
			"status":          true,
			"interest_amount": interestAmount,
		}
		_, err = PostBackend(requestParameters, backendURL)
		if err != nil {
			log.Fatal(err)
			return err
		}
	}

	return nil
}
