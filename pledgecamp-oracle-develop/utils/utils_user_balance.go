package utils

import (
	"log"
	"strconv"

	"github.com/imroc/req"
	"github.com/pledgecamp/pledgecamp-oracle/constants"
)

// GetBalance()
func GetBalance(balanceRequest RequestUserBalance) (int, error) {
	userId := strconv.Itoa(balanceRequest.UserId)
	activityReference := string(constants.GetBalance)

	nodeServerURL := "/manager/users/" + userId + "/" + activityReference

	// Send request to get balance to Nodeserver
	requestParameters := req.Param{
		"user_id": balanceRequest.UserId,
	}

	resp, err := GetNodeServer(requestParameters, nodeServerURL)
	if err != nil {
		log.Fatal(err)
		return 0, err
	}

	responseValue, err := strconv.Atoi(resp.String())
	if err != nil {
		return responseValue, err
	}

	// Send response back to backend if activities required are completed
	backendURL := "/events/blockchain/users/" + userId + "/" + string(constants.GetBalanceEvent) + "/"
	requestParameters = req.Param{
		"event_type": constants.GetBalanceEvent,
		"user_id":    balanceRequest.UserId,
		"status":     true,
		"balance":    responseValue,
	}
	_, err = PostBackend(requestParameters, backendURL)
	if err != nil {
		log.Fatal(err)
		return responseValue, err
	}

	return responseValue, nil

}
