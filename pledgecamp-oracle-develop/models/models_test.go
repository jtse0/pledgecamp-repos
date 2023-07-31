package models

import (
	"database/sql"
	"fmt"
	"log"
	"strings"
	"testing"
	"time"

	"github.com/joho/godotenv"
	"github.com/lib/pq"
	"github.com/pledgecamp/pledgecamp-oracle/connect"
	"github.com/pledgecamp/pledgecamp-oracle/constants"
)

var testProjectId int
var testActivityId int
var testVoteId int
var testCSId int
var testCancellableProject int
var testCompletedProject int
var testCSActivityId int

func init() {
	err := godotenv.Load("../.env")
	if err != nil {
		log.Fatal("Models Test - No .env file found")
	}

	env := connect.LookupEnvOrExit("ENV_MODE")

	if strings.ToLower(env) != "test" {
		log.Fatal("Please set ENV_MODE to 'test' in .env file, change all URLs to 'http' and update 'DB_NAME' in .env file & rerun DB migrations for testing DB.")
	}
}

func getCounter(tableName string) int {
	var counter int
	dbConnection := connect.Postgres()
	tableCollection := dbConnection.SelectFrom(tableName)
	if tableName == projectTable {
		var lastProject Project
		tableCollection.OrderBy("-id").One(&lastProject)
		counter = lastProject.Id
	} else if tableName == activityTable {
		var lastProjectActivity ProjectActivity
		tableCollection.OrderBy("-project_activity_id").One(&lastProjectActivity)
		counter = lastProjectActivity.Id
	} else if tableName == voteTable {
		var lastVote Vote
		tableCollection.OrderBy("-vote_id").One(&lastVote)
		counter = lastVote.VoteId
	} else if tableName == csTable {
		var lastCS CampShares
		tableCollection.OrderBy("-cs_id").One(&lastCS)
		counter = lastCS.CSId
	} else if tableName == csActivityTable {
		var lastCSActivity CSActivity
		tableCollection.OrderBy("-cs_activity_id").One(&lastCSActivity)
		counter = lastCSActivity.Id
	}

	return counter
}

// Tests for models_project.go
func TestProjectInsert(t *testing.T) {
	log.Println("********************************* TestProjectInsert() **************************************")
	var testProject Project
	counter := getCounter(projectTable)
	testProject.Id = counter + 1
	testProjectId = testProject.Id
	fmt.Println("Project Id: ", testProjectId)
	testProject.ContractAddress = "abc93rjf93g490uj0ijf93gj0f329"
	testProject.CreatedAt = time.Now()
	testProject.CompletedAt = time.Now().Add(10 * time.Second)
	testProject.Status = 1
	milestone1 := 2585257157882
	milestone2 := 2585281578803
	layout := "2006-01-02T15:04:05"
	actDateStr := "2121-03-04T12:28:29"
	activityDate, err := time.Parse(layout, actDateStr)
	testProject.NextActivityDate = activityDate
	testProject.ProjectParameters = map[string]interface{}{
		"amounts":          nil,
		"backers":          nil,
		"milestones":       []int{milestone1, milestone2},
		"funding_complete": false,
		"release_percents": []int{50, 50},
	}
	_, err = ProjectInsert(testProject)
	if err != nil {
		t.Error("Could not insert project")
	} else {
		fmt.Printf("The project %v was inserted successfully. \n", testProject)
	}

	// Current Project Insert
	counter = getCounter(projectTable)
	testProject.Id = counter + 1
	fmt.Println("Project Id: ", testProject.Id)
	testProject.ContractAddress = "abc93rjf93g490uj0ijf93gj0f329"
	testProject.CreatedAt = time.Now()
	testProject.CompletedAt = time.Now().Add(10 * time.Second)
	testProject.Status = 5
	milestone1 = 2585257157882
	milestone2 = 2585281578803
	layout = "2006-01-02T15:04:05"
	actDateStr = "2121-03-04T12:28:29"
	activityDate, err = time.Parse(layout, actDateStr)
	testProject.NextActivityDate = activityDate
	testProject.ProjectParameters = map[string]interface{}{
		"amounts":          nil,
		"backers":          nil,
		"milestones":       []int{milestone1, milestone2},
		"funding_complete": false,
		"release_percents": []int{50, 50},
	}
	_, err = ProjectInsert(testProject)
	if err != nil {
		t.Error("Failed at project insert")
	}

	// Completed Project Insert
	counter = getCounter(projectTable)
	testProject.Id = counter + 1
	fmt.Println("Project Id: ", testProject.Id)
	testProject.ContractAddress = "abc93rjf93g490uj0ijf93gj0f329"
	testProject.CreatedAt = time.Now().Add(-24 * time.Hour)
	testProject.CompletedAt = time.Now()
	testProject.Status = constants.ProjectEnded
	_, err = ProjectInsert(testProject)
	if err != nil {
		t.Error("Failed at project insert")
	}

	// Cancellable Project Insert
	counter = getCounter(projectTable)
	testProject.Id = counter + 1
	fmt.Println("Project Id: ", testProject.Id)
	testProject.ContractAddress = "abc93rjf93g490uj0ijf93gj0f329"
	testProject.CreatedAt = time.Now().Add(-24 * time.Hour)
	testProject.CompletedAt = time.Now()
	testProject.Status = constants.ProjectReadyToCancel
	_, err = ProjectInsert(testProject)
	if err != nil {
		t.Error("Failed at project insert")
	}

	log.Println("********************************* End TestProjectInsert() **************************************")
}

func TestProjectInsertFailure(t *testing.T) {
	log.Println("********************************* TestProjectInsertFailure() **************************************")
	var testProject Project
	counter := getCounter(projectTable)
	testProject.Id = counter
	fmt.Println("Project Id: ", testProjectId)
	testProject.ContractAddress = "abc93rjf93g490uj0ijf93gj0f329"
	testProject.CreatedAt = time.Now()
	testProject.CompletedAt = time.Now().Add(10 * time.Second)
	testProject.Status = 1
	milestone1 := 1585257157882
	milestone2 := 1585281578803
	layout := "2006-01-02T15:04:05"
	actDateStr := "2020-07-04T12:28:29"
	activityDate, err := time.Parse(layout, actDateStr)
	testProject.NextActivityDate = activityDate
	testProject.ProjectParameters = map[string]interface{}{
		"amounts":          nil,
		"backers":          nil,
		"milestones":       []int{milestone1, milestone2},
		"funding_complete": false,
		"release_percents": []int{50, 50},
	}
	_, err = ProjectInsert(testProject)
	if err == nil {
		t.Error("Should have failed")
	}
	log.Println("********************************* End TestProjectInsertFailure() **************************************")
}

func TestProjectUpdateFields(t *testing.T) {
	log.Println("********************************* TestProjectUpdateFields() **************************************")
	var testProject Project
	testProject.Id = testProjectId
	testProject.Status = constants.ProjectDeployed
	_, err := ProjectFetchById(testProject.Id)
	testProject.ContractAddress = "abc93rjf93g490uj0ijf93gj0f329"
	testProject.CreatedAt = time.Now()
	testProject.CompletedAt = time.Now().Add(10 * time.Second)
	milestone1 := 1585257157882
	milestone2 := 1585281578803
	layout := "2006-01-02T15:04:05"
	actDateStr := "2021-03-04T12:28:29"
	activityDate, err := time.Parse(layout, actDateStr)
	testProject.NextActivityDate = activityDate
	testProject.ProjectParameters = map[string]interface{}{
		"amounts":          []int{800, 200, 300},
		"backers":          []int{1, 2, 3},
		"milestones":       []int{milestone1, milestone2},
		"funding_complete": false,
		"release_percents": []int{80, 20},
	}
	updatedProject, err := ProjectUpdateFields(testProject)
	if err != nil {
		t.Error("Could not update project status")
	}
	fmt.Println("Updated project: ", updatedProject)
	log.Println("********************************* End TestProjectUpdateFields() **************************************")
}

func TestProjectUpdateFieldsFailure(t *testing.T) {
	log.Println("********************************* TestProjectUpdateFieldsFailure() **************************************")
	var testProject Project
	testProject.Id = 98109810983
	testProject.Status = 5
	_, err := ProjectUpdateFields(testProject)
	if err == nil {
		t.Error("Should have failed")
	}
	log.Println("********************************* End TestProjectUpdateFieldsFailure() **************************************")
}
func TestProjectFetch(t *testing.T) {
	log.Println("********************************* TestProjectFetch() **************************************")
	testProjectResult, err := ProjectFetchById(testProjectId)
	log.Println(testProjectResult)
	if err != nil {
		t.Error("Could not get projects")
	}
	log.Println("********************************* End TestProjectFetch() **************************************")
}

func TestProjectFetchFailure(t *testing.T) {
	log.Println("********************************* TestProjectFetchFailure() **************************************")
	testProjectSet, err := ProjectFetchById(873487)
	log.Println(testProjectSet)
	if err == nil {
		t.Error("Should have failed")
	}
	log.Println("********************************* End TestProjectFetchFailure() **************************************")
}

func TestProjectFetchActive(t *testing.T) {
	log.Println("********************************* TestProjectFetchActive() **************************************")
	testProjectSet, err := ProjectFetchActive()
	log.Println(len(testProjectSet), "records returned")
	if err != nil {
		t.Error("Could not get active projects")
	} else if len(testProjectSet) == 0 {
		t.Error("Projects were not extracted properly")
	}
	for _, project := range testProjectSet {
		if project.NextActivityDate.IsZero() {
			t.Errorf("The project extracted is not active: %v", project.NextActivityDate)
		}
		if project.Status < 5 {
			t.Errorf("The project extracted is not active: %v", project.Status)
		}
	}
	log.Println("********************************* End TestProjectFetchActive() **************************************")
}

func TestProjectFetchCurrent(t *testing.T) {
	log.Println("********************************* TestProjectFetchCurrent() **************************************")
	testProjectSet, err := ProjectFetchCurrent()
	log.Println(len(testProjectSet), "records returned")
	if err != nil {
		t.Error("Could not get current projects")
	} else if len(testProjectSet) > 0 {
		for _, project := range testProjectSet {
			if project.NextActivityDate.Before(time.Now()) {
				t.Errorf("The project extracted is a past project: %v", project.NextActivityDate)
			}
			if project.Status < 5 || project.Status > 6 {
				t.Errorf("The project extracted is not active: %v", project.Status)
			}
		}
	}
	log.Println("********************************* End TestProjectFetchCurrent() **************************************")
}

func TestProjectFetchCancellable(t *testing.T) {
	log.Println("********************************* TestProjectFetchCancellable() **************************************")
	testProjectSet, err := ProjectFetchCancellable()
	log.Println(len(testProjectSet), "records returned")
	if err != nil {
		t.Error("Could not get cancellable projects")
	} else if len(testProjectSet) == 0 {
		t.Error("Projects were not extracted properly")
	}
	log.Println("********************************* End TestProjectFetchCancellable() **************************************")
}

func TestProjectFetchCompleted(t *testing.T) {
	log.Println("********************************* TestProjectFetchCompleted() **************************************")
	testProjectSet, err := ProjectFetchCompleted()
	log.Println(len(testProjectSet), "records returned")
	if err != nil {
		t.Error("Could not get completed projects")
	} else if len(testProjectSet) == 0 {
		t.Error("Projects were not extracted properly")
	}
	log.Println("********************************* End TestProjectFetchCompleted() **************************************")
}

// Tests for models_actitity.go
func TestProjectActivityInsert(t *testing.T) {
	log.Println("********************************* TestProjectActivityInsert() **************************************")
	var testProjectActivity ProjectActivity
	testProjectActivity.ProjectId = testProjectId
	testProjectActivity.CreatedAt = time.Now()
	testProjectActivity.ModifiedAt = time.Now()
	testProjectActivity.TransactionHash = sql.NullString{String: "0x9151b3bb689362b78a3f3da5ecc4e34c2384c1f60a511f9f0dfaabeb14c3cf46", Valid: true}
	testProjectActivity.Status = 0
	testProjectActivity.Type = constants.ProjectCreate
	log.Println(testProjectActivity)
	activity, err := ProjectActivityInsert(testProjectActivity)
	if err != nil {
		t.Error("Could not insert activity")
	}
	log.Println(activity)
	testActivityId = activity.Id
	log.Println("********************************* End TestProjectActivityInsert() **************************************")
}

func TestProjectActivityInsertFailure(t *testing.T) {
	log.Println("********************************* TestProjectActivityInsertFailure() **************************************")
	var testProjectActivity ProjectActivity
	testProjectActivity.ProjectId = 45756546676755
	testProjectActivity.CreatedAt = time.Now()
	testProjectActivity.ModifiedAt = time.Now()
	testProjectActivity.TransactionHash = sql.NullString{String: "0x9151b3bb689362b78a3f3da5ecc4e34c2384c1f60a511f9f0dfaabeb14c3cf46", Valid: true}
	testProjectActivity.Status = 0
	testProjectActivity.Type = constants.ProjectCreate
	log.Println(testProjectActivity)
	_, err := ProjectActivityInsert(testProjectActivity)
	if err == nil {
		t.Error("Should have failed")
	}
	log.Println("********************************* End TestProjectActivityInsertFailure() **************************************")
}

func TestProjectActivitySearchActvityID(t *testing.T) {
	log.Println("********************************* TestProjectActivitySearchActvityID() **************************************")
	testProjectActivity, err := ProjectActivitySearchActivityID(testActivityId)
	if err != nil {
		t.Error("Could not get activity based on Activity Id")
	}
	log.Print(testProjectActivity)
	log.Println("********************************* End TestProjectActivitySearchActvityID() **************************************")
}

func TestProjectActivitySearchActvityIDFailure(t *testing.T) {
	log.Println("********************************* TestProjectActivitySearchActvityIDFailure() **************************************")
	_, err := ProjectActivitySearchActivityID(8997879)
	if err == nil {
		t.Error("Should have failed")
	}
	log.Println("********************************* End TestProjectActivitySearchActvityIDFailure() **************************************")
}

func TestProjectActivityGetByProjectID(t *testing.T) {
	log.Println("********************************* TestProjectActivityGetByProjectID() **************************************")
	testProjectActivity, err := ProjectActivitySearchProjectID(testProjectId)
	if err != nil {
		t.Error("Could not get activity from project Id")
	} else if len(testProjectActivity) == 0 {
		t.Error("Projects were not extracted properly")
	}
	log.Print(testProjectActivity)
	log.Println("********************************* End TestProjectActivityGetByProjectID() **************************************")
}

func TestProjectActivityGetByProjectIDTransType(t *testing.T) {
	log.Println("********************************* TestProjectActivityGetByProjectIDTransType() **************************************")
	testProjectActivity, err := ProjectActivitySearchProjectIDTransType(testProjectId, "PROJECT_CREATE")
	if err != nil {
		t.Error("Could not get activity from project Id")
	} else if len(testProjectActivity) == 0 {
		t.Error("Activities were not extracted properly")
	}
	log.Print(testProjectActivity)
	log.Println("********************************* End TestProjectActivityGetByProjectIDTransType() **************************************")
}

func TestProjectActivityGetPendingProject(t *testing.T) {
	log.Println("********************************* TestProjectActivityGetPendingProject() **************************************")
	testProjectActivities, err := ProjectActivityPendingProject()
	if err != nil {
		t.Error("Could not get activity from project Id")
	} else if len(testProjectActivities) == 0 {
		t.Error("Activities were not extracted properly")
	}
	log.Println(len(testProjectActivities), "records returned")
	log.Println("********************************* End TestProjectActivityGetPendingProject() **************************************")
}

func TestActivityUpdateFields(t *testing.T) {
	log.Println("********************************* TestActivityUpdateFields() **************************************")
	var testProjectActivity ProjectActivity
	testProjectActivity.ProjectId = testProjectId
	fetchedActivity, _ := ProjectActivitySearchProjectID(testProjectId)
	log.Println("Original Activity: ", fetchedActivity[0])
	testProjectActivity.ProjectId = testProjectId + 7040
	testProjectActivity.Id = fetchedActivity[0].Id
	testProjectActivity.CreatedAt = time.Now()
	testProjectActivity.ModifiedAt = time.Now()
	testProjectActivity.TransactionHash = sql.NullString{String: "0x80453bb689362b78a3f3da5ecc4e34c2384c1f60a511f9f0dfaabeb14c3cf46", Valid: true}
	testProjectActivity.Status = 2
	testProjectActivity.Type = constants.StakePLG
	activity, _ := ProjectActivityUpdateFields(testProjectActivity)
	log.Print("Returned Activities: ", activity)
	log.Println("********************************* End TestActivityUpdateFields() **************************************")
}

func TestSetActivity(t *testing.T) {
	log.Println("********************************* TestSetActivity() **************************************")
	activityType := constants.CancelProject
	activity, err := SetProjectActivity(testProjectId, activityType)
	log.Println("Activity Type Updated: ", activity)
	if err != nil {
		t.Error("Could not update Project Activity")
	}
	log.Println("********************************* End TestSetActivity() **************************************")
}

func TestCheckCompleted(t *testing.T) {
	log.Println("********************************* TestCheckCompleted() **************************************")
	targetActivity := constants.SetProjectInfo
	var activitiesCompletedList pq.StringArray
	activitiesCompletedList = append(activitiesCompletedList, string(constants.ProjectDeploy))
	activitiesCompletedList = append(activitiesCompletedList, string(constants.SetProjectInfo))
	activitiesCompletedList = append(activitiesCompletedList, string(constants.SetBackers))
	result := CheckCompletedActivity(targetActivity, activitiesCompletedList)
	log.Println("Required Activites completed: ", result)
	if result == false {
		t.Error("Could not check completed activity")
	}
	log.Println("********************************* End TestCheckCompleted() **************************************")
}

// Tests for models_votes.go
func TestVoteInsert(t *testing.T) {
	log.Println("********************************* TestVoteInsert() **************************************")
	var testVote Vote
	testVote.ContractAddress = "0xaFA43c1Ad39b503C68331e1d3E7470b58958e6EF"
	testVote.VoteTime = time.Now()
	testVote.UserId = 12345
	testVote.FkProjectId = testProjectId
	testVote.VoteParameters = map[string]interface{}{
		"vote":           1,
		"encrypted_vote": "0x6ba79b6be13a20011b8f5bceca9feaabcd8995cb51d0e0b448a0006123afaafc",
		"decryption_key": "0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353",
		"vote_type":      1,
	}
	vote, err := VoteInsert(testVote)
	if err != nil {
		t.Error("Could not insert vote")
	}
	testVoteId = vote.VoteId
	log.Println("********************************* End TestVoteInsert() **************************************")
}

func TestVoteInsertFailure(t *testing.T) {
	log.Println("********************************* TestVoteInsertFailure() **************************************")
	var testVote Vote
	testVote.ContractAddress = "0xaFA43c1Ad39b503C68331e1d3E7470b58958e6EF"
	testVote.VoteTime = time.Now()
	testVote.UserId = 12345
	testVote.FkProjectId = 98999879
	testVote.VoteParameters = map[string]interface{}{
		"vote":           1,
		"encrypted_vote": "0x6ba79b6be13a20011b8f5bceca9feaabcd8995cb51d0e0b448a0006123afaafc",
		"decryption_key": "0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353",
		"vote_type":      1,
	}
	_, err := VoteInsert(testVote)
	if err == nil {
		t.Error("Should have failed")
	}
	log.Println("********************************* End TestVoteInsertFailure() **************************************")
}

func TestVoteSearchVoteId(t *testing.T) {
	log.Println("********************************* TestVoteSearchVoteId() **************************************")
	testVote, err := VoteSearchVoteId(testVoteId)
	if err != nil {
		t.Error("Could not get activity from project Id")
	}
	log.Print("Returned vote: ", testVote)
	log.Println("********************************* End TestVoteSearchVoteId() **************************************")
}

func TestVoteSearchProjectId(t *testing.T) {
	log.Println("********************************* TestVoteSearchProjectId() **************************************")
	testVote, err := VoteSearchProjectId(testProjectId)
	if err != nil {
		t.Error("Could not get activity from project Id")
	}
	testVoteId = testVote[0].VoteId
	log.Print("Returned vote: ", testVote)
	log.Println("********************************* End TestVoteSearchProjectId() **************************************")
}

func TestVoteSearchProjectIdVoteType(t *testing.T) {
	log.Println("********************************* TestVoteSearchProjectIdVoteType() **************************************")
	testVote, err := VoteSearchProjectIdVoteType(testProjectId, 1)
	if err != nil {
		t.Error("Could not get activity from project Id")
	}
	testVoteId = testVote[0].VoteId
	log.Print("Returned vote: ", testVote)
	log.Println("********************************* End TestVoteSearchProjectIdVoteType() **************************************")
}

func TestVoteSearchVoteIdVoteType(t *testing.T) {
	log.Println("********************************* TestVoteSearchVoteIdVoteType() **************************************")
	testVote, err := VoteSearchVoteIdVoteType(testVoteId, 1)
	if err != nil {
		t.Error("Could not get activity from project Id")
	}
	testVoteId = testVote[0].VoteId
	log.Print("Returned vote: ", testVote)
	log.Println("********************************* End TestVoteSearchVoteIdVoteType() **************************************")
}

func TestCSInsert(t *testing.T) {
	log.Println("********************************* TestCSInsert() **************************************")
	var testCS CampShares
	counter := getCounter(csTable)
	testCS.CSId = counter + 1
	testCSId = testCS.CSId
	testCS.CSTime = time.Now()
	testCS.UserId = 123
	testCS.Amount = 100
	testCS.CSParameters = map[string]interface{}{
		"is_moderator": true,
	}
	cs, err := CSInsert(testCS)
	if err != nil {
		t.Error("Could not insert CampShare entry")
	}
	log.Println("CS inserted: ", cs)
	log.Println("********************************* End TestCSInsert() **************************************")
}

func TestCSInsertFailure(t *testing.T) {
	log.Println("********************************* TestCSInsertFailure() **************************************")
	var testCS CampShares
	testCS.CSId = testCSId
	testCS.CSTime = time.Now()
	testCS.UserId = 123
	testCS.CSParameters = map[string]interface{}{
		"is_moderator": true,
	}
	_, err := CSInsert(testCS)
	if err == nil {
		t.Error("Should have failed")
	}
	log.Println("********************************* End TestCSInsertFailure() **************************************")
}

func TestCSUpdateFields(t *testing.T) {
	log.Println("********************************* TestCSUpdateFields() **************************************")
	var testCS CampShares
	counter := getCounter(csTable)
	testCS.CSId = counter
	returnedCS, _ := CSSearchCSId(testCS.CSId)
	log.Println("Original record: ", returnedCS)
	testCS.CSTime = time.Now()
	testCS.UserId = 888
	testCS.Amount = 100
	testCS.CSType = 1
	cs, err := CSUpdateFields(testCS)
	log.Println("Updated record: ", cs)
	if err != nil {
		t.Error("Could not update CampShare entry")
	}
	log.Println("********************************* End TestCSUpdateFields() **************************************")
}

func TestCSUpdateFieldsFailure(t *testing.T) {
	log.Println("********************************* TestCSUpdateFieldsFailure() **************************************")
	var testCS CampShares
	testCS.CSId = 79847983274
	testCS.CSTime = time.Now()
	testCS.UserId = 888
	_, err := CSUpdateFields(testCS)
	if err == nil {
		t.Error("Should have failed")
	}
	log.Println("********************************* End TestCSUpdateFieldsFailure() **************************************")
}

func TestGetCSHolderIds(t *testing.T) {
	log.Println("********************************* TestGetCSHolderIds() **************************************")
	cs, err := GetCSHolderIds()
	log.Println("CS Holder Ids: ", cs)
	if err != nil {
		t.Error("Could not get CampShare entries")
	} else if len(csList) == 0 {
		t.Error("CS were not extracted properly")
	}
	log.Println("********************************* End TestGetCSHolderIds() **************************************")
}

func TestCSSearchCSId(t *testing.T) {
	log.Println("********************************* TestCSSearchCSId() **************************************")
	counter := getCounter(csTable)
	cs, err := CSSearchCSId(counter)
	log.Println("CS returned: ", counter, cs)
	if err != nil {
		t.Error("Could not get CampShare entries")
	}
	log.Println("********************************* End TestCSSearchCSId() **************************************")
}

func TestGetLatestCSId(t *testing.T) {
	log.Println("********************************* TestGetLatestCSId() **************************************")
	cs, err := GetlatestCSId()
	log.Println("CS returned: ", cs)
	if err != nil {
		t.Error("Could not get CampShare entries")
	}
	log.Println("********************************* End TestGetLatestCSId() **************************************")
}

func TestGetCSByUserId(t *testing.T) {
	log.Println("********************************* TestGetCSByUserId() **************************************")
	cs, err := GetCSByUserId(888)
	log.Println(len(cs), "records returned")
	if err != nil {
		t.Error("Could not get CampShare entries")
	}
	log.Println("********************************* End TestGetCSByUserId() **************************************")
}

func TestGetCSByUserIdCsType(t *testing.T) {
	log.Println("********************************* TestGetCSByUserIdCsType() **************************************")
	cs, err := GetCSByUserIdCsType(888, 1)
	log.Println(len(cs), "records returned")
	if err != nil {
		t.Error("Could not get CampShare entries")
	}
	log.Println("********************************* End TestGetCSByUserIdCsType() **************************************")
}

func TestGetCSByType(t *testing.T) {
	log.Println("********************************* TestGetCSByType() **************************************")
	cs, err := GetCSByType(1)
	log.Println(len(cs), "records returned")
	if err != nil {
		t.Error("Could not get CampShare entries")
	}
	log.Println("********************************* End TestGetCSByType() **************************************")
}

func TestCSActivityInsert(t *testing.T) {
	log.Println("********************************* TestCSActivityInsert() **************************************")
	var testCSactivity CSActivity
	counter := getCounter(csTable)
	testCSactivity.CsId = counter
	testCSactivity.CreatedAt = time.Now()
	testCSactivity.ModifiedAt = time.Now()
	testCSactivity.TransactionHash = sql.NullString{String: "0x8051b3bb689362b78a3f3da5ecc4e34c2384c1f60a511f9f0dfaabeb14c3cf46", Valid: true}
	testCSactivity.Status = 0
	testCSactivity.Type = constants.StakePLG
	activity, err := CSActivityInsert(testCSactivity)
	log.Println("CS Activity Inserted: ", activity)
	if err != nil {
		t.Error("Could not insert CS Activity")
	}
	testCSActivityId = activity.Id
	log.Println("********************************* End TestCSActivityInsert() **************************************")
}

func TestCSActivityInsertFailure(t *testing.T) {
	log.Println("********************************* TestCSActivityInsertFailure() **************************************")
	var testCSactivity CSActivity
	counter := 2480328489820842
	testCSactivity.CsId = counter
	testCSactivity.CreatedAt = time.Now()
	testCSactivity.ModifiedAt = time.Now()
	testCSactivity.TransactionHash = sql.NullString{String: "0x8051b3bb689362b78a3f3da5ecc4e34c2384c1f60a511f9f0dfaabeb14c3cf46", Valid: true}
	testCSactivity.Status = 0
	testCSactivity.Type = constants.StakePLG
	activity, err := CSActivityInsert(testCSactivity)
	log.Println("CS Activity Inserted: ", activity)
	if err == nil {
		t.Error("Should have failed")
	}
	log.Println("********************************* End TestCSActivityInsertFailure() **************************************")
}

func TestCSActivitySearchActivityID(t *testing.T) {
	log.Println("********************************* TestCSActivitySearchActivityID() **************************************")
	activity, err := CSActivitySearchActivityID(testCSActivityId)
	log.Println("CS Activity Returned: ", activity)
	if err != nil {
		t.Error("Could not return CS Activity")
	}
	log.Println("********************************* End TestCSActivitySearchActivityID() **************************************")
}
func TestCSActivitySearchCsID(t *testing.T) {
	log.Println("********************************* TestCSActivitySearchCsID() **************************************")
	activity, err := CSActivitySearchCsID(testCSId)
	log.Println("CS Activity Returned: ", activity)
	if err != nil {
		t.Error("Could not return CS Activity")
	} else if len(activity) == 0 {
		t.Error("Activities were not extracted properly")
	}
	log.Println("********************************* End TestCSActivitySearchCsID() **************************************")
}

func TestCSActivitySearchCsIDTransType(t *testing.T) {
	log.Println("********************************* TestCSActivitySearchCsIDTransType() **************************************")
	activity, err := CSActivitySearchCsIDTransType(testCSId, "STAKE_PLG")
	log.Println("CS Activity Returned: ", activity)
	if err != nil {
		t.Error("Could not return CS Activity")
	} else if len(activity) == 0 {
		t.Error("Activities were not extracted properly")
	}
	log.Println("********************************* End TestCSActivitySearchCsIDTransType() **************************************")
}

func TestCSActivityPending(t *testing.T) {
	log.Println("********************************* TestCSActivityPending() **************************************")
	activity, err := CSActivityPending()
	if err != nil {
		t.Error("Could not return CS Activity")
	} else if len(activity) == 0 {
		t.Error("Activities were not extracted properly")
	}
	log.Println(len(activity), "records returned")
	log.Println("********************************* End TestCSActivityPending() **************************************")
}

func TestCSActivityUpdateFields(t *testing.T) {
	log.Println("********************************* TestCSActivityUpdateFields() **************************************")
	var testCSactivity CSActivity
	testCSactivity.CsId = 100308
	returnedActivity, _ := CSActivitySearchCsID(testCSactivity.CsId)
	log.Println("Original CS Activity: ", returnedActivity[0])
	testCSactivity.Id = returnedActivity[0].Id
	testCSactivity.CreatedAt = time.Now()
	testCSactivity.ModifiedAt = time.Now()
	testCSactivity.TransactionHash = sql.NullString{String: "0x9151b3bb689362b78a3f3da5ecc4e34c2384c1f60a511f9f0dfaabeb14c3cf46", Valid: true}
	testCSactivity.Status = 0
	testCSactivity.Type = constants.ProjectCreate
	activity, err := CSActivityUpdateFields(testCSactivity)
	log.Println("CS Activity Updated: ", activity)
	if err != nil {
		t.Error("Could not update CS Activity")
	}
	log.Println("********************************* End TestCSActivityUpdateFields() **************************************")
}

func TestCSActivityUpdateFieldsFailure(t *testing.T) {
	log.Println("********************************* TestCSActivityUpdateFieldsFailure() **************************************")
	var testCSactivity CSActivity
	testCSactivity.CsId = 92384023740237498
	testCSactivity.CreatedAt = time.Now()
	testCSactivity.ModifiedAt = time.Now()
	testCSactivity.TransactionHash = sql.NullString{String: "0x9151b3bb689362b78a3f3da5ecc4e34c2384c1f60a511f9f0dfaabeb14c3cf46", Valid: true}
	testCSactivity.Status = 0
	testCSactivity.Type = constants.StakePLG
	activity, err := CSActivityUpdateFields(testCSactivity)
	log.Println("CS Activity Updated: ", activity)
	if err == nil {
		t.Error("Should have failed")
	}
	log.Println("********************************* End TestCSActivityUpdateFieldsFailure() **************************************")
}

func TestSetCSActivity(t *testing.T) {
	log.Println("********************************* TestSetCSActivity() **************************************")
	counter := getCounter(csTable)
	testCsId := counter
	activityType := constants.StakePLG
	activity, err := SetCSActivity(testCsId, activityType)
	log.Println("CS Activity Type Added: ", activity)
	if err != nil {
		t.Error("Could not update CS Activity")
	}
	log.Println("********************************* End TestSetCSActivity() **************************************")
}

func TestProjectState(t *testing.T) {
	log.Println("********************************* TestProjectState() **************************************")
	var projectState ProjectStateResponse
	projectState.ProjectId = testProjectId
	log.Println("Project State: ", projectState)
	log.Println("********************************* End TestProjectState() **************************************")
}

func TestCsState(t *testing.T) {
	log.Println("********************************* TestCsState() **************************************")
	var csState CsStateResponse
	csState.UserId = 888
	log.Println("CS State: ", csState)
	log.Println("********************************* End TestCsState() **************************************")
}
