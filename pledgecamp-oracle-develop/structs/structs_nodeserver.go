package structs

type StatusIndex int

const (
	Initial StatusIndex = iota
	Pending
	Complete
	FailedTimeout
	FailedGas
	FailedInitial
	FailedReceipt
	FailedPending
)

// Based on the event_type then cast the rest to the structure
type NodeServerModel struct {
	UUID              string      `json:"transaction_uuid"`
	ParentID          int         `json:"transaction_parent_id"`
	Type              string      `json:"transaction_type"`
	Callback          string      `json:"transaction_callback"`
	Hash              string      `json:"transaction_hash"`
	Serialized        string      `json:"transaction_serialized"`
	Index             int         `json:"transaction_index"`
	Status            StatusIndex `json:"transaction_status"`
	To                string      `json:"transaction_to"`
	From              string      `json:"transaction_from"`
	ContractAddress   string      `json:"transaction_contract_address"`
	BlockNumber       int         `json:"transaction_block_number"`
	GasUsed           int         `json:"transaction_gas_used"`
	RetryAttempts     int         `json:"transaction_retry_attempts"`
	TransactionEvents interface{} `json:"transaction_events"`
}
