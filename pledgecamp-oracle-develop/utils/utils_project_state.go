package utils

import (
	"log"

	"github.com/pledgecamp/pledgecamp-oracle/models"
)

// ProjectGetState()
func ProjectGetState(projectRequest RequestProjectState) (ProjectStateResponse, error) {

	var projectState models.ProjectStateResponse
	projectState.ProjectId = projectRequest.ProjectId

	// Check whether the Project already exists
	project, err := models.ProjectFetchById(projectRequest.ProjectId)
	if err != nil {
		log.Fatal(err)
		return projectState, err
	}

	projectState.ContractAddress = project.ContractAddress
	projectState.CreatedAt = project.CreatedAt
	projectState.CompletedAt = project.CompletedAt
	projectState.NextActivityDate = project.NextActivityDate
	projectState.ActivitiesCompleted = project.ActivitiesCompleted

	// var projectActivitiesList models.ProjectActivitiesList
	projectActivitiesList, err := models.ProjectActivitySearchProjectID(project.Id)
	if err != nil {
		log.Fatal(err)
		return projectState, err
	}
	projectState.ProjectActivitiesList = projectActivitiesList

	return projectState, nil

}
