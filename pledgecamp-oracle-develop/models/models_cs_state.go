package models

// CsStateResponse struct
type CsStateResponse struct {
	UserId           int          `json:"user_id"`
	CurrentBalance   int          `json:"current_balance"`
	UnrealizedGains  int          `json:"unrealized_gains"`
	CsActivitiesList []CSActivity `json:"cs_activities_list"`
}
