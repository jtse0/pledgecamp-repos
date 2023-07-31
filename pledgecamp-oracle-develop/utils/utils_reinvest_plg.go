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

// ReinvestPLG() - reinvest and stake interest from holding CS
func ReinvestPLG(reinvestRequest RequestReinvestPLG) (CampShares, error) {
	userId := strconv.Itoa(reinvestRequest.UserId)
	activityReference := string(constants.ReinvestPLG)

	oracleCallbackURL := os.Getenv("APP_DOMAIN") + "/cs/" + userId + "/callback/" + activityReference
	nodeServerURL := "/manager/cs/" + userId + "/" + activityReference

	cs := models.CampShares{
		UserId: reinvestRequest.UserId,
		CSType: 2,
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
	csActivity, err := models.SetCSActivity(csId, constants.ReinvestPLG)
	if err != nil {
		log.Fatal(err)
	}

	// Send request to collect interest to Nodeserver
	requestParameters := req.Param{
		"transaction_type": activityReference,
		"user_id":          cs.UserId,
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
func ReinvestPLGCallback(transactionResponse NodeServerModel, csActivity models.CSActivity) error {

	// Only process if Nodeserver postback response successful
	log.Printf("Project status: %v", transactionResponse.Status)

	if transactionResponse.Status == structs.Complete {

		// Get the interest amount from event from Nodeserver
		var interestAmount int
		reinvestResultInterface := transactionResponse.TransactionEvents.([]interface{})
		log.Println("Reinvest interest result")
		log.Println(reinvestResultInterface)

		for index, interests := range reinvestResultInterface {
			interestItem := interests.([]interface{})
			if index == 0 {
				interestAmount, _ = strconv.Atoi(interestItem[1].(string))
			}
		}

		// Update Activity status to success
		csActivity.Status = constants.ActivitySuccess
		csActivity.TransactionHash = sql.NullString{String: transactionResponse.Hash, Valid: true}
		_, err := models.CSActivityUpdateFields(csActivity)
		if err != nil {
			log.Fatal(err)
		}

		// Update project status & completed activity
		reinvestCS, err := models.CSSearchCSId(csActivity.CsId)
		if err != nil {
			log.Fatal(err)
		}

		// Amount reflects interest in PLG received
		reinvestCS.Amount = interestAmount
		// BalanceMovement reflects the amount of interest received
		reinvestCS.BalanceMovement = interestAmount

		_, err = models.CSUpdateFields(reinvestCS)
		if err != nil {
			log.Println(err)
		}

		// Send response back to backend if activities required are completed
		userId := strconv.Itoa(reinvestCS.UserId)
		backendURL := "/events/blockchain/cs/" + userId + "/" + string(constants.ReinvestPLGEvent)
		requestParameters := req.Param{
			"event_type":  constants.ReinvestPLGEvent,
			"activity_id": csActivity.Id,
			"user_id":     reinvestCS.UserId,
			"status":      true,
			"amount":      interestAmount,
		}
		_, err = PostBackend(requestParameters, backendURL)
		if err != nil {
			log.Fatal(err)
			return err
		}
	}

	return nil
}
