package utils

import (
	"log"

	"github.com/pledgecamp/pledgecamp-oracle/models"
)

// CsGetState() - Get CS activity related to a user
func CsGetState(csRequest RequestCsState) (CsStateResponse, error) {

	var csState CsStateResponse
	csState.UserId = csRequest.UserId

	runningTotal := 0

	csList, err := models.GetCSByUserId(csState.UserId)
	if err != nil {
		log.Println(err)
	}

	var activitiesList []models.CSActivity
	for _, cs := range csList {
		runningTotal += cs.BalanceMovement
		partialList, _ := models.CSActivitySearchCsID(cs.CSId)
		activitiesList = append(activitiesList, partialList...)
	}

	csState.CsActivitiesList = activitiesList
	csState.CurrentBalance = runningTotal

	return csState, nil
}

