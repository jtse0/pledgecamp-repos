package utils

import (
	"errors"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/pledgecamp/pledgecamp-oracle/constants"
	"github.com/pledgecamp/pledgecamp-oracle/models"
)

// SetInterval function to replace timer
func SetInterval(testFunc func(), milliseconds int, async bool) chan bool {

	// Set interval in milliseconds
	interval := time.Duration(milliseconds) * time.Millisecond

	// Set up ticker
	ticker := time.NewTicker(interval)
	clear := make(chan bool)

	// Check through the interval for activation of function
	go func() {
		for {
			select {
			case <-ticker.C:
				if async {
					go testFunc()
				} else {
					testFunc()
				}
			case <-clear:
				ticker.Stop()
				return
			}
		}
	}()

	// Return the channel so we can pass in a value to clear the interval
	return clear

}

func milestoneInterval(projects []models.Project) {
	log.Println("~~~~~~~~~~Checking for milestones~~~~~~~~~~~~~~~~~")

	for _, project := range projects {
		// Check projects only in the milestone phase that have passed their nextActivityDate
		switch project.Status {
		case constants.ProjectMilestonePhase:
			// Initial setup of NextActivityDate
			if project.NextActivityDate.Year() <= 1970 {
				milestones := project.ProjectParameters["milestones"]
				convertedMilestones := make([]int64, len(milestones.([]interface{})))
				for i := range milestones.([]interface{}) {
					convertedMilestones[i] = int64(milestones.([]interface{})[i].(float64))
				}
				project.NextActivityDate = time.Unix(convertedMilestones[0], 0)
				_, err = models.ProjectUpdateFields(project)
				if err != nil {
					log.Fatal(err)
				}
			}
			if time.Now().Format("2006-01-02 15:04:05") >= project.NextActivityDate.Format("2006-01-02 15:04:05") && project.Status != constants.ProjectModerationPhase {
				var milestoneRequest RequestCheckMilestones
				milestoneRequest.FkProjectId = project.Id
				log.Printf("Checking milestone for project: %v, %v", project.Id, project.ContractAddress)
				CheckMilestones(milestoneRequest)
			}
		}
	}
}

func recoveryInterval(projects []models.Project) {
	log.Println("~~~~~~~~~~Recovery of funds from projects~~~~~~~~~~~~~~~~~")

	for _, project := range projects {
		log.Println(project.Id, project.CompletedAt, project.NextActivityDate)
		dateDiff := project.CompletedAt.Sub(project.NextActivityDate)
		log.Println(dateDiff)
		diffDays := dateDiff.Minutes() / 24
		log.Println(diffDays)
		if project.Status != constants.ProjectFundsRecovered && diffDays > 90 {
			log.Printf("Retrieving leftover funds for project %v", project.Id)
			var recoveryRequest RequestFailedFundRecovery
			recoveryRequest.FkProjectId = project.Id
			err = FailedFundRecovery(recoveryRequest)
			if err != nil {
				log.Fatal(err)
			}
		}
	}
}

// Warmup function to implement interval checks
func Warmup() error {

	initialRun := true

	/*
		Milestone Interval
	*/

	intervalMS := os.Getenv("INTERVALS_CHECK_MILESTONE")
	intervalMSNum, err := strconv.Atoi(intervalMS)
	if err != nil {
		fmt.Printf("Error occurred with converting Milestone Interval: %v", intervalMS)
	}

	// Interval function to run checkMilestone for projects reaching milestone date
	SetInterval(func() {
		activeProjects, err := models.ProjectFetchActive()
		if err != nil {
			log.Fatal("Could not get active projects")
		}

		milestoneInterval(activeProjects)
	}, intervalMSNum, false)

	/*
		Failed Funds Recovery Interval
	*/

	intervalRecov := os.Getenv("INTERVALS_FUND_RECOVERY")
	intervalRecovNum, err := strconv.Atoi(intervalRecov)
	if err != nil {
		fmt.Printf("Error occurred with converting Failed Funds Recovery Interval: %v", intervalRecov)
	}
	completedProjects, err := models.ProjectFetchCompleted()
	if err != nil {
		return errors.New("Could not get completed projects")
	}

	// Interval function to get remaining funds from projects after 90 days
	SetInterval(func() {
		recoveryInterval(completedProjects)
		log.Println(intervalRecovNum)
	}, intervalRecovNum, false)

	if initialRun {

		activeProjects, err := models.ProjectFetchActive()
		if err != nil {
			return errors.New("Could not get active projects")
		}

		milestoneInterval(activeProjects)

		recoveryInterval(completedProjects)

		initialRun = false
	}

	return nil
}
