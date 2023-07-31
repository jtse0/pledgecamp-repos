// ******** Connects to Postgresql DB to extract and modify data in DB tables

package models

import (
	"database/sql"
	"errors"
	"log"
	"time"

	"github.com/lib/pq"
	"github.com/pledgecamp/pledgecamp-oracle/connect"
	"github.com/pledgecamp/pledgecamp-oracle/constants"
)

const (
	activityTable = "project_activity"
)

// ProjectActivity
type ProjectActivity struct {
	Id              int                         `db:"project_activity_id" json:"project_activity_id"`
	ProjectId       int                         `db:"fk_project_id" json:"project_id"`
	CreatedAt       time.Time                   `db:"created_at" json:"created_at"`
	ModifiedAt      time.Time                   `db:"modified_at" json:"modified_at"`
	TransactionHash sql.NullString              `db:"transaction_hash" json:"transaction_hash"`
	Status          constants.ActivityStatus    `db:"activity_status" json:"activity_status"`
	Type            constants.ActivityReference `db:"activity_type" json:"activity_type"`
}

var activities []ProjectActivity
var activity ProjectActivity

// ProjectActivityInsert - Insert a new project activity into activity table
func ProjectActivityInsert(activity ProjectActivity) (ProjectActivity, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()
	activityCollection := dbConnection.Collection(activityTable)
	newId, err := activityCollection.Insert(map[string]interface{}{
		"fk_project_id":    activity.ProjectId,
		"created_at":       activity.CreatedAt,
		"modified_at":      activity.ModifiedAt,
		"transaction_hash": activity.TransactionHash,
		"activity_status":  activity.Status,
		"activity_type":    activity.Type,
	})
	log.Println("ProjectActivityInsert ", newId)
	if err != nil {
		log.Println(err)
		return activity, errors.New("Could not insert record")
	}
	activity.Id = int(newId.(int64))
	return activity, nil
}

// ProjectActivitySearchActivityID - Search project activity entries using activity Id
func ProjectActivitySearchActivityID(activityId int) (ProjectActivity, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()
	activityCollection := dbConnection.Collection(activityTable)
	res := activityCollection.Find("project_activity_id", activityId)
	log.Println("ProjectActivitySearchActivityID ", res)
	err := res.One(&activity)
	if err != nil {
		log.Println(err)
		return activity, err
	}
	return activity, nil
}

// ProjectActivitySearchProjectID - Search project activity entries using project Id
func ProjectActivitySearchProjectID(projectId int) ([]ProjectActivity, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()
	activityCollection := dbConnection.SelectFrom(activityTable)
	res := activityCollection.Where("fk_project_id = ?", projectId)
	log.Println("ProjectActivitySearchProjectID ", res)
	err := res.All(&activities)
	if err != nil {
		log.Println(err)
		log.Println("No activity was found")
		return activities, err
	}
	return activities, nil
}

// ProjectActivitySearchProjectIDTransType - Search project activity entries using project Id and transaction type
func ProjectActivitySearchProjectIDTransType(projectId int, transactionType string) ([]ProjectActivity, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()
	activityCollection := dbConnection.SelectFrom(activityTable)
	res := activityCollection.Where("fk_project_id = ? AND activity_type = ?", projectId, transactionType)
	log.Println("ProjectActivitySearchProjectID ", res)
	err := res.All(&activities)
	if err != nil {
		log.Println(err)
		log.Println("No activity was found")
		return activities, err
	}
	return activities, nil
}

// ProjectActivityPendingProject - Get project activity entries which are still pending after 10 minutes
func ProjectActivityPendingProject() ([]ProjectActivity, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()
	activityCollection := dbConnection.SelectFrom(activityTable)
	res := activityCollection.Where("activity_status = 0 AND created_at > (now() + interval '10 minutes')")
	log.Print("ProjectActivityPendingProject ", res)
	err := res.All(&activities)
	if err != nil {
		log.Println("No activity was found")
		return activities, err
	}
	return activities, nil
}

// ProjectActivityUpdateFields - Update project activity entry fields
func ProjectActivityUpdateFields(projectActivity ProjectActivity) (ProjectActivity, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()
	activityCollection := dbConnection.Collection(activityTable)
	res := activityCollection.Find("project_activity_id", projectActivity.Id)
	log.Println("Incoming activity", projectActivity)
	log.Println("ProjectActivityUpdateFields", res)
	err := res.Update(map[string]interface{}{
		"fk_project_id":    projectActivity.ProjectId,
		"created_at":       projectActivity.CreatedAt,
		"modified_at":      projectActivity.ModifiedAt,
		"transaction_hash": projectActivity.TransactionHash,
		"activity_status":  projectActivity.Status,
		"activity_type":    projectActivity.Type,
	})
	if err != nil {
		log.Println(err)
		log.Println("No activity was found")
		return projectActivity, err
	}
	res.One(&activity)
	return activity, nil
}

func SetProjectActivity(projectId int, activityType constants.ActivityReference) (ProjectActivity, error) {
	var projectActivity ProjectActivity
	projectActivity.ProjectId = projectId
	projectActivity.CreatedAt = time.Now()
	projectActivity.ModifiedAt = time.Now()
	projectActivity.Type = activityType
	projectActivity, err := ProjectActivityInsert(projectActivity)
	if err != nil {
		log.Fatal(err)
		return projectActivity, err
	}
	return projectActivity, nil
}

// CheckCompletedActivity - check if required activities are completed
func CheckCompletedActivity(check constants.ActivityReference, activities pq.StringArray) bool {
	for _, requiredActivity := range activities {
		if string(check) == requiredActivity {
			return true
		}
	}
	return false
}
