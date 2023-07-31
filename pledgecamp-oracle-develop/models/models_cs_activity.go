// ******** Connects to Postgresql DB to extract and modify data in DB tables

package models

import (
	"database/sql"
	"errors"
	"log"
	"time"

	"github.com/pledgecamp/pledgecamp-oracle/connect"
	"github.com/pledgecamp/pledgecamp-oracle/constants"
)

const (
	csActivityTable = "cs_activity"
)

// CSActivity
type CSActivity struct {
	Id              int                         `db:"cs_activity_id" json:"cs_activity_id"`
	CsId            int                         `db:"fk_cs_id" json:"fk_cs_id"`
	CreatedAt       time.Time                   `db:"created_at" json:"created_at"`
	ModifiedAt      time.Time                   `db:"modified_at" json:"modified_at"`
	TransactionHash sql.NullString              `db:"transaction_hash" json:"transaction_hash"`
	Status          constants.ActivityStatus    `db:"activity_status" json:"activity_status"`
	Type            constants.ActivityReference `db:"activity_type" json:"activity_type"`
}

var csActivities []CSActivity
var csActivity CSActivity

// CSActivityInsert - Insert a new activity into activity table
func CSActivityInsert(csActivity CSActivity) (CSActivity, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()
	activityCollection := dbConnection.Collection(csActivityTable)
	newId, err := activityCollection.Insert(map[string]interface{}{
		"fk_cs_id":         csActivity.CsId,
		"created_at":       csActivity.CreatedAt,
		"modified_at":      csActivity.ModifiedAt,
		"transaction_hash": csActivity.TransactionHash,
		"activity_status":  csActivity.Status,
		"activity_type":    csActivity.Type,
	})
	log.Println("CSActivityInsert ", newId)
	if err != nil {
		log.Println(err)
		return csActivity, errors.New("Could not insert record")
	}
	csActivity.Id = int(newId.(int64))
	return csActivity, nil
}

// CSActivitySearchActivityID - Search CS activity entries using activity Id
func CSActivitySearchActivityID(csActivityId int) (CSActivity, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()
	activityCollection := dbConnection.Collection(csActivityTable)
	res := activityCollection.Find("cs_activity_id", csActivityId)
	log.Println("CSActivitySearchActivityID ", res)
	err := res.One(&csActivity)
	if err != nil {
		log.Println(err)
		return csActivity, err
	}
	return csActivity, nil
}

// CSActivitySearchCsID - Search CS activity entries using csId
func CSActivitySearchCsID(csId int) ([]CSActivity, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()
	activityCollection := dbConnection.SelectFrom(csActivityTable)
	res := activityCollection.Where("fk_cs_id = ?", csId)
	log.Println("CSActivitySearchCsID ", res)
	err := res.All(&csActivities)
	if err != nil {
		log.Println(err)
		log.Println("No activity was found")
		return csActivities, err
	}
	return csActivities, nil
}

// CSActivitySearchCsIDTransType - Search CS activity entries using csId and transaction type
func CSActivitySearchCsIDTransType(csId int, transactionType string) ([]CSActivity, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()
	activityCollection := dbConnection.SelectFrom(csActivityTable)
	res := activityCollection.Where("fk_cs_id = ? AND activity_type = ?", csId, transactionType)
	log.Println("CSActivitySearchCsID ", res)
	err := res.All(&csActivities)
	if err != nil {
		log.Println(err)
		log.Println("No activity was found")
		return csActivities, err
	}
	return csActivities, nil
}

// CSActivityPending - Get CS activity entries which are still pending after 10 minutes
func CSActivityPending() ([]CSActivity, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()
	activityCollection := dbConnection.SelectFrom(csActivityTable)
	res := activityCollection.Where("activity_status = 0 AND created_at > (now() + interval '10 minutes')")
	log.Print("CSActivityPending ", res)
	err := res.All(&csActivities)
	if err != nil {
		log.Println(err)
		log.Println("No activity was found")
		return csActivities, err
	}
	return csActivities, nil
}

// CSActivityUpdateFields - Update CS activity entry fields
func CSActivityUpdateFields(csActivity CSActivity) (CSActivity, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()
	activityCollection := dbConnection.Collection(csActivityTable)
	res := activityCollection.Find("cs_activity_id", csActivity.Id)
	log.Println("Incoming activity", csActivity)
	log.Println("CSActivityUpdateFields", res)
	err := res.Update(map[string]interface{}{
		"fk_cs_id":         csActivity.CsId,
		"created_at":       csActivity.CreatedAt,
		"modified_at":      csActivity.ModifiedAt,
		"transaction_hash": csActivity.TransactionHash,
		"activity_status":  csActivity.Status,
		"activity_type":    csActivity.Type,
	})
	if err != nil {
		log.Println(err)
		log.Println("No activity was found")
		return csActivity, err
	}
	return csActivity, nil
}

// SetCSActivity - Set new CS activity
func SetCSActivity(csId int, activityType constants.ActivityReference) (CSActivity, error) {
	var csActivity CSActivity
	csActivity.CsId = csId
	csActivity.CreatedAt = time.Now()
	csActivity.ModifiedAt = time.Now()
	csActivity.Type = activityType
	csActivity, err := CSActivityInsert(csActivity)
	if err != nil {
		log.Fatal(err)
		return csActivity, err
	}
	return csActivity, nil
}
