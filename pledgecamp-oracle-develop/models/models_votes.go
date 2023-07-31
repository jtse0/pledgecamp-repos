// ******** Connects to Postgresql DB to extract and modify data in DB tables

package models

import (
	"errors"
	"log"
	"time"

	"github.com/pledgecamp/pledgecamp-oracle/connect"
	"upper.io/db.v3"
	"upper.io/db.v3/postgresql"
)

const (
	voteTable = "votes"
)

/*
VotingParam struct

Vote Types:
0 = Milestone
1 = Moderation
*/
type VoteParameters struct {
	Vote          bool   `json:"vote"`
	EncryptedVote string `json:"encrypted_vote"`
	DecryptionKey string `json:"decryption_key"`
	VoteType      int    `json:"vote_type"`
	postgresql.JSONBConverter
}

// Project struct
type Vote struct {
	VoteId          int                    `db:"vote_id"`
	ContractAddress string                 `db:"contract_address"`
	VoteTime        time.Time              `db:"vote_created_at"`
	UserId          int                    `db:"user_id"`
	FkProjectId     int                    `db:"fk_project_id"`
	VoteParameters  map[string]interface{} `db:"vote_param"`
}

var votes []Vote
var vote Vote

// VoteInsert function
func VoteInsert(vote Vote) (Vote, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()
	voteCollection := dbConnection.Collection(voteTable)
	log.Print("Inside vote model")
	returnedVotes, err := voteCollection.Insert(
		map[string]interface{}{
			"contract_address": vote.ContractAddress,
			"vote_created_at":  vote.VoteTime,
			"user_id":          vote.UserId,
			"fk_project_id":    vote.FkProjectId,
			"vote_param":       vote.VoteParameters,
		})
	if err != nil {
		log.Println(err)
		return vote, errors.New("Could not insert record")
	}
	vote.VoteId = int(returnedVotes.(int64))
	log.Println(vote)
	return vote, nil
}

// VoteSearchVoteId - search by vote id
func VoteSearchVoteId(voteId int) (Vote, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()
	voteCollection := dbConnection.Collection(voteTable)
	res := voteCollection.Find("vote_id", voteId)
	err := res.One(&vote)
	if err != nil {
		log.Println("Could not find any votes")
		return vote, err
	}
	return vote, nil
}

// VoteSearchProjectId - search by project id
func VoteSearchProjectId(projectId int) ([]Vote, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()
	voteCollection := dbConnection.Collection(voteTable)
	res := voteCollection.Find("fk_project_id", projectId)
	err := res.All(&votes)
	if err != nil {
		log.Println("Could not find any votes")
		return votes, err
	}
	return votes, nil
}

// VoteSearchProjectIdVoteType - search by project id and vote type
func VoteSearchProjectIdVoteType(projectId int, voteType int) ([]Vote, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()
	voteCollection := dbConnection.SelectFrom(voteTable)
	res := voteCollection.Where(db.Raw(`fk_project_id = ? AND vote_param->>'vote_type' = ?`, projectId, voteType))
	err := res.All(&votes)
	if err != nil {
		log.Println("Could not find any votes")
		return votes, err
	}
	return votes, nil
}

// VoteSearchProjectIdVoteType - search by vote id and vote type
func VoteSearchVoteIdVoteType(voteId int, voteType int) ([]Vote, error) {
	dbConnection := connect.Postgres()
	defer dbConnection.Close()
	voteCollection := dbConnection.SelectFrom(voteTable)
	res := voteCollection.Where(db.Raw(`vote_id = ? AND vote_param->>'vote_type' = ?`, voteId, voteType))
	err := res.All(&votes)
	if err != nil {
		log.Println("Could not find any votes")
		return votes, err
	}
	return votes, nil
}
