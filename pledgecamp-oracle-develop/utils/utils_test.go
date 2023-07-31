package utils

import (
	"fmt"
	"log"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/imroc/req"
	"github.com/joho/godotenv"
	"github.com/lib/pq"
	"github.com/pledgecamp/pledgecamp-oracle/connect"
	"github.com/pledgecamp/pledgecamp-oracle/constants"
	"github.com/pledgecamp/pledgecamp-oracle/models"
)

const (
	projectTable    = "project"
	voteTable       = "votes"
	csTable         = "campshare"
	csActivityTable = "cs_activity"
	activityTable   = "project_activity"
	layout          = "2006-01-02T15:04:05"
)

var server *httptest.Server
var milestoneTest Project
var cancelTest Project
var failedFundTest Project
var unstakeTest CampShares
var transactionResponse NodeServerModel
var testActivityId int
var testProjectId int
var testCSId int

func init() {
	err := godotenv.Load("../.env")
	if err != nil {
		log.Fatal("Models Test - No .env file found")
	}

	env := connect.LookupEnvOrExit("ENV_MODE")

	if strings.ToLower(env) != "test" {
		log.Fatal("Please set ENV_MODE to 'test' in .env file, change all URLs to 'http' and update 'DB_NAME' in .env file  & rerun DB migrations for testing DB.")
	}
}

func TestMain(m *testing.M) {

	log.Println("********************************* TestMain() **************************************")

	// Truncate table before beginning
	dbConnection := connect.Postgres()
	defer dbConnection.Close()
	query := dbConnection.DeleteFrom(voteTable)
	_, err = query.Exec()
	if err != nil {
		log.Fatalf("DeleteFrom(): %q\n", err)
	}
	query = dbConnection.DeleteFrom(csActivityTable)
	_, err = query.Exec()
	if err != nil {
		log.Fatalf("DeleteFrom(): %q\n", err)
	}
	query = dbConnection.DeleteFrom(csTable)
	_, err = query.Exec()
	if err != nil {
		log.Fatalf("DeleteFrom(): %q\n", err)
	}
	query = dbConnection.DeleteFrom(activityTable)
	_, err = query.Exec()
	if err != nil {
		log.Fatalf("DeleteFrom(): %q\n", err)
	}
	query = dbConnection.DeleteFrom(projectTable)
	_, err = query.Exec()
	if err != nil {
		log.Fatalf("DeleteFrom(): %q\n", err)
	}

	// Prepare entry for milestones
	milestoneTest.Id = 100123

	milestoneTest.ContractAddress = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	milestoneTest.CreatedAt = time.Now()
	milestoneTest.CompletedAt = time.Now()
	milestoneTest.Status = 0
	milestone1str := "2121-04-04T12:28:29"
	milestone1time, err := time.Parse(layout, milestone1str)
	if err != nil {
		log.Print(err)
	}
	milestone1 := int(milestone1time.Unix())
	milestoneTest.NextActivityDate = milestone1time
	milestone2str := "2121-05-24T17:23:07"
	milestone2time, err := time.Parse(layout, milestone2str)
	if err != nil {
		log.Print(err)
	}
	milestone2 := int(milestone2time.Unix())
	milestoneTest.ProjectParameters = map[string]interface{}{
		"amounts":          nil,
		"backers":          nil,
		"milestones":       []int{milestone1, milestone2},
		"funding_complete": false,
		"release_percents": []int{50, 50},
	}
	project, err := models.ProjectInsert(milestoneTest)
	if err != nil {
		log.Printf("Could not insert project %v \n", milestoneTest.Id)
	}
	log.Println(project)

	// Prepare entry for cancellation
	cancelTest.Id = 100124

	cancelTest.ContractAddress = "0x2f12b8de656da45032a237882d4aede2c5eb0ae4"
	cancelTest.CreatedAt = time.Now()
	cancelTest.CompletedAt = time.Now()
	cancelTest.Status = 1
	milestone1str = "2021-06-04T12:28:29"
	milestone1time, err = time.Parse(layout, milestone1str)
	if err != nil {
		log.Print(err)
	}
	milestone1 = int(milestone1time.Unix())
	milestoneTest.NextActivityDate = milestone1time
	milestone2str = "2021-07-24T17:23:07"
	milestone2time, err = time.Parse(layout, milestone2str)
	if err != nil {
		log.Println(err)
	}
	milestone2 = int(milestone2time.Unix())
	cancelTest.ProjectParameters = map[string]interface{}{
		"amounts":          nil,
		"backers":          nil,
		"milestones":       []int{milestone1, milestone2},
		"funding_complete": false,
		"release_percents": []int{50, 50},
	}
	project, err = models.ProjectInsert(cancelTest)
	if err != nil {
		log.Printf("Could not insert project %v \n", cancelTest.Id)
	}
	log.Println(project)

	// Prepare entry for failed funds recovery
	failedFundTest.Id = 100125

	failedFundTest.ContractAddress = "0x2f12b8de656da45032a237882d4aede2c5eb0ae4"
	failedFundTest.CreatedAt = time.Now()
	failedFundTest.CompletedAt, err = time.Parse(layout, "2021-10-24T17:23:07")
	if err != nil {
		log.Print(err)
	}
	failedFundTest.Status = 3
	milestone1str = "2021-06-04T12:28:29"
	milestone1time, err = time.Parse(layout, milestone1str)
	if err != nil {
		log.Print(err)
	}
	milestone1 = int(milestone1time.Unix())
	milestoneTest.NextActivityDate = milestone1time
	milestone2str = "2021-07-24T17:23:07"
	milestone2time, err = time.Parse(layout, milestone2str)
	if err != nil {
		log.Println(err)
	}
	milestone2 = int(milestone2time.Unix())
	failedFundTest.ProjectParameters = map[string]interface{}{
		"amounts":          nil,
		"backers":          nil,
		"milestones":       []int{milestone1, milestone2},
		"funding_complete": false,
		"release_percents": []int{50, 50},
	}
	project, err = models.ProjectInsert(failedFundTest)
	if err != nil {
		log.Printf("Could not insert project %v \n", failedFundTest.Id)
	}
	log.Println(project)

	log.Println("Entry into stub from NodeServer ~~~~~~~~~~")
	NodeServerResponseStub()
	log.Println("Entry into stub from Backend ~~~~~~~")
	BackendResponseStub()

	exitVal := m.Run()

	os.Exit(exitVal)
	log.Println("********************************* End TestMain() **************************************")
}

// Tests for utils_warmup.go
func TestSetInterval(t *testing.T) {
	log.Println("********************************* TestSetInterval() **************************************")

	SetInterval(func() {}, 100, false)

	log.Println("********************************* End TestSetInterval() **************************************")
}

// Tests for utils_request.go
func TestPostNodeServer(t *testing.T) {
	log.Println("********************************* TestNodeserver() **************************************")
	requestParameters := req.Param{
		"Status": 0,
	}
	_, err := PostNodeServer(requestParameters, "/projects/123")
	if err != nil {
		t.Error(err)
	}
	log.Println("********************************* End TestNodeserver() **************************************")
}

func TestGetPostNodeServer(t *testing.T) {
	log.Println("********************************* TestGetNodeserver() **************************************")
	testReq := req.Param{
		"user_id": 1,
	}
	_, err := GetNodeServer(testReq, "/projects/123")
	if err != nil {
		t.Error(err)
	}
	log.Println("********************************* End TestGetNodeserver() **************************************")
}

func TestPostBackend(t *testing.T) {
	log.Println("********************************* TestBackend() **************************************")
	requestParameters := req.Param{
		"Status": 0,
	}
	_, err := PostBackend(requestParameters, "/events/blockchain/projects/432/PROJECT_CREATE")
	if err != nil {
		t.Error(err)
	}
	log.Println("********************************* End TestBackend() **************************************")
}

// Tests for utils_project_create.go
func TestProjectCreateSuccess(t *testing.T) {
	log.Println("********************************* TestProjectCreateSuccess() **************************************")
	dbConnection := connect.Postgres()
	defer dbConnection.Close()
	var lastProject Project
	projectCollection := dbConnection.SelectFrom(projectTable)
	projectCollection.OrderBy("-id").One(&lastProject)
	counter := lastProject.Id
	var testReq RequestProjectCreate
	testReq.ProjectId = counter + 1
	testReq.Milestones = []int64{time.Now().Add(time.Second * 1).Unix(), time.Now().Add(time.Second * 5).Unix()}
	testReq.ReleasePercents = []int64{50, 50}
	testReq.Creator = 231
	log.Print("Inside TestProjectCreate")
	log.Print(pq.Array(testReq.ReleasePercents))

	log.Println("Creating project")
	project, err := ProjectCreate(testReq)
	fmt.Println(project)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	newProject, err := models.ProjectFetchById(project.Id)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	if newProject.Status != project.Status {
		t.Error("Project was not created")
	}

	testProjectId = testReq.ProjectId
	transactionType := "PROJECT_DEPLOY"
	activity, _ := models.ProjectActivitySearchProjectIDTransType(testProjectId, transactionType)
	testActivityId = activity[0].Id
	if activity[0].ProjectId != project.Id {
		t.Error("Project activity was not created")
	}

	log.Println("********************************* End TestProjectCreateSuccess() **************************************")
}

func TestProjectCreateFailure(t *testing.T) {
	log.Println("********************************* TestProjectCreateFailure() **************************************")
	dbConnection := connect.Postgres()
	defer dbConnection.Close()
	var lastProject Project
	projectCollection := dbConnection.SelectFrom(projectTable)
	projectCollection.OrderBy("-id").One(&lastProject)
	counter := lastProject.Id
	var testReq RequestProjectCreate
	testReq.ProjectId = counter
	testReq.Milestones = []int64{time.Now().Round(time.Millisecond).UnixNano() / 1e6, time.Now().Round(time.Millisecond).UnixNano() / 1e6}
	testReq.ReleasePercents = []int64{50, 50}
	testReq.Creator = 231
	_, err := ProjectCreate(testReq)
	fmt.Println("Error: ", err)
	if err == nil {
		t.Errorf("Should have failed")
	}

	log.Println("********************************* End TestProjectCreateFailure() **************************************")
}

func TestProjectCreateCallback(t *testing.T) {

	log.Println("********************************* TestProjectCreateCallback() **************************************")
	transactionResponse.ParentID = testActivityId
	transactionResponse.Status = 2
	transactionResponse.To = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.ContractAddress = "0x60e3ee943f7045f7fb7348841aa710c129c58667"

	projectActivityId := transactionResponse.ParentID
	targetActivity, err := models.ProjectActivitySearchActivityID(projectActivityId)
	if err != nil {
		log.Fatal(err)
	}

	err = ProjectCreateCallback(transactionResponse, targetActivity)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	project, err := models.ProjectFetchById(targetActivity.ProjectId)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	if project.Status != constants.ProjectDeployed {
		t.Errorf("Incorrect project status: %d", project.Status)
	}

	log.Println("********************************* End TestProjectCreateCallback() **************************************")
}

// Tests for utils_submit_vote.go for milestone votes
func TestSubmitMilestoneVoteSuccess(t *testing.T) {
	log.Println("********************************* TestSubmitMilestoneVoteSuccess() **************************************")
	var testReq RequestVote
	testReq.UserId = 321
	testReq.Vote = true
	testReq.VoteType = 0
	testReq.FkProjectId = testProjectId
	_, err := SubmitVote(testReq)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	transactionType := "MILESTONE_VOTE"
	activity, err := models.ProjectActivitySearchProjectIDTransType(testReq.FkProjectId, transactionType)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}
	if activity[0].ProjectId != testProjectId {
		t.Error("Project activity was not created")
	}
	testActivityId = activity[0].Id

	log.Println("********************************* End TestSubmitMilestoneVoteSuccess() **************************************")
}

func TestMilestoneVoteCallback(t *testing.T) {
	log.Println("********************************* TestMilestoneVoteCallback() **************************************")
	transactionResponse.ParentID = testActivityId
	transactionResponse.Status = 2
	transactionResponse.To = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.ContractAddress = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.Hash = "0xeef10fc5170f669b86c4cd0444882a96087221325f8bf2f55d6188633aa7be7c"
	var transactionEventsArray []interface{}
	transactionEventsArray = append(transactionEventsArray, []interface{}{"123", true, "100"})
	transactionResponse.TransactionEvents = transactionEventsArray
	projectActivityId := transactionResponse.ParentID
	targetActivity, err := models.ProjectActivitySearchActivityID(projectActivityId)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}
	log.Println(targetActivity)

	err = VoteCallback(transactionResponse, targetActivity)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	votes, err := models.VoteSearchProjectId(testProjectId)
	if err != nil {
		t.Errorf("An error was returned when extracting votes: %d", err)
	}
	length := len(votes) - 1
	if int(votes[length].VoteParameters["vote_type"].(interface{}).(float64)) != 0 {
		t.Error("Incorrect vote type")
	}

	log.Println("Returned votes: ", testProjectId, votes)
	if len(votes) < 1 {
		t.Errorf("Error in retrieving milestone vote")
	}
	if votes[length].FkProjectId != testProjectId {
		t.Errorf("An error was returned when extracting votes")
	}

	targetActivity, err = models.ProjectActivitySearchActivityID(projectActivityId)
	if err != nil {
		log.Fatal(err)
	}
	if targetActivity.Status != constants.ActivitySuccess {
		t.Errorf("Incorrect activity status: %d", targetActivity.Status)
	}

	log.Println("********************************* End TestMilestoneVoteCallback() **************************************")
}

// Test for utils_submit_vote.go for moderation votes
func TestSubmitModerationVoteSuccess(t *testing.T) {
	log.Println("********************************* TestSubmitModerationVoteSuccess() **************************************")
	var testReq RequestVote
	testReq.UserId = 124
	testReq.Vote = true
	testReq.DecryptionKey = "0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353"
	testReq.VoteType = 1
	testReq.FkProjectId = testProjectId
	vote, err := SubmitVote(testReq)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	transactionType := "MODERATION_VOTE"
	activity, err := models.ProjectActivitySearchProjectIDTransType(testReq.FkProjectId, transactionType)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}
	if activity[0].ProjectId != testProjectId {
		t.Error("Project activity was not created")
	}
	testActivityId = activity[0].Id

	extractedVote, err := models.VoteSearchVoteId(vote.VoteId)
	if err != nil {
		t.Errorf("An error was returned when extracting votes: %d", err)
	} else if extractedVote.FkProjectId != testReq.FkProjectId {
		t.Errorf("An error was returned when extracting votes")
	}

	log.Println("********************************* End TestSubmitModerationVoteSuccess() **************************************")

}

func TestModerationVoteCallback(t *testing.T) {
	log.Println("********************************* TestModerationVoteCallback() **************************************")
	transactionResponse.ParentID = testActivityId
	transactionResponse.Status = 2
	transactionResponse.To = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.ContractAddress = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.Hash = "0xeef10fc5170f669b86c4cd0444882a96087221325f8bf2f55d6188633aa7be7c"
	var transactionEventsArray []interface{}
	transactionEventsArray = append(transactionEventsArray, []interface{}{"0x60e3ee943f7045f7fb7348841aa710c129c58667", "423", "0x6ba79b6be13a20011b8f5bceca9feaabcd8995cb51d0e0b448a0006123afaafc"})
	transactionResponse.TransactionEvents = transactionEventsArray
	projectActivityId := transactionResponse.ParentID
	targetActivity, err := models.ProjectActivitySearchActivityID(projectActivityId)
	if err != nil {
		log.Fatal(err)
	}

	err = VoteCallback(transactionResponse, targetActivity)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	votes, err := models.VoteSearchProjectId(testProjectId)
	if err != nil {
		t.Errorf("An error was returned when extracting votes: %d", err)
	}
	length := len(votes) - 1
	if int(votes[length].VoteParameters["vote_type"].(interface{}).(float64)) != 1 {
		t.Error("Incorrect vote type")
	}

	targetActivity, err = models.ProjectActivitySearchActivityID(projectActivityId)
	if err != nil {
		log.Fatal(err)
	}

	if targetActivity.Status != constants.ActivitySuccess {
		t.Errorf("Incorrect activity status: %d", targetActivity.Status)
	}

	log.Println("********************************* End TestModerationVoteCallback() **************************************")
}

// Tests for utils_set_project_info.go
func TestSetProjectInfo(t *testing.T) {
	log.Println("********************************* TestSetProjectInfo() **************************************")
	var testReq RequestSetProjectInfo
	testReq.FkProjectId = testProjectId
	testReq.ListingFee = 5
	testReq.TotalRaised = 150
	testReq.Beneficiaries = []int64{12345678, 87654321}
	testReq.Amounts = []int64{100, 50}
	testReq.FundingComplete = true
	testReq.TotalAmount = 150
	err := SetProjectInfo(testReq)
	if err != nil {
		log.Printf("An error was returned: %d", err)
	}

	transactionType := "SET_PROJECT_INFO"
	activity, _ := models.ProjectActivitySearchProjectIDTransType(testReq.FkProjectId, transactionType)
	testActivityId = activity[0].Id

	project, err := models.ProjectFetchById(testProjectId)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	if project.ProjectParameters["listing_fee"].(float64) < 1 {
		t.Errorf("Listing fee error")
	}

	log.Println("********************************* End TestSetProjectInfo() **************************************")
}

func TestSetProjectInfoCallback(t *testing.T) {
	log.Println("********************************* TestSetProjectInfoCallback() **************************************")
	transactionResponse.ParentID = testActivityId
	transactionResponse.Status = 2
	transactionResponse.To = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.ContractAddress = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.Hash = "0xeef10fc5170f669b86c4cd0444882a96087221325f8bf2f55d6188633aa7be7c"
	projectActivityId := transactionResponse.ParentID
	targetActivity, err := models.ProjectActivitySearchActivityID(projectActivityId)
	if err != nil {
		log.Fatal(err)
	}

	err = SetProjectInfoCallback(transactionResponse, targetActivity)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	targetActivity, err = models.ProjectActivitySearchActivityID(testActivityId)
	if err != nil {
		log.Fatal(err)
	}

	project, err := models.ProjectFetchById(testProjectId)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	activitiesCompleted := models.CheckCompletedActivity(constants.SetProjectInfo, project.ActivitiesCompleted)
	if activitiesCompleted == false {
		t.Error("SET_PROJECT_INFO was not completed")
	}

	if targetActivity.Status != constants.ActivitySuccess {
		t.Errorf("Incorrect activity status: %d", targetActivity.Status)
	}

	time.Sleep(2 * time.Second)

	targetActivities, err := models.ProjectActivitySearchProjectID(testProjectId)
	if err != nil {
		log.Fatal(err)
	}
	length := len(targetActivities) - 1
	if targetActivities[length].Type != constants.SetBackers {
		t.Error("SET_BACKERS should have been run")
	}
	log.Println("********************************* End TestSetProjectInfoCallback() **************************************")
}

// Tests for utils_set_backers.go
func TestSetBackers(t *testing.T) {
	log.Println("********************************* TestSetBackers() **************************************")
	var testReq RequestSetBackers
	testReq.Beneficiaries = []int64{12345678, 87654321}
	testReq.Amounts = []int64{100, 50}
	testReq.FundingComplete = true
	testReq.FkProjectId = testProjectId
	testReq.TotalAmount = 150
	err := SetBackers(testReq)
	if err != nil {
		log.Printf("An error was returned: %d", err)
	}

	transactionType := string(constants.SetBackers)
	activity, _ := models.ProjectActivitySearchProjectIDTransType(testReq.FkProjectId, transactionType)
	testActivityId = activity[0].Id

	project, err := models.ProjectFetchById(testProjectId)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	if len(project.ProjectParameters["backers"].([]interface{})) < 1 {
		t.Errorf("Backers error")
	}

	log.Println("********************************* End TestSetBackers() **************************************")
}

func TestSetBackersCallback(t *testing.T) {
	log.Println("********************************* TestSetBackersCallback() **************************************")
	transactionResponse.ParentID = testActivityId
	transactionResponse.Status = 2
	transactionResponse.To = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.ContractAddress = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.Hash = "0xeef10fc5170f669b86c4cd0444882a96087221325f8bf2f55d6188633aa7be7c"
	projectActivityId := transactionResponse.ParentID
	targetActivity, err := models.ProjectActivitySearchActivityID(projectActivityId)
	if err != nil {
		log.Fatal(err)
	}

	err = SetBackersCallback(transactionResponse, targetActivity)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	project, err := models.ProjectFetchById(testProjectId)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	activitiesCompleted := models.CheckCompletedActivity(constants.SetBackers, project.ActivitiesCompleted)
	if activitiesCompleted == false {
		t.Error("SET_BACKERS was not initiated")
	}

	if project.Status != constants.ProjectMilestonePhase {
		t.Errorf("Incorrect project status: %d", project.Status)
	}

	log.Println("********************************* End TestSetBackersCallback() **************************************")
}

// Tests for utils_cancel_project.go
func TestCancelProject(t *testing.T) {
	log.Println("********************************* TestCancelProject() **************************************")
	var testReq RequestCancelProject
	testReq.FkProjectId = testProjectId
	err := CancelProject(testReq)
	if err != nil {
		log.Printf("An error was returned: %d", err)
	}

	transactionType := "CANCEL_PROJECT"
	activity, _ := models.ProjectActivitySearchProjectIDTransType(testReq.FkProjectId, transactionType)
	testActivityId = activity[0].Id

	log.Println("********************************* End TestCancelProject() **************************************")
}

func TestCancelProjectCallbackCancel(t *testing.T) {
	log.Println("********************************* TestCancelProjectCallbackCancel() **************************************")
	transactionResponse.ParentID = testActivityId
	transactionResponse.Status = 2
	transactionResponse.To = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.ContractAddress = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.Hash = "0xeef10fc5170f669b86c4cd0444882a96087221325f8bf2f55d6188633aa7be7c"
	transactionEventsArray := []interface{}{"0x60e3ee943f7045f7fb7348841aa710c129c58667", true}
	transactionResponse.TransactionEvents = transactionEventsArray
	projectActivityId := transactionResponse.ParentID
	targetActivity, err := models.ProjectActivitySearchActivityID(projectActivityId)
	if err != nil {
		log.Fatal(err)
	}

	err = CancelProjectCallback(transactionResponse, targetActivity)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	project, err := models.ProjectFetchById(testProjectId)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	if project.Status != constants.ProjectCancelled {
		t.Errorf("Incorrect project status: %d", project.Status)
	}
	log.Println("********************************* End TestCancelProjectCallbackCancel() **************************************")
}

func TestCancelProjectCallbackNoCancel(t *testing.T) {
	log.Println("********************************* TestCancelProjectCallbackNoCancel() **************************************")
	transactionResponse.ParentID = testActivityId
	transactionResponse.Status = 2
	transactionResponse.To = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.ContractAddress = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.Hash = "0xeef10fc5170f669b86c4cd0444882a96087221325f8bf2f55d6188633aa7be7c"
	transactionEventsArray := []interface{}{"0x60e3ee943f7045f7fb7348841aa710c129c58667", false}
	transactionResponse.TransactionEvents = transactionEventsArray
	projectActivityId := transactionResponse.ParentID
	targetActivity, err := models.ProjectActivitySearchActivityID(projectActivityId)
	if err != nil {
		log.Fatal(err)
	}

	err = CancelProjectCallback(transactionResponse, targetActivity)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	project, err := models.ProjectFetchById(testProjectId)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	targetActivities, err := models.ProjectActivitySearchProjectID(testProjectId)
	if err != nil {
		log.Fatal(err)
	}
	length := len(targetActivities) - 1
	if targetActivities[length].Type != constants.CancelProject {
		t.Error("Project activity was not created")
	}

	if project.Status != constants.ProjectMilestonePhase {
		t.Errorf("Incorrect project status: %d", project.Status)
	}

	log.Println("********************************* End TestCancelProjectCallbackNoCancel() **************************************")
}

// Tests for utils_check_milestone.go
func TestCheckMilestone(t *testing.T) {
	log.Println("********************************* TestCheckMilestone() **************************************")
	var testReq RequestCheckMilestones
	testReq.FkProjectId = testProjectId
	err := CheckMilestones(testReq)
	if err != nil {
		log.Printf("An error was returned: %d", err)
	}

	transactionType := "CHECK_MILESTONE"
	activity, _ := models.ProjectActivitySearchProjectIDTransType(testReq.FkProjectId, transactionType)
	testActivityId = activity[0].Id
	log.Println("********************************* End TestCheckMilestone() **************************************")
}

func TestCheckMilestoneCallbackPass(t *testing.T) {
	log.Println("********************************* TestCheckMilestoneCallbackPass() **************************************")
	transactionResponse.ParentID = testActivityId
	transactionResponse.Status = 2
	transactionResponse.To = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.ContractAddress = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.Hash = "0xeef10fc5170f669b86c4cd0444882a96087221325f8bf2f55d6188633aa7be7c"
	projectActivityId := transactionResponse.ParentID
	var transactionEventsArray []interface{}
	transactionEventsArray = append(transactionEventsArray, []interface{}{"2000", true})
	transactionResponse.TransactionEvents = transactionEventsArray
	targetActivity, err := models.ProjectActivitySearchActivityID(projectActivityId)
	if err != nil {
		log.Fatal(err)
	}

	err = CheckMilestoneCallback(transactionResponse, targetActivity)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	project, err := models.ProjectFetchById(testProjectId)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	time.Sleep(3 * time.Second)

	targetActivities, err := models.ProjectActivitySearchProjectID(testProjectId)
	if err != nil {
		log.Fatal(err)
	}
	length := len(targetActivities) - 1
	if targetActivities[length].Type != constants.WithdrawFunds {
		t.Error("WITHDRAW_FUNDS should have been run")
	}

	if project.Status != constants.ProjectMilestonePhase {
		t.Errorf("Incorrect project status: %d", project.Status)
	}

	log.Println("********************************* End TestCheckMilestoneCallbackPass() **************************************")
}

func TestCheckMilestoneCallbackNoPass(t *testing.T) {
	log.Println("********************************* TestCheckMilestoneCallbackNoPass() **************************************")
	transactionResponse.ParentID = testActivityId
	transactionResponse.Status = 2
	transactionResponse.To = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.ContractAddress = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.Hash = "0xeef10fc5170f669b86c4cd0444882a96087221325f8bf2f55d6188633aa7be7c"
	projectActivityId := transactionResponse.ParentID
	var transactionEventsArray []interface{}
	transactionEventsArray = append(transactionEventsArray, []interface{}{"0", false})
	transactionResponse.TransactionEvents = transactionEventsArray
	targetActivity, err := models.ProjectActivitySearchActivityID(projectActivityId)
	if err != nil {
		log.Fatal(err)
	}

	err = CheckMilestoneCallback(transactionResponse, targetActivity)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	project, err := models.ProjectFetchById(targetActivity.ProjectId)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	targetActivities, err := models.ProjectActivitySearchProjectID(testProjectId)
	if err != nil {
		log.Fatal(err)
	}
	length := len(targetActivities) - 1
	if targetActivities[length].Type != constants.RequestRefund {
		t.Error("REQUEST_REFUNDS should have been run")
	}

	if project.Status != constants.ProjectMilestoneFailed {
		t.Errorf("Incorrect project status: %d", project.Status)
	}

	log.Println("********************************* End TestCheckMilestoneCallbackNoPass() **************************************")
}

func TestCheckMilestoneLastMilestone(t *testing.T) {
	log.Println("********************************* TestCheckMilestoneLastMilestone() **************************************")

	time.Sleep(6 * time.Second)

	var testReq RequestCheckMilestones
	testReq.FkProjectId = testProjectId
	err = CheckMilestones(testReq)
	if err != nil {
		log.Printf("An error was returned: %d", err)
	}

	transactionType := "CHECK_MILESTONE"
	activity, _ := models.ProjectActivitySearchProjectIDTransType(testReq.FkProjectId, transactionType)
	testActivityId = activity[0].Id
	log.Println("********************************* End TestCheckMilestoneLastMilestone() **************************************")
}

func TestCheckMilestoneCallbackLastMilestone(t *testing.T) {
	log.Println("********************************* TestCheckMilestoneCallbackLastMilestone() **************************************")
	transactionResponse.ParentID = testActivityId
	transactionResponse.Status = 2
	transactionResponse.To = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.ContractAddress = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.Hash = "0xeef10fc5170f669b86c4cd0444882a96087221325f8bf2f55d6188633aa7be7c"
	projectActivityId := transactionResponse.ParentID
	var transactionEventsArray []interface{}
	transactionEventsArray = append(transactionEventsArray, []interface{}{"2000", true})
	transactionResponse.TransactionEvents = transactionEventsArray
	targetActivity, err := models.ProjectActivitySearchActivityID(projectActivityId)
	if err != nil {
		log.Fatal(err)
	}

	err = CheckMilestoneCallback(transactionResponse, targetActivity)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	project, err := models.ProjectFetchById(targetActivity.ProjectId)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}
	log.Println(project)

	time.Sleep(3 * time.Second)

	targetActivities, err := models.ProjectActivitySearchProjectID(testProjectId)
	if err != nil {
		log.Fatal(err)
	}
	length := len(targetActivities) - 1
	if targetActivities[length].Type != constants.WithdrawFunds {
		t.Error("WITHDRAW_FUNDS should have been run")
	}

	if project.Status != constants.ProjectEnded {
		t.Errorf("Incorrect project status: %d", project.Status)
	}

	log.Println("********************************* End TestCheckMilestoneCallbackLastMilestone() **************************************")
}

// Tests for utils_failed_fund_recovery.go
func TestFailedFundRecovery(t *testing.T) {
	log.Println("********************************* TestFailedFundRecovery() **************************************")
	var testReq RequestFailedFundRecovery
	testReq.FkProjectId = testProjectId
	err := FailedFundRecovery(testReq)
	if err != nil {
		log.Printf("An error was returned: %d", err)
	}

	transactionType := "FAILED_FUND_RECOVERY"
	activity, _ := models.ProjectActivitySearchProjectIDTransType(testReq.FkProjectId, transactionType)
	testActivityId = activity[0].Id
	log.Println("********************************* End TestFailedFundRecovery() **************************************")
}

func TestFailedFundRecoveryCallback(t *testing.T) {
	log.Println("********************************* TestFailedFundRecoveryCallback() **************************************")
	transactionResponse.ParentID = testActivityId
	transactionResponse.Status = 2
	transactionResponse.To = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.ContractAddress = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.Hash = "0xeef10fc5170f669b86c4cd0444882a96087221325f8bf2f55d6188633aa7be7c"
	projectActivityId := transactionResponse.ParentID
	targetActivity, err := models.ProjectActivitySearchActivityID(projectActivityId)
	if err != nil {
		log.Fatal(err)
	}

	err = FailedFundRecoveryCallback(transactionResponse, targetActivity)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	project, err := models.ProjectFetchById(targetActivity.ProjectId)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	targetActivities, err := models.ProjectActivitySearchProjectID(testProjectId)
	if err != nil {
		log.Fatal(err)
	}
	length := len(targetActivities) - 1
	if targetActivities[length].Type != constants.FailedFundRecovery {
		t.Error("Project activity was not created")
	}

	if project.Status != constants.ProjectFundsRecovered {
		t.Errorf("Incorrect project status: %d", project.Status)
	}
	log.Println("********************************* End TestFailedFundRecoveryCallback() **************************************")
}

// Tests for utils_commit_moderation_votes.go
func TestCommitModerationVotes(t *testing.T) {
	log.Println("********************************* TestCommitModerationVotes() **************************************")
	var testReq RequestCommitModerationVotes
	testReq.FkProjectId = testProjectId
	testReq.EncryptedVotes = []string{
		"0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353",
		"0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353",
		"0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353",
		"0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353",
		"0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353",
		"0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353",
		"0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353",
	}
	testReq.DecryptionKeys = []string{
		"0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353",
		"0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353",
		"0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353",
		"0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353",
		"0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353",
		"0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353",
		"0x8f4a0d1940bbb011db54926c65572b03fd379cfc3c2da3d5765043dd682dc353",
	}
	err := CommitModerationVotes(testReq)
	if err != nil {
		log.Printf("An error was returned: %d", err)
	}

	transactionType := "COMMIT_MODERATION_VOTES"
	activity, _ := models.ProjectActivitySearchProjectIDTransType(testReq.FkProjectId, transactionType)
	testActivityId = activity[0].Id
	log.Println("********************************* End TestCommitModerationVotes() **************************************")
}

func TestCommitModerationVoteCallback(t *testing.T) {
	log.Println("********************************* TestCommitModerationVoteCallback() **************************************")
	transactionResponse.ParentID = testActivityId
	transactionResponse.Status = 2
	transactionResponse.To = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.ContractAddress = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.Hash = "0xeef10fc5170f669b86c4cd0444882a96087221325f8bf2f55d6188633aa7be7c"
	projectActivityId := transactionResponse.ParentID
	targetActivity, err := models.ProjectActivitySearchActivityID(projectActivityId)
	if err != nil {
		log.Fatal(err)
	}

	err = CommitModerationVotesCallback(transactionResponse, targetActivity)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	project, err := models.ProjectFetchById(targetActivity.ProjectId)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	time.Sleep(2 * time.Second)

	targetActivities, err := models.ProjectActivitySearchProjectID(testProjectId)
	if err != nil {
		log.Fatal(err)
	}
	length := len(targetActivities) - 1
	if targetActivities[length].Type != constants.CancelProject {
		t.Error("Project activity was not created")
	}

	if project.Status != constants.ProjectReadyToCancel {
		t.Errorf("Incorrect project status: %d", project.Status)
	}
	log.Println("********************************* End TestCommitModerationVoteCallback() **************************************")
}

// Tests for utils_release_funds.go for refunds
func TestRequestRefund(t *testing.T) {
	log.Println("********************************* TestRequestRefund() **************************************")
	var testReq RequestReleaseFunds
	testReq.UserId = 321
	testReq.FkProjectId = testProjectId
	testReq.TransactionType = "REQUEST_REFUND"
	err := ReleaseFunds(testReq)
	if err != nil {
		log.Printf("An error was returned: %d", err)
	}

	transactionType := testReq.TransactionType
	activity, _ := models.ProjectActivitySearchProjectIDTransType(testReq.FkProjectId, transactionType)
	testActivityId = activity[0].Id
	log.Println("********************************* End TestRequestRefund() **************************************")
}

func TestRequestRefundCallback(t *testing.T) {
	log.Println("********************************* TestRequestRefundCallback() **************************************")
	transactionResponse.ParentID = testActivityId
	transactionResponse.Status = 2
	transactionResponse.To = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.ContractAddress = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.Hash = "0xeef10fc5170f669b86c4cd0444882a96087221325f8bf2f55d6188633aa7be7c"
	projectActivityId := transactionResponse.ParentID
	var transactionEventsArray []interface{}
	transactionEventsArray = append(transactionEventsArray, []interface{}{"2000", true})
	transactionResponse.TransactionEvents = transactionEventsArray
	targetActivity, err := models.ProjectActivitySearchActivityID(projectActivityId)
	if err != nil {
		log.Fatal(err)
	}

	err = RequestRefundCallback(transactionResponse, targetActivity)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	project, err := models.ProjectFetchById(testProjectId)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	refundCompleted := false
	for _, completed := range project.ActivitiesCompleted {
		if completed == string(constants.RequestRefund) {
			refundCompleted = true
		}
	}

	if refundCompleted == false {
		t.Errorf("Request Refund was not completed successfully")
	}

	log.Println("********************************* End TestRequestRefundCallback() **************************************")
}

// Tests for utils_release_funds.go for withdrawing of project funds
func TestWithdrawFunds(t *testing.T) {
	log.Println("********************************* TestWithdrawFunds() **************************************")
	var testReq RequestReleaseFunds
	testReq.UserId = 123
	testReq.FkProjectId = testProjectId
	testReq.TransactionType = "WITHDRAW_FUNDS"
	err := ReleaseFunds(testReq)
	if err != nil {
		log.Printf("An error was returned: %d", err)
	}

	transactionType := testReq.TransactionType
	activity, _ := models.ProjectActivitySearchProjectIDTransType(testReq.FkProjectId, transactionType)
	testActivityId = activity[0].Id
	log.Println("********************************* End TestWithdrawFunds() **************************************")
}

func TestWithdrawFundsCallback(t *testing.T) {
	log.Println("********************************* TestWithdrawFundsCallback() **************************************")
	transactionResponse.ParentID = testActivityId
	transactionResponse.Status = 2
	transactionResponse.To = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.ContractAddress = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.Hash = "0xeef10fc5170f669b86c4cd0444882a96087221325f8bf2f55d6188633aa7be7c"
	projectActivityId := transactionResponse.ParentID
	var transactionEventsArray []interface{}
	transactionEventsArray = append(transactionEventsArray, []interface{}{"2000", true})
	transactionResponse.TransactionEvents = transactionEventsArray
	targetActivity, err := models.ProjectActivitySearchActivityID(projectActivityId)
	if err != nil {
		log.Fatal(err)
	}

	err = WithdrawFundsCallback(transactionResponse, targetActivity)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	project, err := models.ProjectFetchById(testProjectId)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	withdrawCompleted := false
	for _, completed := range project.ActivitiesCompleted {
		if completed == string(constants.WithdrawFunds) {
			withdrawCompleted = true
		}
	}

	if withdrawCompleted == false {
		t.Errorf("Fund withdrawal was not completed successfully")
	}

	log.Println("********************************* End TestWithdrawFundsCallback() **************************************")
}

// Tests for utils_stake_plg.go
func TestStakePLG(t *testing.T) {
	log.Println("********************************* TestStakePLG() **************************************")
	var testReq RequestStakePLG
	testReq.UserId = 231
	testReq.Amount = 100
	csModel, err := StakePLG(testReq)
	if err != nil {
		log.Printf("An error was returned: %d", err)
	}

	transactionType := string(constants.StakePLG)
	activity, _ := models.CSActivitySearchCsIDTransType(csModel.CSId, transactionType)
	testActivityId = activity[0].Id
	testCSId = csModel.CSId
	log.Println("********************************* End TestStakePLG() **************************************")
}

func TestStakePLGCallback(t *testing.T) {
	log.Println("********************************* TestStakePLGCallback() **************************************")
	transactionResponse.ParentID = testActivityId
	transactionResponse.Status = 2
	transactionResponse.To = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.ContractAddress = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.Hash = "0xeef10fc5170f669b86c4cd0444882a96087221325f8bf2f55d6188633aa7be7c"
	var transactionEventsArray []interface{}
	transactionEventsArray = append(transactionEventsArray, []interface{}{"231", "200"})
	transactionResponse.TransactionEvents = transactionEventsArray
	csActivityId := transactionResponse.ParentID
	targetActivity, err := models.CSActivitySearchActivityID(csActivityId)
	if err != nil {
		log.Fatal(err)
	}

	err = StakePLGCallback(transactionResponse, targetActivity)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	targetActivity, err = models.CSActivitySearchActivityID(csActivityId)
	if err != nil {
		log.Fatal(err)
	}

	if targetActivity.Type != constants.StakePLG {
		t.Error("STAKE_PLG should have been run")
	}
	if targetActivity.Status != constants.ActivitySuccess {
		t.Errorf("Incorrect activity status: %d", targetActivity.Status)
	}

	if targetActivity.Type != constants.StakePLG {
		t.Error("CS activity was not created")
	}

	returnedCS, _ := models.CSSearchCSId(testCSId)
	if returnedCS.Amount <= 0 {
		t.Error("Amount was not updated")
	}
	if returnedCS.BalanceMovement <= 0 {
		t.Error("Balance movement was not updated")
	}

	log.Println("********************************* End TestStakePLGCallback() **************************************")
}

// Tests for utils_unstake_plg.go
func TestUntakePLG(t *testing.T) {
	log.Println("********************************* TestUnstakePLG() **************************************")
	var testReq RequestUnstakePLG
	testReq.UserId = 231
	csModel, err := UnstakePLG(testReq)
	if err != nil {
		log.Printf("An error was returned: %d", err)
	}

	transactionType := string(constants.UnstakePLG)
	activity, _ := models.CSActivitySearchCsIDTransType(csModel.CSId, transactionType)
	testActivityId = activity[0].Id
	testCSId = csModel.CSId
	log.Println("********************************* End TestUnstakePLG() **************************************")
}

func TestUnstakePLGCallback(t *testing.T) {
	log.Println("********************************* TestUnstakePLGCallback() **************************************")
	transactionResponse.ParentID = testActivityId
	transactionResponse.Status = 2
	transactionResponse.To = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.ContractAddress = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.Hash = "0xeef10fc5170f669b86c4cd0444882a96087221325f8bf2f55d6188633aa7be7c"
	var transactionEventsArray []interface{}
	transactionEventsArray = append(transactionEventsArray, []interface{}{"231", "100"})
	transactionResponse.TransactionEvents = transactionEventsArray
	csActivityId := transactionResponse.ParentID
	targetActivity, err := models.CSActivitySearchActivityID(csActivityId)
	if err != nil {
		log.Fatal(err)
	}

	err = UnstakePLGCallback(transactionResponse, targetActivity)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	targetActivity, err = models.CSActivitySearchActivityID(csActivityId)
	if err != nil {
		log.Fatal(err)
	}

	if targetActivity.Type != constants.UnstakePLG {
		t.Error("UNSTAKE_PLG should have been run")
	}
	if targetActivity.Status != constants.ActivitySuccess {
		t.Errorf("Incorrect activity status: %d", targetActivity.Status)
	}

	if targetActivity.Type != constants.UnstakePLG {
		t.Error("CS activity was not created")
	}

	returnedCS, _ := models.CSSearchCSId(testCSId)
	if returnedCS.Amount <= 0 {
		t.Error("Amount was not updated")
	}
	if returnedCS.BalanceMovement >= 0 {
		t.Error("Balance movement was not updated")
	}
	log.Println("********************************* End TestUnstakePLGCallback() **************************************")
}

// Tests for utils_withdraw_interest.go
func TestWithdrawPLG(t *testing.T) {
	log.Println("********************************* RequestWithdrawInterest() **************************************")
	var testReq RequestWithdrawInterest
	testReq.UserId = 231
	csModel, err := WithdrawInterest(testReq)
	if err != nil {
		log.Printf("An error was returned: %d", err)
	}

	transactionType := string(constants.WithdrawInterest)
	activity, _ := models.CSActivitySearchCsIDTransType(csModel.CSId, transactionType)
	testActivityId = activity[0].Id
	testCSId = csModel.CSId
	log.Println("********************************* End RequestWithdrawInterest() **************************************")
}

func TestWithdrawInterestCallback(t *testing.T) {
	log.Println("********************************* TestWithdrawInterestCallback() **************************************")
	transactionResponse.ParentID = testActivityId
	transactionResponse.Status = 2
	transactionResponse.To = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.ContractAddress = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.Hash = "0xeef10fc5170f669b86c4cd0444882a96087221325f8bf2f55d6188633aa7be7c"
	csActivityId := transactionResponse.ParentID
	var transactionEventsArray []interface{}
	transactionEventsArray = append(transactionEventsArray, []interface{}{"231", "100"})
	transactionResponse.TransactionEvents = transactionEventsArray
	targetActivity, err := models.CSActivitySearchActivityID(csActivityId)
	if err != nil {
		log.Fatal(err)
	}

	err = WithdrawInterestCallback(transactionResponse, targetActivity)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	targetActivity, err = models.CSActivitySearchActivityID(csActivityId)
	if err != nil {
		log.Fatal(err)
	}

	if targetActivity.Type != constants.WithdrawInterest {
		t.Error("WITHDRAW_INTEREST should have been run")
	}
	if targetActivity.Status != constants.ActivitySuccess {
		t.Errorf("Incorrect activity status: %d", targetActivity.Status)
	}

	returnedCS, _ := models.CSSearchCSId(testCSId)
	if returnedCS.Amount <= 0 {
		t.Error("Amount was not updated")
	}
	log.Println("********************************* End TestWithdrawInterestCallback() **************************************")
}

// Tests for utils_reinvest_plg.go
func TestReinvestPLG(t *testing.T) {
	log.Println("********************************* TestReinvestPLG() **************************************")
	var testReq RequestReinvestPLG
	testReq.UserId = 231
	csModel, err := ReinvestPLG(testReq)
	if err != nil {
		log.Printf("An error was returned: %d", err)
	}
	transactionType := string(constants.ReinvestPLG)
	activity, _ := models.CSActivitySearchCsIDTransType(csModel.CSId, transactionType)
	testActivityId = activity[0].Id
	testCSId = csModel.CSId
	log.Println("********************************* End TestReinvestPLG() **************************************")
}

func TestReinvestPLGCallback(t *testing.T) {
	log.Println("********************************* TestReinvestPLGCallback() **************************************")
	transactionResponse.ParentID = testActivityId
	transactionResponse.Status = 2
	transactionResponse.To = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.ContractAddress = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.Hash = "0xeef10fc5170f669b86c4cd0444882a96087221325f8bf2f55d6188633aa7be7c"
	var transactionEventsArray []interface{}
	transactionEventsArray = append(transactionEventsArray, []interface{}{"231", "250"})
	transactionEventsArray = append(transactionEventsArray, []interface{}{"231", "744"})
	transactionResponse.TransactionEvents = transactionEventsArray
	csActivityId := transactionResponse.ParentID
	targetActivity, err := models.CSActivitySearchActivityID(csActivityId)
	if err != nil {
		log.Fatal(err)
	}

	err = ReinvestPLGCallback(transactionResponse, targetActivity)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	targetActivity, err = models.CSActivitySearchActivityID(csActivityId)
	if err != nil {
		log.Fatal(err)
	}

	if targetActivity.Type != constants.ReinvestPLG {
		t.Error("REINVEST_PLG should have been run")
	}
	if targetActivity.Status != constants.ActivitySuccess {
		t.Errorf("Incorrect activity status: %d", targetActivity.Status)
	}

	returnedCS, _ := models.CSSearchCSId(testCSId)
	if returnedCS.Amount <= 0 {
		t.Error("Amount was not updated")
	}
	if returnedCS.BalanceMovement <= 0 {
		t.Error("Balance movement was not updated")
	}
	log.Println("********************************* End TestReinvestPLGCallback() **************************************")
}

// Tests for utils_post_interest.go
func TestPostInterest(t *testing.T) {
	log.Println("********************************* TestPostInterest() **************************************")
	var testReq RequestPostInterest
	testReq.Amount = 2000
	csModel, err := PostInterest(testReq)
	if err != nil {
		log.Printf("An error was returned: %d", err)
	}
	transactionType := string(constants.PostInterest)
	activity, _ := models.CSActivitySearchCsIDTransType(csModel.CSId, transactionType)
	testActivityId = activity[0].Id
	testCSId = csModel.CSId
	log.Println("********************************* End TestPostInterest() **************************************")
}

func TestPostInterestCallback(t *testing.T) {
	log.Println("********************************* TestPostInterestCallback() **************************************")
	transactionResponse.ParentID = testActivityId
	transactionResponse.Status = 2
	transactionResponse.To = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.ContractAddress = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.Hash = "0xeef10fc5170f669b86c4cd0444882a96087221325f8bf2f55d6188633aa7be7c"
	var transactionEventsArray []interface{}
	transactionEventsArray = append(transactionEventsArray, "2000")
	transactionResponse.TransactionEvents = transactionEventsArray
	csActivityId := transactionResponse.ParentID
	targetActivity, err := models.CSActivitySearchActivityID(csActivityId)
	if err != nil {
		log.Fatal(err)
	}

	err = PostInterestCallback(transactionResponse, targetActivity)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	targetActivity, err = models.CSActivitySearchActivityID(csActivityId)
	if err != nil {
		log.Fatal(err)
	}
	if targetActivity.Type != constants.PostInterest {
		t.Error("POST_INTEREST should have been run")
	}

	if targetActivity.Status != constants.ActivitySuccess {
		t.Errorf("Incorrect activity status: %d", targetActivity.Status)
	}

	returnedCS, _ := models.CSSearchCSId(testCSId)
	if returnedCS.Amount <= 0 {
		t.Error("Amount was not updated")
	}

	log.Println("********************************* End TestPostInterestCallback() **************************************")
}

// Tests for utils_set_moderators.go
func TestSetModerators(t *testing.T) {
	log.Println("********************************* TestSetModerators() **************************************")
	var testReq RequestSetModerators
	testReq.Moderators = []int64{12345678, 87654321}
	testReq.ModerationEndTime = 1719810543
	testReq.FkProjectId = testProjectId
	err := SetModerators(testReq)
	if err != nil {
		log.Printf("An error was returned: %d", err)
	}

	transactionType := "START_MODERATION"
	activity, _ := models.ProjectActivitySearchProjectIDTransType(testReq.FkProjectId, transactionType)
	testActivityId = activity[0].Id
	log.Println("********************************* End TestSetModerators() **************************************")
}

func TestSetModeratorsCallback(t *testing.T) {
	log.Println("********************************* TestSetModeratorsCallback() **************************************")
	transactionResponse.ParentID = testActivityId
	transactionResponse.Status = 2
	transactionResponse.To = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.ContractAddress = "0x60e3ee943f7045f7fb7348841aa710c129c58667"
	transactionResponse.Hash = "0xeef10fc5170f669b86c4cd0444882a96087221325f8bf2f55d6188633aa7be7c"
	projectActivityId := transactionResponse.ParentID
	targetActivity, err := models.ProjectActivitySearchActivityID(projectActivityId)
	if err != nil {
		log.Fatal(err)
	}

	err = SetModeratorsCallback(transactionResponse, targetActivity)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	project, err := models.ProjectFetchById(targetActivity.ProjectId)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	if project.Status != constants.ProjectModerationPhase {
		t.Errorf("Incorrect project status: %d", project.Status)
	}

	targetActivity, err = models.ProjectActivitySearchActivityID(projectActivityId)
	if err != nil {
		log.Fatal(err)
	}
	if targetActivity.Type != constants.SetModerators {
		t.Error("START_MODERATION should have been run")
	}
	if targetActivity.Status != constants.ActivitySuccess {
		t.Errorf("Incorrect activity status: %d", targetActivity.Status)
	}
	log.Println("********************************* End TestSetModeratorsCallback() **************************************")
}

// Tests for utils_user_balance.go
func TestGetBalance(t *testing.T) {
	log.Println("********************************* TestGetBalance() **************************************")
	var testReq RequestUserBalance
	testReq.UserId = 231
	_, err := GetBalance(testReq)
	if err != nil {
		log.Printf("An error was returned: %d", err)
	}

	log.Println("********************************* End TestGetBalance() **************************************")
}

// Tests for utils_cs_gains.go
func TestGetGains(t *testing.T) {
	log.Println("********************************* TestGetGains() **************************************")
	var testReq RequestCsGains
	testReq.UserId = 231
	_, err := CsGains(testReq)
	if err != nil {
		log.Printf("An error was returned: %d", err)
	}

	log.Println("********************************* End TestGetGains() **************************************")
}

// Tests for utils_project_state.go
func TestProjectGetState(t *testing.T) {
	log.Println("********************************* TestProjectGetState() **************************************")
	var testReq RequestProjectState
	testReq.ProjectId = testProjectId
	_, err := ProjectGetState(testReq)
	if err != nil {
		log.Printf("An error was returned: %d", err)
	}

	_, err = models.ProjectFetchById(testReq.ProjectId)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	log.Println("********************************* End TestProjectGetState() **************************************")
}

// Tests for utils_cs_state.go
func TestCsGetState(t *testing.T) {
	log.Println("********************************* TestCsGetState() **************************************")
	var testReq RequestCsState
	testReq.UserId = 231
	csState, err := CsGetState(testReq)
	if err != nil {
		log.Printf("An error was returned: %d", err)
	}

	var expectedBalance int

	csList, err := models.GetCSByUserId(testReq.UserId)
	if err != nil {
		log.Printf("An error was returned: %d", err)
	}
	log.Println(len(csList), "records returned")

	for _, cs := range csList {
		expectedBalance = expectedBalance + cs.BalanceMovement
	}

	if csState.CurrentBalance != expectedBalance {
		t.Errorf("An error occurred in the calculation of current_balance.  Expected: %v, Retrieved: %v", expectedBalance, csState.CurrentBalance)
	}

	_, err = models.GetCSByUserId(testReq.UserId)
	if err != nil {
		t.Errorf("An error was returned: %d", err)
	}

	log.Println("********************************* End TestCsGetState() **************************************")
}
