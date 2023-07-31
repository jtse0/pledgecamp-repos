package models

import (
	"time"

	"github.com/lib/pq"
)

// ProjectStateResponse struct
type ProjectStateResponse struct {
	ProjectId             int               `json:"project_id"`
	ContractAddress       string            `json:"contract_address"`
	CreatedAt             time.Time         `json:"created_at"`
	ModifiedAt            time.Time         `json:"modified_at"`
	CompletedAt           time.Time         `json:"completed_at"`
	NextActivityDate      time.Time         `json:"next_activity_date"`
	ActivitiesCompleted   pq.StringArray    `json:"activities_completed"`
	ProjectActivitiesList []ProjectActivity `json:"project_activities_list"`
}
