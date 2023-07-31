package utils

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/imroc/req"
	"github.com/pledgecamp/pledgecamp-oracle/constants"
	"github.com/pledgecamp/pledgecamp-oracle/models"
	"github.com/pledgecamp/pledgecamp-oracle/structs"
)

func UnstakePLG(unstakeRequest RequestUnstakePLG) (CampShares, error) {
	// fmt.Printf("%+v\n", project)
	userId := strconv.Itoa(unstakeRequest.UserId)
	activityReference := string(constants.UnstakePLG)

	oracleCallbackURL := os.Getenv("APP_DOMAIN") + "/cs/" + userId + "/callback/" + activityReference
	nodeServerURL := "/manager/cs/" + userId + "/" + activityReference

	cs := models.CampShares{
		UserId:          unstakeRequest.UserId,
		BalanceMovement: 0,
		CSType:          1,
		CSTime:          time.Now(),
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

	// Set unstake complete date
	unstakePeriod := os.Getenv("CS_UNSTAKE_PERIOD")
	unstakePeriodInt, err := strconv.Atoi(unstakePeriod)
	if err != nil {
		fmt.Println("Error occurred with converting Interest Interval: " + unstakePeriod)
	}
	cs.UnstakeCompleteDate = time.Now().Add(time.Second * time.Duration(unstakePeriodInt))

	// Input CS transaction into CampShare model
	_, err = models.CSInsert(cs)
	if err != nil {
		log.Fatal(err)
	}

	// Create cs activity for tracking purposes
	csActivity, err := models.SetCSActivity(csId, constants.UnstakePLG)
	if err != nil {
		log.Fatal(err)
	}

	// Send request to unstake PLG for CS to Nodeserver
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

func UnstakePLGCallback(transactionResponse NodeServerModel, csActivity models.CSActivity) error {

	// Only process if Nodeserver postback response successful
	log.Printf("Project status: %v", transactionResponse.Status)

	if transactionResponse.Status == structs.Complete {

		// Get the unstake amount from event from Nodeserver
		var unstakeAmount int
		unstakeResultInterface := transactionResponse.TransactionEvents.([]interface{})
		log.Println("Unstake result")
		log.Println(unstakeResultInterface)

		for _, unstakes := range unstakeResultInterface {
			unstakeItem := unstakes.([]interface{})
			unstakeAmount, _ = strconv.Atoi(unstakeItem[1].(string))
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

		// Amount reflects unstake movement in DB table
		cs.Amount = unstakeAmount
		cs.BalanceMovement = -unstakeAmount

		_, err = models.CSUpdateFields(cs)
		if err != nil {
			log.Println(err)
		}

		// Send response back to backend if activities required are completed
		userId := strconv.Itoa(cs.UserId)
		backendURL := "/events/blockchain/cs/" + userId + "/" + string(constants.UnstakePLGEvent)
		requestParameters := req.Param{
			"event_type":  constants.UnstakePLGEvent,
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
