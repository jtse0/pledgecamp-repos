// ******** Connects to Postgresql DB to extract and modify data in DB tables

package models

import (
	"errors"
	"log"
	"time"

	"github.com/pledgecamp/pledgecamp-oracle/connect"
	"upper.io/db.v3/postgresql"
)

const (
	csTable = "campshare"
)

// CSParameter breakdown
type CSParameters struct {
	IsModerator int `json:"is_moderator"`
	FKProjectId int `json:"project_id"`
	postgresql.JSONBConverter
}

/*
CampShares data model

CSType:
0 - Stake
1 - Unstake
2 - Interest
3 - Withdraw
4 - Post interest
*/
type CampShares struct {
	CSId                int                    `db:"cs_id"`
	ContractAddress     string                 `db:"contract_address"`
	CSTime              time.Time              `db:"created_at"`
	CSType              int                    `db:"cs_type"`
	UserId              int                    `db:"user_id"`
	Amount              int                    `db:"amount"`
	BalanceMovement     int                    `db:"balance_movement"`
	UnstakeCompleteDate time.Time              `db:"unstake_complete_date"`
	CSParameters        map[string]interface{} `db:"cs_param"`
}

var csList []CampShares
var cs CampShares

// CSInsert function
func CSInsert(cs CampShares) (CampShares, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()

	csCollection := dbConnection.Collection(csTable)
	log.Print("Inside CampShares model")
	log.Println(cs)
	_, err := csCollection.Insert(cs)
	if err != nil {
		log.Println(err)
		return cs, errors.New("Could not insert record")
	}
	return cs, nil
}

// CSUpdateFields - Update entries in CS table
func CSUpdateFields(cs CampShares) (CampShares, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()

	csCollection := dbConnection.Collection(csTable)
	res := csCollection.Find("cs_id", cs.CSId)
	log.Println("CSUpdateFields ", res)
	err := res.Update(&cs)
	if err != nil {
		log.Println(err)
		return cs, errors.New("Could not insert record")
	}
	return cs, nil
}

// GetCSHolderIds - Get list of CS Ids
func GetCSHolderIds() ([]int, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()
	csCollection := dbConnection.Select("user_id").From(csTable)
	res := csCollection.GroupBy("user_id")
	err := res.All(&csList)
	var csHoldersList []int
	for _, csHolder := range csList {
		csHoldersList = append(csHoldersList, csHolder.UserId)
	}
	if err != nil {
		log.Println(err)
		return csHoldersList, err
	}
	return csHoldersList, nil
}

// CSSearchCSId - search by cs id
func CSSearchCSId(csId int) (CampShares, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()
	csCollection := dbConnection.Collection(csTable)
	res := csCollection.Find("cs_id", csId)
	err := res.One(&cs)
	if err != nil {
		log.Println("Could not find any cs records")
		return cs, err
	}
	return cs, nil
}

// Get list of CS transactions sorted by the latest first
func GetlatestCSId() (CampShares, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()
	csCollection := dbConnection.SelectFrom(csTable)
	res := csCollection.OrderBy("-cs_id")
	log.Println(res)
	err := res.One(&cs)
	if err != nil {
		log.Println("Could not find any cs records")
		return cs, err
	}
	return cs, nil
}

// GetCSByUserId - Get list of CS transactions related to a user
func GetCSByUserId(userId int) ([]CampShares, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()
	csCollection := dbConnection.SelectFrom(csTable)
	res := csCollection.Where("user_id = ?", userId)
	err := res.All(&csList)
	if err != nil {
		log.Println(err)
		return csList, err
	}
	return csList, nil
}

// GetCSByUserId - Get list of CS transactions related to a user and csType
func GetCSByUserIdCsType(userId int, csType int) ([]CampShares, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()
	csCollection := dbConnection.SelectFrom(csTable)
	res := csCollection.Where("user_id = ? AND cs_type = ?", userId, csType)
	err := res.All(&csList)
	if err != nil {
		log.Println(err)
		return csList, err
	}
	return csList, nil
}

// GetCSByType - Get list of certain type of CS
func GetCSByType(csType int) ([]CampShares, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()
	csCollection := dbConnection.SelectFrom(csTable)
	res := csCollection.Where("cs_type = ?", csType)
	err := res.All(&csList)
	if err != nil {
		log.Println(err)
		return csList, err
	}
	return csList, nil
}
