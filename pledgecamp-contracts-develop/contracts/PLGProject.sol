// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "./Ownable.sol";
import "./zeppelin/ERC20.sol";
import "./Administrator.sol";
import "./AccountStorage.sol";

/// @title A project accepts tokens during a pre-determined funding period,
/// @title  handles refund requests, and tracks milestone voting.
contract PLGProject is Ownable {
    /// @notice A backer received a full or partial refund
    /// @param beneficiary The refund recipient
    /// @param amount The amount refunded
    event Refund(uint256 beneficiary, uint256 amount);

    /// @notice A new Milestone Vote registered
    /// @param beneficiary The milestone voter
    /// @param vote True/False vote on milestone
    /// @param amount Pledge value of backer who voted
    event MilestoneVote(uint256 beneficiary, bool vote, uint256 amount);

    /// @notice The result of a milestone vote
    /// @param currentMilestone Index of what milestone was checked
    /// @param amount Amount released if the milestone succeeded
    /// @param success Success or failure of milestone
    event MilestoneResult(uint256 indexed currentMilestone, uint256 amount, bool success);

    // Project milestone struct for storing information related to milestones
    struct Milestone {
        // The timestamp of the end of a voting period
        uint256 time;
        // The percent of original funds to be released
        uint256 releasePercent;
        // True if milestone votes have already been checked
        bool reached;
    }

    // Project states to mark status of a project
    enum States {
        // Project awaiting state change from backend
        Inactive,
        // Project failed project funding
        Failed,
        // The project was funded
        Funded,
        // Backers voted to refund
        MilestoneFailed,
        // Moderators voted to cancel
        ModerationFailed,
        // All milestones passed successfully
        Complete
    }

    /// Token used for project funding
    ERC20 public token;

    /// May recover funds if something goes wrong with the contract / receives listing fee
    Administrator public administrator;

    /// AccountStorage address for handling managed accounts
    AccountStorage public accountStorage;

    /// The project creator
    address public creator;

    /// AccountManager contract address
    address public accountManager;

    /// The funding wallet used for administrative purposes
    address public fundingWallet;

    /// The project recipient of funds
    address public recipient;

    /// Timstamp of when the project concluded
    uint256 public concludedTime;

    /// Total amount reserved for milestones
    uint256 public listingFee = 0;

    /// Total amount reserved for milestones
    uint256 public reserve = 0;

    /// Reserve at the start of refunds
    uint256 public refundReserve = 0;

    /// Wait time in seconds until leftover funds can be recovered
    uint256 public recoveryWaitPeriod = 0;

    /// Flag to track the start of refunds
    bool public refundsStarted = false;

    /// Total amount of pledges made by backers
    uint256 public totalPledges = 0;

    /// Total amount creator can withdraw at any time
    uint256 public withdrawal = 0;

    /// @dev Restrict init() to only be able to be run when the flag is false
    bool private initFlag = false;

    /// Flag to track one-time collection of listing fee
    bool public feeCollected = false;

    /// Record of backers -> beneficiaries -> pledge amounts
    mapping(address => mapping(uint256 => uint256)) public pledges;

    /// Reserve percent not given away already
    uint256 public reservePercent = 0;

    /// Current releasePercent
    uint256 public currentReleasePercent = 0;

    /// Record of backers -> beneficiaries -> refund funds
    mapping(address => mapping(uint256 => bool)) public votes;

    /// Total refund vote count weighted by pledge amount
    uint256 public refundVoteCount = 0;

    /// Tracking count of individual refund votes
    uint256 public refundCount;

    /// List of voting milestones
    Milestone[] public milestones;

    /// Current milestone ID in array
    uint256 public currentMilestone = 0;

    /// Current state of the project
    States public state = States.Inactive;

    /// @notice Broadcasts state changes in the project
    /// @param currentState The current state of the project
    event ProjectState(States currentState);

    /// @notice Broadcasts the withdrawal of funds by the project owner on a successful milestone
    /// @param amount withdrawn
    event FundWithdrawal(uint256 amount);

    /// @notice Broadcasts the funds recovered from project
    /// @param amount recovered
    event FailedFundsRecovered(uint256 amount);

    /// @dev Throws if called by any account other than the creator
    modifier onlyCreator() {
        require(msg.sender == creator, "Unauthorized access");
        _;
    }

    /// @dev Throws if called by any account other than the owner OR accountManager
    modifier onlyOwnerOrManager() {
        require(msg.sender == owner || msg.sender == accountManager, "Unauthorized access");
        _;
    }

    /// @dev Throws if the msg.sender is either not accountStorage (managed) or not the beneficiary (regular)
    modifier correctSender(uint256 beneficiary) {
        accountManager = accountStorage.getAccountManagerAddress();
        require(msg.sender == accountManager || uint256(uint160(msg.sender)) == beneficiary, "Unauthorized access");
        _;
    }

    /// @dev Throws if project is not inactive
    modifier inactive() {
        require(state == States.Inactive, "Invalid project state");
        _;
    }

    /// @dev Throws if project is not funded
    modifier funded() {
        require(state == States.Funded, "Invalid project state");
        _;
    }

    /// @dev Throws if project is not inactive nor funded
    modifier inactiveOrFunded()  {
        require(state == States.Inactive || state == States.Funded, "Invalid project state");
        _;
    }

    /// @dev Only allows init() to be run once
    modifier uninitialized() {
        require(!initFlag, "Cannot initialize project more than once");
        _;
    }

    /// @notice init function for initializing a Pledgecamp crowdfunding project
    /// @param tokenAddress Token used for backing the project
    /// @param administratorAddress Recovers funds if something goes wrong/ receives listing fee
    /// @param accountStorageAddress Managed account address for handling transfers
    /// @param fundingAddress The address of external source of funds
    /// @param creatorAddress The project creator
    /// @param recipientAddress The recipient of project funds. If a managed account created project recipient must be AccountStorage
    /// @param milestoneTimes Array of milestone timestamps
    /// @param releasePercents Array of milestone release percentages
    function init(
        address tokenAddress,
        address administratorAddress,
        address accountStorageAddress,
        address fundingAddress,
        address creatorAddress,
        address recipientAddress,
        uint256[] memory milestoneTimes,
        uint256[] memory releasePercents
    ) external uninitialized{

        require(milestoneTimes.length == releasePercents.length && milestoneTimes.length <= 10, "milestoneTimes and releasePercents don't match or are > 10");
        require(milestoneTimes.length >= 1, "Milestones length");
        require(accountStorageAddress != address(0), "Zero addr");
        require(creatorAddress != address(0), "Zero addr");
        require(recipientAddress != address(0), "Zero addr");
        require(fundingAddress != address(0), "Zero addr");
        if(recipientAddress != creatorAddress) {
            require(recipientAddress == accountStorageAddress, "Zero addr");
        }
        token = ERC20(tokenAddress);
        if(administratorAddress != address(0)) {
            administrator = Administrator(administratorAddress);
        }
        accountStorage = AccountStorage(accountStorageAddress);
        creator = creatorAddress;
        recipient = recipientAddress;
        fundingWallet = fundingAddress;

        uint256 releaseSum = 0;
        uint256 prevMilestoneTime = 0;
        for(uint i = 0; i < milestoneTimes.length; i += 1) {
            require(milestoneTimes[i] >= block.timestamp, "Milestones cannot be from the past");
            require(milestoneTimes[i] > prevMilestoneTime, "Sanity check that milestoneTimes are increasing");
            require(releasePercents[i] + releaseSum > releaseSum, "Sanity check that releasePercents are positive non-zero values");
            prevMilestoneTime = milestoneTimes[i];
            releaseSum += releasePercents[i];
            milestones.push(Milestone({time: milestoneTimes[i], releasePercent: releasePercents[i], reached: false}));
        }
        require(releaseSum == 100, "Invalid sum of releasePercents");
        reservePercent = 100;
        initFlag = true;
        recoveryWaitPeriod = 90 days;
    }

    /// @notice Allow owner to set the recovery wait period
    /// @param newRecoveryWaitPeriod Amount to set to new recovery wait period
    function setRecoveryWaitPeriod(uint256 newRecoveryWaitPeriod) external {
        recoveryWaitPeriod = newRecoveryWaitPeriod;
    }

    /// @notice Allows owner to increase the reserve balance of the project contract
    /// @param amount Amount to add to reserve
    function increaseReserve(uint256 amount) external onlyOwnerOrManager {
      require(amount > 0, "Invalid amount value");
      require(!refundsStarted, "Cannot modify reserves during refunds");
      token.increaseAllowance(fundingWallet, amount);
      token.transferFrom(fundingWallet, address(this), amount);
      reserve += amount;
    }


    /// @notice Allows project owner to change admin contract
    /// @param admin Admin contract to change to
    function setAdmin(address admin) external onlyOwner {
        require(admin != address(0), "Zero addr");
        administrator = Administrator(admin);
    }

    /// @notice Withdraw funds as creator of the Project to the recipient
    /// @return Withdrawal amount
    function withdrawFunds() external onlyCreator returns(uint256) {

        require(withdrawal > 0, "Insufficient withdrawal amount");
        uint256 currentWithdrawal = withdrawal;
        // calculate fee from admin.sol, then complete both transfers
        require(token.transfer(recipient, currentWithdrawal), "Failed transfer");
        withdrawal = 0;
        emit FundWithdrawal(currentWithdrawal);
        return currentWithdrawal;
    }

    /// @notice Refund backer or release milestone funds to creator if a Milestone has passed
    function checkMilestones() external funded {

        Milestone storage milestone = milestones[currentMilestone];
        require(!milestone.reached, "Make sure current milestone has not been reached");
        require(block.timestamp > milestone.time, "Milestone time must have passed");
        require(concludedTime == 0, "Another check that we have not concluded project completely");
        // RefundVote must be greater than half of total weighted pledges
        // CurrentMilestone must be greater than 0, since a creator is always
        // able to withdraw the first round after a project has been funded
        if(refundVoteCount >= (reserve / 2) + 1) {
            concludedTime = block.timestamp;
            state = States.MilestoneFailed;
            emit MilestoneResult(currentMilestone, 0, false);
            emit ProjectState(state);
        } else {
            uint256 amount;
            // Project is at the final milestone, marks project completion
            // Get remaining funds held by project
            if(currentMilestone == milestones.length - 1) {
                amount = token.balanceOf(address(this));
                withdrawal = amount;
                state = States.Complete;
                concludedTime = block.timestamp;
                emit MilestoneResult(currentMilestone, amount, true);
                emit ProjectState(state);
            // Go to the next milestone, amount transfered = current release percent * total
            } else {
                amount = (reserve * milestone.releasePercent) / 100;
                emit MilestoneResult(currentMilestone, amount, true);
                currentMilestone += 1;
                withdrawal += amount;
            }
            currentReleasePercent = milestone.releasePercent;
            reservePercent -= milestone.releasePercent;
            milestone.reached = true;
        }
    }

    /// @notice Used by Moderator to mark project cancelled after moderation vote
    function markCancelled() external inactiveOrFunded {

        state = States.ModerationFailed;
        emit ProjectState(state);
    }

    /// @notice Batch send all the reserve amounts for managed accounts
    /// @notice These reserve amounts are used to ensure projects meet their milestone goals
    /// @param beneficiaries Array of beneficiaries (as managed account IDs)
    /// @param amounts Array of PLG that each beneficiary will have as reserve
    /// @param fundingComplete Set this to true when you have sent in all necessary reserves
    /// @param totalAmount Total amount being held in reserve
    function setBackers(uint256[] calldata beneficiaries, uint256[] calldata amounts, bool fundingComplete, uint256 totalAmount) external inactive {

        require(beneficiaries.length > 0, "Invalid array length");
        require(amounts.length > 0, "Invalid array length");
        require(beneficiaries.length == amounts.length, "Number of beneficiaries and amounts don't match");
        accountManager = accountStorage.getAccountManagerAddress();

        require(msg.sender == accountManager, "Unauthorized access");
        require(token.balanceOf(fundingWallet) >= totalAmount, "Insufficient PLG balance");
        uint256 tempTransfer = 0;

        for(uint256 x = 0;x < beneficiaries.length;x++) {
            uint256 beneficiary = beneficiaries[x];
            pledges[address(accountStorage)][beneficiary] += amounts[x];
            tempTransfer += amounts[x];
        }
        if(fundingComplete) {
            state = States.Funded;
            emit ProjectState(state);
        }
        require(totalAmount == tempTransfer, "Reserve per pledge doesn't match total PLG held in reserve");
        listingFee = administrator.getProjectListingFee(address(this));
        if(listingFee > 0 && !feeCollected) {
            uint256 total = tempTransfer + listingFee;
            require(token.transferFrom(fundingWallet, address(this), total), "Failed transfer from fundingWallet");
            require(token.transfer(address(administrator), listingFee), "Failed transfer to Admin");
            feeCollected = true;
        } else {
            require(token.transferFrom(fundingWallet, address(this), totalAmount), "Failed transfer from fundingWallet");
        }
        reserve += tempTransfer;
        totalPledges = reserve;
    }

    /// @notice If the project is funded, vote for the next milestone
    /// @notice Voting true is a veto on the next milestone completing
    /// @notice No vote, or changing vote to false is a vote for completion
    /// @param beneficiary The beneficiary of the original purchase
    /// @param vote Whether (true) for veto, false (approve)
    function milestoneVote(uint256 beneficiary, bool vote) external correctSender(beneficiary) funded {

        require(beneficiary > 0, "Invalid account value");
        address backer = msg.sender;
        if(msg.sender == accountStorage.getAccountManagerAddress()) {
            backer = address(accountStorage);
        }

        uint256 pledge = pledges[backer][beneficiary];
        require(pledge != 0, "No pledge found");
        bool prevVote = votes[backer][beneficiary];

        if(vote && !prevVote) {
            votes[backer][beneficiary] = vote;
            refundVoteCount += pledge;
            refundCount += 1;
            emit MilestoneVote(beneficiary, vote, pledge);
        } else if(!vote && prevVote) {
            votes[backer][beneficiary] = vote;
            refundVoteCount -= pledge;
            refundCount -= 1;
            emit MilestoneVote(beneficiary, vote, pledge);
        }
    }

    /// @notice Backer refund withdrawal
    /// @notice If the sale is active, return all funds
    /// @notice If the sale is cancelled, return fraction of funds based on reservePercent
    /// @notice If a milestone has failed, return fraction of funds based on reservePercent
    /// @param beneficiary The beneficiary of the original purchase
    /// @return The number of tokens refunded
    function requestRefund(uint256 beneficiary) external correctSender(beneficiary) returns(uint256) {

        address backer = msg.sender;
        if(msg.sender == accountStorage.getAccountManagerAddress()) {
            backer = address(accountStorage);
        }

        uint256 pledge = pledges[backer][beneficiary];
        require(pledge > 0, "No pledge found");

        if(!refundsStarted) {
            refundsStarted = true;
            refundReserve = reserve;
        }

        // If project was funded and the project was failed by moderation or milestone votes
        if(state == States.MilestoneFailed || state == States.ModerationFailed) {
            // Calculate refunds (net of fees) based on the remaining reserve percentage
            uint256 refund = ((refundReserve * pledge * reservePercent) / totalPledges) / 100;
            return refundHelper(backer, beneficiary, refund);
        }
        return 0;
    }

    /// @notice Helper for distributing refunds
    /// @param sender Original sender(backer). Usually will just be msg.sender,
    /// but for managed accounts it will be accountStorage address
    /// @param beneficiary Beneficiary of the original purchase
    /// @param refund Number of tokens to refund
    /// @return Number of tokens refunded (for return passthrough)
    function refundHelper(address sender, uint256 beneficiary, uint256 refund) private returns(uint256) {

        require(token.transfer(sender, refund), "Failed transfer");
        uint256 pledge = pledges[sender][beneficiary];
        reserve -= refund;
        pledges[sender][beneficiary] -= pledge;
        emit Refund(beneficiary, refund);
        return refund;
    }

    /// @notice Recover tokens 90 days after sale if creator is unable to for some reason
    function failedFundRecovery() external {

        require(
            state == States.MilestoneFailed ||
            state == States.ModerationFailed ||
            state == States.Complete,
            "Invalid project state"
        );
        require(block.timestamp > concludedTime + recoveryWaitPeriod , "Funds cannot be recovered yet");

        uint256 fundsRecovered = token.balanceOf(address(this));
        require(token.transfer(fundingWallet, fundsRecovered), "Failed transfer");
        emit FailedFundsRecovered(fundsRecovered);
    }

    /// @notice Public call method to see how much backer has in reserve
    /// @param sender Original sender(backer). Usually will just be msg.sender,
    /// but for managed accounts it will be accountStorage address
    /// @param beneficiary Beneficiary of the original purchase
    /// @return Number of tokens held in reserve for the beneficiary
    function getBackerPledge(address sender, uint256 beneficiary) external view returns(uint256) {

        return pledges[sender][beneficiary];
    }

    /// @notice Public call method to see how a backer has voted
    /// @notice True = Veto / False = Approve Milestone
    /// @param sender Original sender(backer). Usually will just be msg.sender,
    /// but for managed accounts it will be accountStorage address
    /// @param beneficiary Beneficiary of the original purchase
    /// @return Vote of beneficiary
    function getBackerVote(address sender, uint256 beneficiary) external view returns(bool) {

        return votes[sender][beneficiary];
    }
}
