package structs

// RequestProjectState struct
type RequestProjectState struct {
	ProjectId int `json:"project_id" binding:"required"`
}

// RequestCsState struct
type RequestCsState struct {
	UserId int `json:"user_id" binding:"required"`
}

// RequestCsGains struct
type RequestCsGains struct {
	UserId int `json:"user_id" binding:"required"`
}

// RequestUserBalance struct
type RequestUserBalance struct {
	UserId int `json:"user_id" binding:"required"`
}

// RequestProjectCreate struct
type RequestProjectCreate struct {
	ProjectId       int     `json:"project_id" binding:"required"`
	Milestones      []int64 `json:"milestones" pg:",array"`
	ReleasePercents []int64 `json:"release_percents" pg:",array"`
	Creator         int64   `json:"creator" binding:"required"`
}

type RequestSetBackers struct {
	FkProjectId     int     `json:"fk_project_id"  binding:"required"`
	Beneficiaries   []int64 `json:"beneficiaries" pg:",array"`
	Amounts         []int64 `json:"amounts" pg:",array"`
	FundingComplete bool    `json:"funding_complete"`
	TotalAmount     int64   `json:"total_amount"`
}

type RequestSetProjectInfo struct {
	FkProjectId     int     `json:"fk_project_id" binding:"required"`
	ListingFee      int64   `json:"listing_fee"`
	TotalRaised     int64   `json:"total_raised" binding:"required"`
	Beneficiaries   []int64 `json:"beneficiaries" pg:",array"`
	Amounts         []int64 `json:"amounts" pg:",array"`
	FundingComplete bool    `json:"funding_complete"`
	TotalAmount     int64   `json:"total_amount"`
}

type RequestVote struct {
	UserId        int    `json:"user_id" binding:"required"`
	Vote          bool   `json:"vote"`
	DecryptionKey string `json:"decryption_key"`
	VoteType      int    `json:"vote_type"`
	FkProjectId   int    `json:"fk_project_id"  binding:"required"`
}

type RequestCheckMilestones struct {
	FkProjectId int `json:"fk_project_id" binding:"required"`
}

type RequestSetModerators struct {
	Moderators        []int64 `json:"moderators" pg:",array"`
	ModerationEndTime int64   `json:"moderation_end_time"`
	FkProjectId       int     `json:"fk_project_id" binding:"required"`
}

type RequestCommitModerationVotes struct {
	FkProjectId    int      `json:"fk_project_id" binding:"required"`
	EncryptedVotes []string `json:"encrypted_votes"`
	DecryptionKeys []string `json:"decryption_keys"`
}

type RequestCancelProject struct {
	FkProjectId int `json:"fk_project_id" binding:"required"`
}

type RequestReleaseFunds struct {
	UserId          int    `json:"user_id" binding: "required"`
	FkProjectId     int    `json:"fk_project_id" binding:"required"`
	TransactionType string `json:"transaction_type"`
}

type RequestFailedFundRecovery struct {
	FkProjectId int `json:"fk_project_id" binding:"required"`
}

type RequestStakePLG struct {
	UserId int `json:"user_id" binding: "required"`
	Amount int `json:"amount" binding: "required"`
}

type RequestUnstakePLG struct {
	UserId int `json:"user_id" binding: "required"`
}

type RequestWithdrawInterest struct {
	UserId int `json:"user_id" binding: "required"`
}

type RequestReinvestPLG struct {
	UserId int `json:"user_id" binding: "required"`
}

type RequestPostInterest struct {
	Amount int `json:"amount" binding: "required"`
}
