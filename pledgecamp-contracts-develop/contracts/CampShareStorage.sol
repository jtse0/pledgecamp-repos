// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "./Ownable.sol";
import "./CampShareManager.sol";
import "./zeppelin/ERC20.sol";

/// @title CampShare Storage stores information related to the CS
/// @title related activities of CS holders
contract CampShareStorage is Ownable {

    /// CampshareManager contract
    address public csManager;

    /// ERC20 Token that can be converted to CS
    ERC20 public token;

    /// Length of time to wait for unstaking CS back to PLG
    uint256 public unstakePeriod;

    /// Total outstanding CampShares
    uint256 public totalCS;

    /// Grace allowance for the outstanding moderation percentage allowed (in whole numbers)
    uint256 public outstandingAllowance;

    /// Contributor to PLG stake mapping
    mapping(address => mapping(uint256 => Stake)) public stakes;

    /// List of posted interest payments
    Interest[] public interest;

    /// Contributor to Outstanding Moderator votes a CS holder must submit
    mapping(address => mapping(uint256 => uint256)) public outstandingModeration;

    /// Project Address to Moderator votes a CS holder has outstanding
    mapping(address => mapping(uint256 => uint256)) public projectModerationCount;

    /// Project Address to Moderator previous number of moderation vote requirements
    mapping(address => mapping(uint256 => uint256)) public moderationHistoryCount;

    /// Contributor to unstakeCS struct mapping
    mapping(address => mapping(uint256 => UnstakedCSInfo[])) public unstakedCS;

    /// Timestamp in seconds for moderation end times of all projects
    mapping(address => uint256) public moderationEndTimes;

    // UnstakedCSInfo struct for storing details relating to unstaking
    struct UnstakedCSInfo {
        // Amount that is unstaked
        uint256 amount;
        // Time when unstaking began
        uint256 time;
    }

    // Stake info object
    struct Stake {
        // The amount of PLG staked
        uint256 stake;
        // Index into the list of interest payments
        uint256 interestIndex;
    }

    // Interest info object
    struct Interest {
        // Original interest amount
        uint256 originalAmount;
        // Interest amount, minus realized gains
        uint256 amount;
        // Snapshot of total stake at the time of interest posting
        uint256 totalStakeSnapshot;
    }

    /// @dev Throws if called by any account other than the owner OR campshareManager
    modifier onlyOwnerOrManager() {
        require(msg.sender == owner || msg.sender == csManager, "Unauthorized access");
        _;
    }

    /// @notice Constructor for CS Storage
    /// @param tokenAddress Token used for exchange
    /// @param initialUnstakePeriod Length of time needed to unstake CS
    constructor(address tokenAddress, uint256 initialUnstakePeriod) {
        require(tokenAddress != address(0), "Zero addr");
        require(initialUnstakePeriod > 0, "Invalid unstake period");
        token = ERC20(tokenAddress);
        unstakePeriod = initialUnstakePeriod;
    }

    /// @notice Set the CampShareManager Connection
    /// @param newCsManager CampShareManager address
    function setCampshareManager(address newCsManager) external onlyOwner {
        require(newCsManager != address(0), "Zero addr");
        csManager = newCsManager;
    }

    /// @notice Get interest count
    function getInterestCount() external view returns(uint256) {
        return interest.length;
    }

    /// @notice Set the CS unstake period
    /// @param periodDays Unstake period in days
    function setUnstakePeriod(uint256 periodDays) external onlyOwnerOrManager {
        require(periodDays > 0, "Invalid days");
        unstakePeriod = periodDays;
    }

    /// @notice Get stake amount
    /// @param user User wallet address
    /// @param beneficiary Beneficiary user ID
    /// @return Current CS balance
    function getStake(address user, uint256 beneficiary) external view returns(uint256) {
        require(user != address(0), "Zero addr");
        require(beneficiary > 0, "Invalid account");
        return stakes[user][beneficiary].stake;
    }

    /// @notice Get stake interest index
    /// @param user User wallet address
    /// @param beneficiary Beneficiary user ID
    /// @return Current CS interest index
    function getStakeInterestIndex(address user, uint256 beneficiary) external view returns(uint256) {
        require(user != address(0), "Zero addr");
        require(beneficiary > 0, "Invalid account");
        return stakes[user][beneficiary].interestIndex;
    }

    /// @notice Increase user stake amount
    /// @param user User wallet address
    /// @param beneficiary Beneficiary user ID
    /// @param amount amount
    function increaseStakeAmount(address user, uint256 beneficiary, uint256 amount) external onlyOwnerOrManager {
        require(user != address(0), "Zero addr");
        require(beneficiary > 0, "Invalid account");
        require(amount > 0, "Invalid amount");
        stakes[user][beneficiary].stake += amount;
    }

    /// @notice Decrease user stake amount
    /// @param user User wallet address
    /// @param beneficiary Beneficiary user ID
    /// @param amount amount
    function decreaseStakeAmount(address user, uint256 beneficiary, uint256 amount) external onlyOwnerOrManager {
        require(user != address(0), "Zero addr");
        require(beneficiary > 0, "Invalid account");
        require(amount > 0, "Invalid amount");
        stakes[user][beneficiary].stake -= amount;
    }

    /// @notice Update stake interest index
    /// @param user User wallet address
    /// @param beneficiary Beneficiary user ID
    /// @param interestIndex interest index
    function setStakeInterestIndex(address user, uint256 beneficiary, uint256 interestIndex) external onlyOwnerOrManager {
        require(user != address(0), "Zero addr");
        require(beneficiary > 0, "Invalid account");
        stakes[user][beneficiary].interestIndex = interestIndex;
    }

    /// @notice Add interest record
    /// @param originalAmount Original interest amount
    /// @param amount Interest amount, minus realized gains
    /// @param stakeSnapshot Snapshot of total stake at the time of interest posting
    function pushInterestInfo(uint256 originalAmount, uint256 amount, uint256 stakeSnapshot) external onlyOwnerOrManager {
        require(originalAmount > 0, "Invalid originalAmount");
        require(amount > 0, "Invalid amount");
        require(stakeSnapshot > 0, "Invalid stakeSnapshot");
        interest.push(Interest({originalAmount: originalAmount, amount: amount, totalStakeSnapshot: stakeSnapshot}));
    }

    /// @notice Remove unstake info record for user
    /// @param index Id of interest record
    function deleteInterestInfo(uint256 index) external onlyOwnerOrManager {
        delete interest[index];
    }

    /// @notice Add interest record
    /// @param index Id of interest record
    /// @param originalAmount Original interest amount
    /// @param amount Interest amount, minus realized gains
    /// @param stakeSnapshot Snapshot of total stake at the time of interest posting
    function updateInterestInfo(uint256 index, uint256 originalAmount, uint256 amount, uint256 stakeSnapshot) external onlyOwnerOrManager {
        require(originalAmount > 0, "Invalid originalAmount");
        require(amount > 0, "Invalid amount");
        require(stakeSnapshot > 0, "Invalid stakeSnapshot");
        interest[index] = Interest({originalAmount: originalAmount, amount: amount, totalStakeSnapshot: stakeSnapshot});
    }

    /// @notice Gets interest original amount
    /// @param index Id of interest record
    /// @return Interest original amount
    function getInterestOriginalAmount(uint256 index) external view returns(uint256) {
        return interest[index].originalAmount;
    }

    /// @notice Increases interest record original amount
    /// @param index Id of interest record
    /// @param amount Amount to increase original amount
    function increaseInterestOriginalAmount(uint256 index, uint256 amount) external onlyOwnerOrManager {
        require(amount > 0, "Invalid amount");
        interest[index].originalAmount += amount;
    }

    /// @notice Decreases interest record original amount
    /// @param index Id of interest record
    /// @param amount Amount to decrease original amount
    function decreaseInterestOriginalAmount(uint256 index, uint256 amount) external onlyOwnerOrManager {
        require(amount > 0, "Invalid amount");
        interest[index].originalAmount -= amount;
    }

    /// @notice Gets interest record amount
    /// @param index Id of interest record
    /// @return Interest amount
    function getInterestAmount(uint256 index) external view returns(uint256) {
        return interest[index].amount;
    }

    /// @notice Increases interest record amount
    /// @param index Id of interest record
    /// @param amount Amount to increase amount
    function increaseInterestAmount(uint256 index, uint256 amount) external onlyOwnerOrManager {
        require(amount > 0, "Invalid amount");
        interest[index].amount += amount;
    }

    /// @notice Decreases interest record amount
    /// @param index Id of interest record
    /// @param amount Amount to decrease amount
    function decreaseInterestAmount(uint256 index, uint256 amount) external onlyOwnerOrManager {
        require(amount > 0, "Invalid amount");
        interest[index].amount -= amount;
    }

    /// @notice Gets stake snapshot
    /// @param index Id of interest record
    /// @return Stake snapshot
    function getInterestStakeSnapshot(uint256 index) external view returns(uint256) {
        return interest[index].totalStakeSnapshot;
    }

    /// @notice Increases stake snapshot
    /// @param index Id of interest record
    /// @param amount Amount to increase stake snapshot
    function increaseInterestStakeSnapshot(uint256 index, uint256 amount) external onlyOwnerOrManager {
        require(amount > 0, "Invalid amount");
        interest[index].totalStakeSnapshot += amount;
    }

    /// @notice Decreases stake snapshot
    /// @param index Id of interest record
    /// @param amount Amount to decrease stake snapshot
    function decreaseInterestStakeSnapshot(uint256 index, uint256 amount) external onlyOwnerOrManager {
        require(amount > 0, "Invalid amount");
        interest[index].totalStakeSnapshot -= amount;
    }

    /// @notice Increase user total outstanding moderation count
    /// @param amount Number of outstanding moderations
    /// @param user User wallet address
    /// @param beneficiary Beneficiary user ID
    function increaseOutstandingModeration(uint256 amount, address user, uint256 beneficiary) external onlyOwnerOrManager {
        require(amount > 0, "Invalid amount");
        require(user != address(0), "Zero addr");
        require(beneficiary > 0, "Invalid account");
        outstandingModeration[user][beneficiary] += amount;
    }

    /// @notice Decrease user total outstanding moderation count
    /// @param amount Number of outstanding moderations
    /// @param user User wallet address
    /// @param beneficiary Beneficiary user ID
    function decreaseOutstandingModeration(uint256 amount, address user, uint256 beneficiary) external onlyOwnerOrManager {
        require(amount > 0, "Invalid amount");
        require(user != address(0), "Zero addr");
        require(beneficiary > 0, "Invalid account");
        outstandingModeration[user][beneficiary] -= amount;
    }

    /// @notice Get user total outstanding moderation count
    /// @param user User wallet address
    /// @param beneficiary Beneficiary user ID
    /// @return Current total outstanding moderation count
    function getOutstandingModeration(address user, uint256 beneficiary) external view returns(uint256) {
        require(user != address(0), "Zero addr");
        require(beneficiary > 0, "Invalid account");
        return outstandingModeration[user][beneficiary];
    }

    /// @notice Increase user outstanding moderation count for specific project
    /// @param amount Number of outstanding moderations
    /// @param project Project address
    /// @param beneficiary Beneficiary user ID
    function increaseProjectModerationCount(uint256 amount, address project, uint256 beneficiary) external onlyOwnerOrManager {
        require(amount > 0, "Invalid amount");
        require(project != address(0), "Zero addr");
        require(beneficiary > 0, "Invalid account");
        projectModerationCount[project][beneficiary] += amount;
    }

    /// @notice Decrease user outstanding moderation count for specific project
    /// @param amount Number of outstanding moderations
    /// @param project Project address
    /// @param beneficiary Beneficiary user ID
    function decreaseProjectModerationCount(uint256 amount, address project, uint256 beneficiary) external onlyOwnerOrManager {
        require(amount > 0, "Invalid amount");
        require(project != address(0), "Zero addr");
        require(beneficiary > 0, "Invalid account");
        projectModerationCount[project][beneficiary] -= amount;
    }

    /// @notice Get user total outstanding moderation count for specific project
    /// @param project Project address
    /// @param beneficiary Beneficiary user ID
    /// @return Current total outstanding moderation count for specific project
    function getProjectModerationCount(address project, uint256 beneficiary) external view returns(uint256) {
        require(project != address(0), "Zero addr");
        require(beneficiary > 0, "Invalid account");
        return projectModerationCount[project][beneficiary];
    }

    /// @notice Increase user total moderation history count
    /// @param amount Number of moderation history records
    /// @param user User wallet address
    /// @param beneficiary Beneficiary user ID
    function increaseModerationHistoryCount(uint256 amount, address user, uint256 beneficiary) external onlyOwnerOrManager {
        require(amount > 0, "Invalid amount");
        require(user != address(0), "Zero addr");
        require(beneficiary > 0, "Invalid account");
        moderationHistoryCount[user][beneficiary] += amount;
    }

    /// @notice Decrease user total moderation history count
    /// @param amount Number of moderation history records
    /// @param user User wallet address
    /// @param beneficiary Beneficiary user ID
    function decreaseModerationHistoryCount(uint256 amount, address user, uint256 beneficiary) external onlyOwnerOrManager {
        require(amount > 0, "Invalid amount");
        require(user != address(0), "Zero addr");
        require(beneficiary > 0, "Invalid account");
        moderationHistoryCount[user][beneficiary] -= amount;
    }

    /// @notice Get user total moderation history count
    /// @param user User wallet address
    /// @param beneficiary Beneficiary user ID
    /// @return Current total moderation history count
    function getModerationHistoryCount(address user, uint256 beneficiary) external view returns(uint256) {
        require(user != address(0), "Zero addr");
        require(beneficiary > 0, "Invalid account");
        return moderationHistoryCount[user][beneficiary];
    }

    /// @notice Add unstake info record for user
    /// @param user User wallet address
    /// @param beneficiary Beneficiary user ID
    /// @param amount Number of unstaked CS
    /// @param timestamp Timestamp CS was unstaked
    function pushUnstakedCSInfo(address user, uint256 beneficiary, uint256 amount, uint256 timestamp) external onlyOwnerOrManager {
        require(user != address(0), "Zero addr");
        require(beneficiary > 0, "Invalid account");
        require(timestamp > 0, "Invalid time");
        unstakedCS[user][beneficiary].push(UnstakedCSInfo({amount: amount, time: timestamp}));
    }

    /// @notice Remove unstake info record for user
    /// @param user User wallet address
    /// @param beneficiary Beneficiary user ID
    /// @param index Id of unstakedCSInfo
    function deleteUnstakedCSInfo(address user, uint256 beneficiary, uint256 index) external onlyOwnerOrManager {
        require(user != address(0), "Zero addr");
        require(beneficiary > 0, "Invalid account");
        delete unstakedCS[user][beneficiary][index];
    }

    /// @notice Update unstake info record for user
    /// @param user User wallet address
    /// @param beneficiary Beneficiary user ID
    /// @param amount Number of unstaked CS
    /// @param timestamp Timestamp CS was unstaked
    function updateUnstakedCSInfo(address user, uint256 beneficiary, uint256 index, uint256 amount, uint256 timestamp) external onlyOwnerOrManager {
        require(user != address(0), "Zero addr");
        require(beneficiary > 0, "Invalid account");
        require(timestamp > 0, "Invalid time");
        unstakedCS[user][beneficiary][index] = UnstakedCSInfo({amount: amount, time: timestamp});
    }

    /// @notice Get unstake transaction amount for user
    /// @param user User wallet address
    /// @param beneficiary Beneficiary user ID
    /// @param index Id of unstakedCSInfo
    /// @return Unstake transaction amount
    function getUnstakedAmount(address user, uint256 beneficiary, uint256 index) external view returns(uint256) {
        require(user != address(0), "Zero addr");
        require(beneficiary > 0, "Invalid account");
        return unstakedCS[user][beneficiary][index].amount;
    }

    /// @notice Get unstake transaction timestamp for user
    /// @param user User wallet address
    /// @param beneficiary Beneficiary user ID
    /// @param index Id of unstakedCSInfo
    /// @return Unstake transaction timestamp
    function getUnstakedTime(address user, uint256 beneficiary, uint256 index) external view returns(uint256) {
        require(user != address(0), "Zero addr");
        require(beneficiary > 0, "Invalid account");
        return unstakedCS[user][beneficiary][index].time;
    }

    /// @notice Get number of unstake transaction for user
    /// @param user User wallet address
    /// @param beneficiary Beneficiary user ID
    /// @return Number of unstake transactions
    function getUnstakeCount(address user, uint256 beneficiary) external view returns(uint256) {
        require(user != address(0), "Zero addr");
        require(beneficiary > 0, "Invalid account");
        return unstakedCS[user][beneficiary].length;
    }

    /// @notice Get number of unstaked CS for user
    /// @param user User wallet address
    /// @param beneficiary Beneficiary user ID
    /// @return Number of unstaked CS
    function getUnstakedCS(address user, uint256 beneficiary) external view returns(uint256) {
        require(user != address(0), "Zero addr");
        require(beneficiary > 0, "Invalid account");
        uint256 currentUnstakedCS = 0;
        for(uint256 i = 0; i < unstakedCS[user][beneficiary].length; i += 1) {
            currentUnstakedCS += unstakedCS[user][beneficiary][i].amount;
        }
        return currentUnstakedCS;
    }

    /// @notice Increase total number of circulating CS
    /// @param amount Number of CS
    function increaseTotalCS(uint256 amount) external onlyOwnerOrManager {
        require(amount > 0, "Invalid amount");
        totalCS += amount;

    }

    /// @notice Decrease total number of circulating CS
    /// @param amount Number of CS
    function decreaseTotalCS(uint256 amount) external onlyOwnerOrManager {
        require(amount > 0, "Invalid amount");
        totalCS -= amount;
    }

    /// @notice Set moderation end time
    /// @param project Project Address
    /// @param moderationEndTime Timestamp of moderation end time
    function setModerationEndTime(address project, uint256 moderationEndTime) external onlyOwnerOrManager {
        require(project != address(0), "Zero addr");
        require(moderationEndTime > 0, "Invalid timestamp");
        moderationEndTimes[project] = moderationEndTime;
    }

    /// @notice Get moderation end time
    /// @param project Project Address
    function getModerationEndTime(address project) external view returns(uint256) {
        require(project != address(0), "Zero addr");
        return moderationEndTimes[project];
    }

    /// @notice Set outstanding allowance
    /// @param newOutstandingAllowance Grace allowance for the outstanding moderation votes
    function setOutstandingAllowance(uint256 newOutstandingAllowance) external onlyOwnerOrManager {
        require(newOutstandingAllowance > 0, "Invalid");
        outstandingAllowance = newOutstandingAllowance;
    }

    /// @notice Send funds to external user
    /// @param user User wallet address
    /// @param amount Amount to send
    function sendFunds(address user, uint256 amount) external onlyOwnerOrManager {
        require(user != address(0), "Zero addr");
        require(amount > 0, "Invalid amount");
        token.transfer(user, amount);
    }

}
