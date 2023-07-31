package utils

import (
	"encoding/json"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"regexp"

	"github.com/joho/godotenv"
	"github.com/pledgecamp/pledgecamp-oracle/structs"
)

func init() {
	godotenv.Load("../.env")
	if err != nil {
		log.Fatal("Main - No .env file found ;)")
	}
}

func NodeServerResponseStub() (structs.NodeServerModel, error) {
	var resp structs.NodeServerModel
	log.Println("Inside NodeserverResponseStub")

	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("Going into NODESERVER path %v", r.RequestURI)

		matchMilestoneVote, _ := regexp.MatchString("/api/manager/projects/.*/MILESTONE_VOTE/.*", r.RequestURI)
		var matchMilestoneVoteURI string
		matchCancelVote, _ := regexp.MatchString("/api/manager/projects/.*/MODERATION_VOTE/.*", r.RequestURI)
		var matchCancelVoteURI string
		matchBackers, _ := regexp.MatchString("/api/manager/projects/.*/SET_BACKERS", r.RequestURI)
		var matchBackersURI string
		matchCancel, _ := regexp.MatchString("/api/moderator/projects/.*/CANCEL_PROJECT", r.RequestURI)
		var matchCancelURI string
		matchCheckMilestone, _ := regexp.MatchString("/api/projects/.*/CHECK_MILESTONE", r.RequestURI)
		var matchCheckMilestoneURI string
		matchFundsRecovery, _ := regexp.MatchString("/api/projects/2/FAILED_FUND_RECOVERY", r.RequestURI)
		var matchFundsRecoveryURI string
		matchCommitModVotes, _ := regexp.MatchString("/api/moderator/projects/.*/COMMIT_MODERATION_VOTES", r.RequestURI)
		var matchCommitModVotesURI string
		matchRequestRefund, _ := regexp.MatchString("/api/manager/projects/.*/REQUEST_REFUND", r.RequestURI)
		var matchRequestRefundURI string
		matchWithdrawFunds, _ := regexp.MatchString("/api/manager/projects/.*/WITHDRAW_FUNDS", r.RequestURI)
		var matchWithdrawFundsURI string
		matchStakePLG, _ := regexp.MatchString("/api/manager/cs/.*/STAKE_PLG", r.RequestURI)
		var matchStakePlgURI string
		matchUnstakePLG, _ := regexp.MatchString("/api/manager/cs/.*/UNSTAKE_PLG", r.RequestURI)
		var matchUnstakePlgURI string
		matchWithdrawInterest, _ := regexp.MatchString("/api/manager/cs/.*/WITHDRAW_INTEREST", r.RequestURI)
		var matchWithdrawInterestURI string
		matchReinvestPlg, _ := regexp.MatchString("/api/manager/cs/.*/REINVEST_PLG", r.RequestURI)
		var matchReinvestPlgURI string
		matchPostInterest, _ := regexp.MatchString("/api/cs/POST_INTEREST", r.RequestURI)
		var matchPostInterestURI string
		matchSetModerators, _ := regexp.MatchString("/api/cs/projects/.*/START_MODERATION", r.RequestURI)
		var matchSetModeratorsURI string
		matchSetProjectInfo, _ := regexp.MatchString("/api/admin/projects/.*/SET_PROJECT_INFO", r.RequestURI)
		var matchSetProjectInfoURI string
		matchCreateProject, _ := regexp.MatchString("/api/projects/.*", r.RequestURI)
		var matchCreateProjectURI string

		if matchMilestoneVote {
			matchMilestoneVoteURI = r.RequestURI
		} else if matchCancelVote {
			matchCancelVoteURI = r.RequestURI
		} else if matchBackers {
			matchBackersURI = r.RequestURI
		} else if matchCancel {
			matchCancelURI = r.RequestURI
		} else if matchCheckMilestone {
			matchCheckMilestoneURI = r.RequestURI
		} else if matchFundsRecovery {
			matchFundsRecoveryURI = r.RequestURI
		} else if matchCommitModVotes {
			matchCommitModVotesURI = r.RequestURI
		} else if matchRequestRefund {
			matchRequestRefundURI = r.RequestURI
		} else if matchWithdrawFunds {
			matchWithdrawFundsURI = r.RequestURI
		} else if matchStakePLG {
			matchStakePlgURI = r.RequestURI
		} else if matchUnstakePLG {
			matchUnstakePlgURI = r.RequestURI
		} else if matchWithdrawInterest {
			matchWithdrawInterestURI = r.RequestURI
		} else if matchReinvestPlg {
			matchReinvestPlgURI = r.RequestURI
		} else if matchPostInterest {
			matchPostInterestURI = r.RequestURI
		} else if matchSetModerators {
			matchSetModeratorsURI = r.RequestURI
		} else if matchSetProjectInfo {
			matchSetProjectInfoURI = r.RequestURI
		} else if matchCreateProject {
			matchCreateProjectURI = r.RequestURI
		}

		switch r.RequestURI {
		case matchCheckMilestoneURI:
			log.Println("Check Milestone")
			resp.UUID = "e0f707e2-a823-41c8-82b3-bc71c33f82cc"
			resp.ParentID = 100123
			resp.Type = "CHECK_MILESTONE"
			resp.Callback = os.Getenv("APP_DOMAIN") + "/projects/123/callback/CHECK_MILESTONE"
			resp.Serialized = "0xf93c6d8080836691b28080b93c1f608060405260006007556000"
			resp.Status = 0

			log.Printf("%v - generating response", r.URL.RequestURI())
			log.Println(resp)

			// Return server response using http.ResponseWriter
			serverResp, err := json.Marshal(resp)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			// Generate response
			w.Write(serverResp)
		case matchCancelURI:
			log.Println("Cancel Project")
			resp.UUID = "e0f707e2-a823-41c8-82b3-bc71c33f82cc"
			resp.ParentID = 100123
			resp.Type = "CANCEL_PROJECT"
			resp.Callback = os.Getenv("APP_DOMAIN") + "/projects/123/callback/CANCEL_PROJECT"
			resp.Serialized = "0xf93c6d8080836691b28080b93c1f608060405260006007556000"
			resp.Status = 0

			log.Printf("%v - generating response", r.URL.RequestURI())
			log.Println(resp)

			// Return server response using http.ResponseWriter
			serverResp, err := json.Marshal(resp)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			// Generate response
			w.Write(serverResp)
		case matchMilestoneVoteURI:
			log.Println("Milestone Vote")
			resp.UUID = "e0f707e2-a823-41c8-82b3-bc71c33f82cc"
			resp.ParentID = 100123
			resp.Type = "MILESTONE_VOTE"
			resp.Callback = os.Getenv("APP_DOMAIN") + "/manager/projects/123/callback/MILESTONE_VOTE"
			resp.Serialized = "0xf93c6d8080836691b28080b93c1f608060405260006007556000"
			resp.Status = 0

			log.Printf("%v - generating response", r.URL.RequestURI())
			log.Println(resp)

			// Return server response using http.ResponseWriter
			serverResp, err := json.Marshal(resp)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			// Generate response
			w.Write(serverResp)

		case matchCancelVoteURI:
			log.Println("Moderation Vote")
			resp.UUID = "e0f707e2-a823-41c8-82b3-bc71c33f82cc"
			resp.ParentID = 100123
			resp.Type = "MODERATION_VOTE"
			resp.Callback = os.Getenv("APP_DOMAIN") + "/projects/123/callback/MODERATION_VOTE"
			resp.Serialized = "0xf93c6d8080836691b28080b93c1f608060405260006007556000"
			resp.Status = 0

			log.Printf("%v - generating response", r.URL.RequestURI())
			log.Println(resp)

			// Return server response using http.ResponseWriter
			serverResp, err := json.Marshal(resp)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			// Generate response
			w.Write(serverResp)

		case matchBackersURI:
			log.Println("Set Backers")
			resp.UUID = "e0f707e2-a823-41c8-82b3-bc71c33f82cc"
			resp.ParentID = 100123
			resp.Type = "SET_BACKERS"
			resp.Callback = os.Getenv("APP_DOMAIN") + "/projects/123/callback/SET_BACKERS"
			resp.Serialized = "0xf93c6d8080836691b28080b93c1f608060405260006007556000"
			resp.Status = 0

			log.Printf("%v - generating response", r.URL.RequestURI())
			log.Println(resp)

			// Return server response using http.ResponseWriter
			serverResp, err := json.Marshal(resp)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			// Generate response
			w.Write(serverResp)

		case matchCreateProjectURI:
			log.Println("Create Project")
			resp.UUID = "e0f707e2-a823-41c8-82b3-bc71c33f82cc"
			resp.ParentID = 100123
			resp.Type = "PROJECT_DEPLOY"
			resp.Callback = os.Getenv("APP_DOMAIN") + "/projects/123/callback/PROJECT_DEPLOY"
			resp.Serialized = "0xf93c6d8080836691b28080b93c1f608060405260006007556000"
			resp.Status = 0

			log.Printf("%v - generating response", r.URL.RequestURI())
			log.Println(resp)

			// Return server response using http.ResponseWriter
			serverResp, err := json.Marshal(resp)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			// Generate response
			w.Write(serverResp)

		case matchFundsRecoveryURI:
			log.Println("Failed Fund Recovery")
			resp.UUID = "e0f707e2-a823-41c8-82b3-bc71c33f82cc"
			resp.ParentID = 100125
			resp.Type = "FAILED_FUND_RECOVERY"
			resp.Callback = os.Getenv("APP_DOMAIN") + "/projects/123/callback/FAILED_FUND_RECOVERY"
			resp.Serialized = "0xf93c6d8080836691b28080b93c1f608060405260006007556000"
			resp.Status = 0

			log.Printf("%v - generating response", r.URL.RequestURI())
			log.Println(resp)

			// Return server response using http.ResponseWriter
			serverResp, err := json.Marshal(resp)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			// Generate response
			w.Write(serverResp)
		case matchCommitModVotesURI:
			log.Println("Commit Moderation Votes")
			resp.UUID = "e0f707e2-a823-41c8-82b3-bc71c33f82cc"
			resp.ParentID = 100124
			resp.Type = "COMMIT_MODERATION_VOTES"
			resp.Callback = os.Getenv("APP_DOMAIN") + "/projects/123/callback/COMMIT_MODERATION_VOTES"
			resp.Serialized = "0xf93c6d8080836691b28080b93c1f608060405260006007556000"
			resp.Status = 0

			log.Printf("%v - generating response", r.URL.RequestURI())
			log.Println(resp)

			// Return server response using http.ResponseWriter
			serverResp, err := json.Marshal(resp)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			// Generate response
			w.Write(serverResp)
		case matchRequestRefundURI:
			log.Println("Request Refund")
			resp.UUID = "e0f707e2-a823-41c8-82b3-bc71c33f82cc"
			resp.ParentID = 100124
			resp.Type = "REQUEST_REFUND"
			resp.Callback = os.Getenv("APP_DOMAIN") + "/projects/callback/REQUEST_REFUND"
			resp.Serialized = "0xf93c6d8080836691b28080b93c1f608060405260006007556000"
			resp.Status = 0

			log.Printf("%v - generating response", r.URL.RequestURI())
			log.Println(resp)

			// Return server response using http.ResponseWriter
			serverResp, err := json.Marshal(resp)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			// Generate response
			w.Write(serverResp)
		case matchWithdrawFundsURI:
			log.Println("Withdraw Funds")
			resp.UUID = "e0f707e2-a823-41c8-82b3-bc71c33f82cc"
			resp.ParentID = 100124
			resp.Type = "WITHDRAW_FUNDS"
			resp.Callback = os.Getenv("APP_DOMAIN") + "/projects/123/callback/WITHDRAW_FUNDS"
			resp.Serialized = "0xf93c6d8080836691b28080b93c1f608060405260006007556000"
			resp.Status = 0

			log.Printf("%v - generating response", r.URL.RequestURI())
			log.Println(resp)

			// Return server response using http.ResponseWriter
			serverResp, err := json.Marshal(resp)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			// Generate response
			w.Write(serverResp)
		case matchStakePlgURI:
			log.Println("Stake PLG")
			resp.UUID = "e0f707e2-a823-41c8-82b3-bc71c33f82cc"
			resp.ParentID = 100124
			resp.Type = "STAKE_PLG"
			resp.Callback = os.Getenv("APP_DOMAIN") + "/cs/123/callback/STAKE_PLG"
			resp.Serialized = "0xf93c6d8080836691b28080b93c1f608060405260006007556000"
			resp.Status = 0

			log.Printf("%v - generating response", r.URL.RequestURI())
			log.Println(resp)

			// Return server response using http.ResponseWriter
			serverResp, err := json.Marshal(resp)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			// Generate response
			w.Write(serverResp)
		case matchUnstakePlgURI:
			log.Println("Unstake PLG")
			resp.UUID = "e0f707e2-a823-41c8-82b3-bc71c33f82cc"
			resp.ParentID = 100124
			resp.Type = "UNSTAKE_PLG"
			resp.Callback = os.Getenv("APP_DOMAIN") + "/cs/321/callback/UNSTAKE_PLG"
			resp.Serialized = "0xf93c6d8080836691b28080b93c1f608060405260006007556000"
			resp.Status = 0

			log.Printf("%v - generating response", r.URL.RequestURI())
			log.Println(resp)

			// Return server response using http.ResponseWriter
			serverResp, err := json.Marshal(resp)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			// Generate response
			w.Write(serverResp)
		case matchWithdrawInterestURI:
			log.Println("Withdraw INTEREST")
			resp.UUID = "e0f707e2-a823-41c8-82b3-bc71c33f82cc"
			resp.ParentID = 100124
			resp.Type = "WITHDRAW_INTEREST"
			resp.Callback = os.Getenv("APP_DOMAIN") + "/cs/321/callback/WITHDRAW_INTEREST"
			resp.Serialized = "0xf93c6d8080836691b28080b93c1f608060405260006007556000"
			resp.Status = 0

			log.Printf("%v - generating response", r.URL.RequestURI())
			log.Println(resp)

			// Return server response using http.ResponseWriter
			serverResp, err := json.Marshal(resp)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			// Generate response
			w.Write(serverResp)
		case matchReinvestPlgURI:
			log.Println("Reinvest PLG Interest")
			resp.UUID = "e0f707e2-a823-41c8-82b3-bc71c33f82cc"
			resp.ParentID = 100124
			resp.Type = "REINVEST_PLG"
			resp.Callback = os.Getenv("APP_DOMAIN") + "/cs/321/callback/REINVEST_PLG"
			resp.Serialized = "0xf93c6d8080836691b28080b93c1f608060405260006007556000"
			resp.Status = 0

			log.Printf("%v - generating response", r.URL.RequestURI())
			log.Println(resp)

			// Return server response using http.ResponseWriter
			serverResp, err := json.Marshal(resp)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			// Generate response
			w.Write(serverResp)
		case matchPostInterestURI:
			log.Println("Post Interest")
			resp.UUID = "e0f707e2-a823-41c8-82b3-bc71c33f82cc"
			resp.ParentID = 100124
			resp.Type = "POST_INTEREST"
			resp.Callback = os.Getenv("APP_DOMAIN") + "/cs/0/callback/POST_INTEREST"
			resp.Serialized = "0xf93c6d8080836691b28080b93c1f608060405260006007556000"
			resp.Status = 0

			log.Printf("%v - generating response", r.URL.RequestURI())
			log.Println(resp)

			// Return server response using http.ResponseWriter
			serverResp, err := json.Marshal(resp)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			// Generate response
			w.Write(serverResp)
		case matchSetModeratorsURI:
			log.Println("Set Moderators")
			resp.UUID = "e0f707e2-a823-41c8-82b3-bc71c33f82cc"
			resp.ParentID = 100124
			resp.Type = "START_MODERATION"
			resp.Callback = os.Getenv("APP_DOMAIN") + "/projects/123/callback/START_MODERATION"
			resp.Serialized = "0xf93c6d8080836691b28080b93c1f608060405260006007556000"
			resp.Status = 0

			log.Printf("%v - generating response", r.URL.RequestURI())
			log.Println(resp)

			// Return server response using http.ResponseWriter
			serverResp, err := json.Marshal(resp)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			// Generate response
			w.Write(serverResp)
		case matchSetProjectInfoURI:
			log.Println("Set Project Info")
			resp.UUID = "e0f707e2-a823-41c8-82b3-bc71c33f82cc"
			resp.ParentID = 100124
			resp.Type = "SET_PROJECT_INFO"
			resp.Callback = os.Getenv("APP_DOMAIN") + "/projects/123/callback/SET_PROJECT_INFO"
			resp.Serialized = "0xf93c6d8080836691b28080b93c1f608060405260006007556000"
			resp.Status = 0

			log.Printf("%v - generating response", r.URL.RequestURI())
			log.Println(resp)

			// Return server response using http.ResponseWriter
			serverResp, err := json.Marshal(resp)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			// Generate response
			w.Write(serverResp)

		default:
			log.Println("Default skill")
			log.Print(r.RequestURI)
			http.Error(w, "not found", http.StatusNotFound)
			return
		}

	}))

	log.Println("**********NodeserverTestServer")
	// log.Println(testServer)
	defer testServer.Close()

	go http.ListenAndServe(":3010", testServer.Config.Handler)

	log.Println(resp)
	return resp, nil
}

func BackendResponseStub() error {
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("Going into BACKEND path %v", r.RequestURI)
		matchCreateProject, _ := regexp.MatchString("/events/blockchain/projects/.*/PROJECT_CREATE", r.RequestURI)
		var matchCreateProjectURI string
		matchMilestoneVote, _ := regexp.MatchString("/events/blockchain/projects/.*/PROJECT_MILESTONE_VOTE", r.RequestURI)
		var matchMilestoneVoteURI string
		matchCancelVote, _ := regexp.MatchString("/events/blockchain/projects/.*/PROJECT_MODERATION_VOTE", r.RequestURI)
		var matchCancelVoteURI string
		matchBackers, _ := regexp.MatchString("/events/blockchain/projects/.*/PROJECT_COMPLETE", r.RequestURI)
		var matchBackersURI string
		matchCancel, _ := regexp.MatchString("/events/blockchain/projects/.*/PROJECT_END_MODERATION", r.RequestURI)
		var matchCancelURI string
		matchCheckMilestone, _ := regexp.MatchString("/events/blockchain/projects/.*/PROJECT_CHECK_MILESTONE", r.RequestURI)
		var matchCheckMilestoneURI string
		matchInitiateMilestone, _ := regexp.MatchString("/events/blockchain/projects/.*/INITIATE_MILESTONE", r.RequestURI)
		var matchInitiateMilestoneURI string
		matchFundsRecovery, _ := regexp.MatchString("/events/blockchain/projects/.*/PROJECT_FAILED_FUND_RECOVERY", r.RequestURI)
		var matchFundsRecoveryURI string
		matchCommitModVotes, _ := regexp.MatchString("/events/blockchain/projects/.*/COMMIT_MODERATION_VOTES", r.RequestURI)
		var matchCommitModVotesURI string
		matchRequestRefund, _ := regexp.MatchString("/events/blockchain/projects/.*/PROJECT_FUND_WITHDRAWAL", r.RequestURI)
		var matchRequestRefundURI string
		matchWithdrawFunds, _ := regexp.MatchString("/events/blockchain/projects/.*/PROJECT_FUND_WITHDRAWAL", r.RequestURI)
		var matchWithdrawFundsURI string
		matchStakePLG, _ := regexp.MatchString("/events/blockchain/cs/.*/CS_STAKE_PLG", r.RequestURI)
		var matchStakePlgURI string
		matchUnstakePLG, _ := regexp.MatchString("/events/blockchain/cs/.*/CS_UNSTAKE_PLG", r.RequestURI)
		var matchUnstakePlgURI string
		matchWithdrawInterest, _ := regexp.MatchString("/events/blockchain/cs/.*/CS_WITHDRAW_INTEREST", r.RequestURI)
		var matchWithdrawInterestURI string
		matchReinvestPlg, _ := regexp.MatchString("/events/blockchain/cs/.*/CS_REINVEST_PLG", r.RequestURI)
		var matchReinvestPlgURI string
		matchPostInterest, _ := regexp.MatchString("/events/blockchain/cs/CS_POST_INTEREST", r.RequestURI)
		var matchPostInterestURI string
		matchSetModerators, _ := regexp.MatchString("/events/blockchain/projects/.*/PROJECT_START_MODERATION", r.RequestURI)
		var matchSetModeratorsURI string
		matchSetProjectInfo, _ := regexp.MatchString("/events/blockchain/projects/.*/SET_PROJECT_INFO", r.RequestURI)
		var matchSetProjectInfoURI string

		if matchCreateProject {
			matchCreateProjectURI = r.RequestURI
		} else if matchMilestoneVote {
			matchMilestoneVoteURI = r.RequestURI
		} else if matchCancelVote {
			matchCancelVoteURI = r.RequestURI
		} else if matchBackers {
			matchBackersURI = r.RequestURI
		} else if matchCancel {
			matchCancelURI = r.RequestURI
		} else if matchCheckMilestone {
			matchCheckMilestoneURI = r.RequestURI
		} else if matchInitiateMilestone {
			matchInitiateMilestoneURI = r.RequestURI
		} else if matchFundsRecovery {
			matchFundsRecoveryURI = r.RequestURI
		} else if matchCommitModVotes {
			matchCommitModVotesURI = r.RequestURI
		} else if matchRequestRefund {
			matchRequestRefundURI = r.RequestURI
		} else if matchWithdrawFunds {
			matchWithdrawFundsURI = r.RequestURI
		} else if matchStakePLG {
			matchStakePlgURI = r.RequestURI
		} else if matchUnstakePLG {
			matchUnstakePlgURI = r.RequestURI
		} else if matchWithdrawInterest {
			matchWithdrawInterestURI = r.RequestURI
		} else if matchReinvestPlg {
			matchReinvestPlgURI = r.RequestURI
		} else if matchPostInterest {
			matchPostInterestURI = r.RequestURI
		} else if matchSetModerators {
			matchSetModeratorsURI = r.RequestURI
		} else if matchSetProjectInfo {
			matchSetProjectInfoURI = r.RequestURI
		}

		switch r.RequestURI {
		case matchCreateProjectURI:
			resp := "Project Created Ok"
			w.WriteHeader(http.StatusOK)
			// Generate response
			w.Write([]byte(resp))
		case matchMilestoneVoteURI:
			resp := "Milestone Vote Ok"
			w.WriteHeader(http.StatusOK)
			// Generate response
			w.Write([]byte(resp))
		case matchCancelVoteURI:
			resp := "Moderation Vote Ok"
			w.WriteHeader(http.StatusOK)
			// Generate response
			w.Write([]byte(resp))
		case matchBackersURI:
			resp := "Set Backers Ok"
			w.WriteHeader(http.StatusOK)
			// Generate response
			w.Write([]byte(resp))
		case matchCancelURI:
			resp := "Project Cancelled Ok"
			w.WriteHeader(http.StatusOK)
			// Generate response
			w.Write([]byte(resp))
		case matchCheckMilestoneURI:
			resp := "Check Milestones Ok"
			w.WriteHeader(http.StatusOK)
			// Generate response
			w.Write([]byte(resp))
		case matchInitiateMilestoneURI:
			resp := "Initiate Milestones Ok"
			w.WriteHeader(http.StatusOK)
			// Generate response
			w.Write([]byte(resp))
		case matchFundsRecoveryURI:
			resp := "Failed Funds Recovery Ok"
			w.WriteHeader(http.StatusOK)
			// Generate response
			w.Write([]byte(resp))
		case matchCommitModVotesURI:
			resp := "Commit Moderation Votes Ok"
			w.WriteHeader(http.StatusOK)
			// Generate response
			w.Write([]byte(resp))
		case matchRequestRefundURI:
			resp := "Request Refunds Ok"
			w.WriteHeader(http.StatusOK)
			// Generate response
			w.Write([]byte(resp))
		case matchWithdrawFundsURI:
			resp := "Withdraw Funds Ok"
			w.WriteHeader(http.StatusOK)
			// Generate response
			w.Write([]byte(resp))
		case matchStakePlgURI:
			resp := "Stage PLG Tokens Ok"
			w.WriteHeader(http.StatusOK)
			// Generate response
			w.Write([]byte(resp))
		case matchUnstakePlgURI:
			resp := "Unstage PLG Tokens Ok"
			w.WriteHeader(http.StatusOK)
			// Generate response
			w.Write([]byte(resp))
		case matchWithdrawInterestURI:
			resp := "Withdraw Interest Tokens Ok"
			w.WriteHeader(http.StatusOK)
			// Generate response
			w.Write([]byte(resp))
		case matchReinvestPlgURI:
			resp := "Reinvest PLG Ok"
			w.WriteHeader(http.StatusOK)
			// Generate response
			w.Write([]byte(resp))
		case matchPostInterestURI:
			resp := "Post Interest Ok"
			w.WriteHeader(http.StatusOK)
			// Generate response
			w.Write([]byte(resp))
		case matchSetModeratorsURI:
			resp := "Set Moderators Ok"
			w.WriteHeader(http.StatusOK)
			// Generate response
			w.Write([]byte(resp))
		case matchSetProjectInfoURI:
			resp := "Set Project Info Ok"
			w.WriteHeader(http.StatusOK)
			// Generate response
			w.Write([]byte(resp))
		case "/api/projects/":
			resp := "Test Ok"
			w.WriteHeader(http.StatusOK)
			// Generate response
			w.Write([]byte(resp))
		default:
			log.Println("Default skill")
			log.Print(r.RequestURI)
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
	}))

	log.Println("**********BackendTestServer")
	// log.Println(testServer)
	defer testServer.Close()

	go http.ListenAndServe(":5010", testServer.Config.Handler)

	return nil
}
