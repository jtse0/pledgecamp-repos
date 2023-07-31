package constants

type ActivityStatus int

const (
	ActivityPending      ActivityStatus = 0
	ActivitySuccess      ActivityStatus = 1
	ActivityTimeout      ActivityStatus = 2
	ActivityGasError     ActivityStatus = 3
	ActivityInitialError ActivityStatus = 4
	ActivityReceiptError ActivityStatus = 5
	ActivityPendingError ActivityStatus = 6
)

type ProjectStatus int

const (
	ProjectInactive         ProjectStatus = 0
	ProjectCancelled        ProjectStatus = 1
	ProjectMilestoneFailed  ProjectStatus = 2
	ProjectEnded            ProjectStatus = 3
	ProjectError            ProjectStatus = 4
	ProjectDeployed         ProjectStatus = 5
	ProjectMilestonePhase   ProjectStatus = 6
	ProjectModerationPhase  ProjectStatus = 7
	ProjectReadyToCancel    ProjectStatus = 8
	ProjectFundsRecovered   ProjectStatus = 9
	ProjectMilestoneSuccess ProjectStatus = 10
	ProjectFailed           ProjectStatus = 11
)

type TransactionStatus string

const (
	TransactionStatusInitial        TransactionStatus = "INITIAL"
	TransactionStatusPending        TransactionStatus = "PENDING"
	TransactionStatusSuccess        TransactionStatus = "COMPLETE"
	TransactionStatusFailureInitial TransactionStatus = "FAILED_INITIAL"
	TransactionStatusFailureReceipt TransactionStatus = "FAILED_RECEIPT"
	TransactionStatusFailureTimeout TransactionStatus = "FAILED_TIMEOUT"
	TransactionStatusFailurePending TransactionStatus = "FAILED_PENDING"
)
