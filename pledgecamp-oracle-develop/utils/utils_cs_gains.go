package utils

import (
	"log"
	"strconv"

	"github.com/imroc/req"
	"github.com/pledgecamp/pledgecamp-oracle/constants"
)

// CsGains()
func CsGains(gainsRequest RequestCsGains) (int, error) {
	userId := strconv.Itoa(gainsRequest.UserId)
	activityReference := string(constants.GetGains)

	nodeServerURL := "/manager/cs/" + userId + "/" + activityReference

	// Send request to get gains to Nodeserver
	requestParameters := req.Param{
		"user_id": gainsRequest.UserId,
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
	backendURL := "/events/blockchain/cs/" + userId + "/" + string(constants.GetGainsEvent) + "/"
	requestParameters = req.Param{
		"event_type": constants.GetGainsEvent,
		"user_id":    gainsRequest.UserId,
		"status":     true,
		"gains":      responseValue,
	}
	_, err = PostBackend(requestParameters, backendURL)
	if err != nil {
		log.Fatal(err)
		return responseValue, err
	}

	return responseValue, nil

}
