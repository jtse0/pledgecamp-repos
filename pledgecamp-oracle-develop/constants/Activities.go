package constants

import "errors"

type ActivityReference string

// Event Type
const (
	ProjectCreate           ActivityReference = "PROJECT_CREATE"
	ProjectComplete         ActivityReference = "PROJECT_COMPLETE"
	MilestoneRelease        ActivityReference = "PROJECT_CHECK_MILESTONE"
	FundWithdrawal          ActivityReference = "PROJECT_FUND_WITHDRAWAL"
	StartModeration         ActivityReference = "PROJECT_START_MODERATION"
	EndModeration           ActivityReference = "PROJECT_END_MODERATION"
	FailedFundRecoveryEvent ActivityReference = "PROJECT_FAILED_FUND_RECOVERY"
	MilestoneVoteEvent      ActivityReference = "PROJECT_MILESTONE_VOTE"
	ModerationVoteEvent     ActivityReference = "PROJECT_MODERATION_VOTE"
	GetBalanceEvent         ActivityReference = "PROJECT_GET_USER_BALANCE"
	StakePLGEvent           ActivityReference = "CS_STAKE_PLG"
	UnstakePLGEvent         ActivityReference = "CS_UNSTAKE_PLG"
	WithdrawInterestEvent   ActivityReference = "CS_WITHDRAW_INTEREST"
	ReinvestPLGEvent        ActivityReference = "CS_REINVEST_PLG"
	PostInterestEvent       ActivityReference = "CS_POST_INTEREST"
	GetGainsEvent           ActivityReference = "CS_GET_GAINS"
)

// Activity Type
const (
	ProjectDeploy      ActivityReference = "PROJECT_DEPLOY"
	SetBackers         ActivityReference = "SET_BACKERS"
	MilestoneVote      ActivityReference = "MILESTONE_VOTE"
	CheckMilestone     ActivityReference = "CHECK_MILESTONE"
	InitiateMilestone  ActivityReference = "INITIATE_MILESTONE"
	RequestRefund      ActivityReference = "REQUEST_REFUND"
	WithdrawFunds      ActivityReference = "WITHDRAW_FUNDS"
	ModerationVote     ActivityReference = "MODERATION_VOTE"
	CancelProject      ActivityReference = "CANCEL_PROJECT"
	SetModerators      ActivityReference = "START_MODERATION"
	FailedFundRecovery ActivityReference = "FAILED_FUND_RECOVERY"
	StakePLG           ActivityReference = "STAKE_PLG"
	UnstakePLG         ActivityReference = "UNSTAKE_PLG"
	WithdrawInterest   ActivityReference = "WITHDRAW_INTEREST"
	ReinvestPLG        ActivityReference = "REINVEST_PLG"
	PostInterest       ActivityReference = "POST_INTEREST"
	GetGains           ActivityReference = "GET_GAINS"
	GetBalance         ActivityReference = "GET_BALANCE"
	CommitFinalVotes   ActivityReference = "COMMIT_MODERATION_VOTES"
	SetProjectInfo     ActivityReference = "SET_PROJECT_INFO"
)

var TransactionToEvent = map[ActivityReference]ActivityReference{
	ProjectDeploy:      ProjectCreate,
	SetBackers:         ProjectComplete,
	SetProjectInfo:     ProjectCreate,
	SetModerators:      StartModeration,
	CommitFinalVotes:   EndModeration,
	CancelProject:      EndModeration,
	MilestoneVote:      MilestoneVoteEvent,
	ModerationVote:     ModerationVoteEvent,
	CheckMilestone:     MilestoneRelease,
	WithdrawFunds:      FundWithdrawal,
	RequestRefund:      FundWithdrawal,
	StakePLG:           StakePLGEvent,
	UnstakePLG:         UnstakePLGEvent,
	WithdrawInterest:   WithdrawInterestEvent,
	ReinvestPLG:        ReinvestPLGEvent,
	PostInterest:       PostInterestEvent,
	GetGains:           GetGainsEvent,
	GetBalance:         GetBalanceEvent,
	FailedFundRecovery: FailedFundRecoveryEvent,
}

func GetEventType(transactionType ActivityReference) (ActivityReference, error) {
	if eventType, exists := TransactionToEvent[transactionType]; exists {
		return eventType, nil
	}
	return transactionType, errors.New("Error getting Event Type")
}
