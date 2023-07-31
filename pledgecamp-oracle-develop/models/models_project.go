// ******** Connects to Postgresql DB to extract and modify data in DB tables

package models

import (
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/lib/pq"
	"github.com/pledgecamp/pledgecamp-oracle/connect"
	"github.com/pledgecamp/pledgecamp-oracle/constants"
	"upper.io/db.v3/postgresql"
)

const (
	projectTable = "project"
)

// ProjectParam struct
type ProjectParameters struct {
	Milestones      []int64 `json:"milestones"`
	ReleasePercents []int64 `json:"release_percents"`
	Backers         []int64 `json:"backers"`
	Amounts         []int64 `json:"amounts"`
	FundingComplete bool    `json:"funding_complete"`
	Moderators      []int64 `json:"moderators"`
	ListingFee      int64   `json:"listing_fee"`
	TotalRaised     int64   `json:"total_raised"`
	TotalAmount     int64   `json:"total_amount"`
	Creator         int64   `json:"creator"`
	postgresql.JSONBConverter
}

// Project struct
type Project struct {
	Id                  int                     `db:"id"`
	ContractAddress     string                  `db:"contract_address"`
	CreatedAt           time.Time               `db:"created_at"`
	CompletedAt         time.Time               `db:"completed_at"`
	Status              constants.ProjectStatus `db:"status"`
	NextActivityDate    time.Time               `db:"next_activity_date"`
	ActivitiesCompleted pq.StringArray          `db:"activities_completed"`
	ProjectParameters   map[string]interface{}  `db:"project_param"`
}

var projects []Project
var project Project

// ProjectInsert - insert new project entry
func ProjectInsert(project Project) (Project, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()

	projectCollection := dbConnection.Collection(projectTable)
	log.Print("Inside project model ", project)
	_, err := projectCollection.Insert(map[string]interface{}{
		"id":                 project.Id,
		"contract_address":   project.ContractAddress,
		"created_at":         project.CreatedAt,
		"completed_at":       project.CompletedAt,
		"status":             project.Status,
		"next_activity_date": project.NextActivityDate,
		"project_param":      project.ProjectParameters,
	})
	if err != nil {
		log.Println(err)
		return project, err
		// return project, errors.New("Could not insert record")
	}
	return project, nil
}

// ProjectUpdateFields - Update entries in project table
func ProjectUpdateFields(project Project) (Project, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()

	projectCollection := dbConnection.Collection(projectTable)
	res := projectCollection.Find("id", project.Id)
	log.Println("ProjectUpdateFields ", res)
	err := res.Update(&project)
	if err != nil {
		log.Println(err)
		return project, errors.New("Could not update record")
	}
	return project, nil
}

// ProjectFetchById - Get project entry using project Id
func ProjectFetchById(projectId int) (Project, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()

	projectCollection := dbConnection.Collection(projectTable)

	res := projectCollection.Find("id", projectId)

	err := res.One(&project)
	fmt.Printf("ProjectFetchById %+v\n", project)
	if err != nil {
		log.Println(err)
		return project, err
	}

	return project, nil
}

// ProjectFetchActive - Get project entries that are active
func ProjectFetchActive() ([]Project, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()
	projectCollection := dbConnection.SelectFrom(projectTable)
	res := projectCollection.Where("status >= 5 AND next_activity_date > '0001-01-01'")
	log.Print(res)
	err := res.All(&projects)
	if err != nil {
		log.Println(err)
		return projects, err
	}
	return projects, nil
}

// ProjectFetchCurrent - Get project entries reaching the next activity date
func ProjectFetchCurrent() ([]Project, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()
	projectCollection := dbConnection.SelectFrom(projectTable)
	res := projectCollection.Where("(status = 5 OR status = 6) AND next_activity_date > ?", time.Now())
	log.Print(res)
	err := res.All(&projects)
	if err != nil {
		log.Println(err)
		return projects, err
	}
	return projects, nil
}

// ProjectFetchCancellable - Get project entries that are ready to be cancelled
func ProjectFetchCancellable() ([]Project, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()
	projectCollection := dbConnection.SelectFrom(projectTable)
	res := projectCollection.Where("status = 8")
	log.Print(res)
	err := res.All(&projects)
	if err != nil {
		log.Println(err)
		return projects, err
	}
	return projects, nil
}

// ProjectFetchCompleted - Fetch projects that have been completed
func ProjectFetchCompleted() ([]Project, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()
	projectCollection := dbConnection.SelectFrom(projectTable)
	res := projectCollection.Where("status = 3")
	log.Print(res)
	err := res.All(&projects)
	if err != nil {
		log.Println(err)
		return projects, err
	}
	return projects, nil
}
