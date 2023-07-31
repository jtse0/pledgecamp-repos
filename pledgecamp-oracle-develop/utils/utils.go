package utils

import (
	"github.com/pledgecamp/pledgecamp-oracle/models"
	"github.com/pledgecamp/pledgecamp-oracle/structs"
)

type RequestProjectCreate = structs.RequestProjectCreate
type Project = models.Project
type ProjectParameters = models.ProjectParameters

type ProjectActivity = models.ProjectActivity

type RequestVote = structs.RequestVote
type VotingParameters = models.VoteParameters
type Vote = models.Vote

type RequestSetBackers = structs.RequestSetBackers

type RequestCheckMilestones = structs.RequestCheckMilestones

type RequestCancelProject = structs.RequestCancelProject

type CampShares = models.CampShares
type CSParameters = models.CSParameters

type RequestStakePLG = structs.RequestStakePLG

type RequestUnstakePLG = structs.RequestUnstakePLG

type RequestWithdrawInterest = structs.RequestWithdrawInterest

type RequestReinvestPLG = structs.RequestReinvestPLG

type RequestPostInterest = structs.RequestPostInterest

type RequestSetModerators = structs.RequestSetModerators

type RequestReleaseFunds = structs.RequestReleaseFunds

type RequestFailedFundRecovery = structs.RequestFailedFundRecovery

type RequestCommitModerationVotes = structs.RequestCommitModerationVotes

type RequestSetProjectInfo = structs.RequestSetProjectInfo

type ResponseNodeServerCallback = structs.NodeServerModel

type RequestProjectState = structs.RequestProjectState
type ProjectStateResponse = models.ProjectStateResponse

type RequestCsGains = structs.RequestCsGains
type RequestUserBalance = structs.RequestUserBalance
type RequestCsState = structs.RequestCsState
type CsStateResponse = models.CsStateResponse

var err error
