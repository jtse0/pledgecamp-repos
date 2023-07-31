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

// WithdrawInterest() - Withdraw accrued interest in PLG
func WithdrawInterest(withdrawRequest RequestWithdrawInterest) (CampShares, error) {
	userId := strconv.Itoa(withdrawRequest.UserId)
	activityReference := string(constants.WithdrawInterest)

	nodeServerURL := "/manager/cs/" + userId + "/" + activityReference
	oracleCallbackURL := os.Getenv("APP_DOMAIN") + "/cs/" + userId + "/callback/" + activityReference

	cs := models.CampShares{
		UserId:              withdrawRequest.UserId,
		CSType:              3,
		CSTime:              time.Now(),
		UnstakeCompleteDate: time.Now(),
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
	csActivity, err := models.SetCSActivity(csId, constants.WithdrawInterest)
	if err != nil {
		log.Fatal(err)
	}

	// Send request to withdraw PLG interest to Nodeserver
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

func WithdrawInterestCallback(transactionResponse NodeServerModel, csActivity models.CSActivity) error {

	// Only process if Nodeserver postback response successful
	log.Printf("Project status: %v", transactionResponse.Status)

	if transactionResponse.Status == structs.Complete {

		// Get the withdrawal amount from event from Nodeserver
		var withdrawalAmount int
		withdrawResultInterface := transactionResponse.TransactionEvents.([]interface{})
		log.Println("Withdraw result")
		log.Println(withdrawResultInterface)

		for _, withdrawals := range withdrawResultInterface {
			withdrawal := withdrawals.([]interface{})
			withdrawalAmount, _ = strconv.Atoi(withdrawal[1].(string))
		}

		// Update Activity status to success
		csActivity.Status = constants.ActivitySuccess
		csActivity.TransactionHash = sql.NullString{String: transactionResponse.Hash, Valid: true}
		_, err := models.CSActivityUpdateFields(csActivity)
		if err != nil {
			log.Fatal(err)
		}

		// Update project status & completed activity
		withdrawalCS, err := models.CSSearchCSId(csActivity.CsId)
		if err != nil {
			log.Fatal(err)
		}

		// Amount reflects interest in PLG received
		withdrawalCS.Amount = withdrawalAmount

		_, err = models.CSUpdateFields(withdrawalCS)
		if err != nil {
			log.Println(err)
		}

		// Send response back to backend if activities required are completed
		userId := strconv.Itoa(withdrawalCS.UserId)
		backendURL := "/events/blockchain/cs/" + userId + "/" + string(constants.WithdrawInterestEvent) + "/"
		requestParameters := req.Param{
			"event_type":  constants.WithdrawInterestEvent,
			"activity_id": csActivity.Id,
			"user_id":     withdrawalCS.UserId,
			"status":      true,
			"amount":      withdrawalAmount,
		}
		_, err = PostBackend(requestParameters, backendURL)
		if err != nil {
			log.Fatal(err)
			return err
		}
	}

	return nil
}
