// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "./Ownable.sol";
import "./zeppelin/ERC20.sol";
import "./Administrator.sol";
import "./AccountStorage.sol";
import "./Moderator.sol";
import "./CampShareStorage.sol";

/// @title CampShare Manager that lets users participate in the growth of the PledgeCamp
/// @title  economy, and help moderate the platform
contract CampShareManager is Ownable {

    /// @notice A CS holder submits a vote for a project
    /// @param project The project address
    /// @param moderator The moderator
    /// @param vote The masked vote
    event VoteSubmitted(address project, uint256 moderator, bytes32 vote);

    /// @notice A user has given CampShare staked PLG to exchange for CS
    /// @param amount The amount held in stake
    /// @param beneficiary The CS holder
    /// @param user Address of CS holder
    event StakedPLG(uint256 amount, uint256 beneficiary, address user);

    /// @notice A user has unstaked CS for PLG
    /// @param amount The amount to refund in PLG
    /// @param beneficiary The CS holder
    /// @param user Address of CS holder
    event UnstakeCS(uint256 amount, uint256 beneficiary, address user);

    /// @notice Notification that a interest has been distributed
    /// @param amount The amount of interests
    event InterestPosted(uint256 amount);

    /// @notice A user retrieves the interest for staking PLG
    /// @param amount The amount given in interest
    /// @param beneficiary The CS holder
    /// @param user Address of CS holder
    event Withdrawal(uint256 amount, uint256 beneficiary, address user);

    /// @notice A user reinvests the periodic interest received from staking PLG
    /// @param amount The amount of interest reinvested
    /// @param beneficiary The CS holder
    /// @param user Address of CS holder
    event Reinvest(uint256 amount, uint256 beneficiary, address user);

    // TODO: Move to csStorage
    mapping(uint256 => mapping(uint256 => uint256)) public interestExclusions;

    uint256[] public csHolders;

    /// ERC20 Token that can be converted to CS
    ERC20 public token;

    /// May recover PLG if something goes wrong with the contract
    /// submits listing fee (interest)
    Administrator public administrator;

    /// AccountStorage address for handling managed accounts
    AccountStorage public accountStorage;

    /// Moderator address for handling moderation votes
    Moderator public moderation;

    /// CampShareStorage address for handling cs data
    CampShareStorage public csStorage;

    /// Total outstanding CampShares
    uint256 public totalCS;

    /// @notice Constructor for CS Manager
    /// @param tokenAddress Token used for exchange
    /// @param adminAddress Recovers funds if something goes wrong/submits listing fee
    /// @param accountStorageAddress Managed account address for handling transfers
    /// @param csStorageAddress Managed CS address for handling CS data
    constructor(
        address tokenAddress,
        address adminAddress,
        address accountStorageAddress,
        address csStorageAddress
    ) {
        require(tokenAddress != address(0), "Zero addr");
        require(adminAddress != address(0), "Zero addr");
        require(accountStorageAddress != address(0), "Zero addr");
        require(csStorageAddress != address(0), "Zero addr");
        token = ERC20(tokenAddress);
        administrator = Administrator(adminAddress);
        accountStorage = AccountStorage(accountStorageAddress);
        csStorage = CampShareStorage(csStorageAddress);
    }

    /// @notice Function to set Administrator contract address
    /// @param admin Administrator contract address
    function setAdmin(address admin) external onlyOwner {
        require(admin != address(0), "Zero addr");
        administrator = Administrator(admin);
    }

    /// @dev Throws if the msg.sender is either not accountStorage (managed) or not the beneficiary (regular)
    modifier correctSender(uint256 beneficiary) {
        address manager = accountStorage.getAccountManagerAddress();
        require(msg.sender == manager || uint256(uint160(msg.sender)) == beneficiary, "Unauthorized access");
        _;
    }

    /// @notice Returns the accountID of an addresses
    /// @param user Address of user
    /// @return AccountID of user
    function getID(address user) external pure returns(uint256){
        return uint256(uint160(user));
    }

    /// @notice Returns any PLG interest that has not been withdrawn or reinvested
    /// @param beneficiary Account ID of user
    /// @return Amount of accrued PLG interest
    function unrealizedGains(address user, uint256 beneficiary) external view returns(uint256) {
        uint256 userStake = csStorage.getStake(user, beneficiary);
        uint256 interestIndex = csStorage.getStakeInterestIndex(user, beneficiary);
        uint256 interestCount = csStorage.getInterestCount();
        uint256 gains = 0;
        if(userStake == 0) {
            return 0;
        }

        for(uint256 i = interestIndex; i < interestCount; i += 1) {
            uint256 interestAmount = csStorage.getInterestAmount(i);
            uint256 divStakeSnapshot = csStorage.getInterestStakeSnapshot(i);
            gains += (userStake * interestAmount) / divStakeSnapshot;
        }
        return gains;
    }

    /// @notice Allocates funds for interest payments to CS holders
    /// @param amount Total amount of interest in PLG to be divided amongst CS holders
    function postInterest(uint256 amount) external onlyOwner {
        uint256 allowance = token.allowance(msg.sender, address(this));
        require(allowance >= amount, "Allowance low");
        uint256 stakedPLG = csStorage.totalCS();
        require(stakedPLG > 0, "No stakers");

        uint256 divLen = csStorage.getInterestCount();

        for(uint256 i = 0; i < csHolders.length; i += 1) {
            if(csHolders[i] > 0) {
                bool complianceFlag = _checkCommitment(csHolders[i]);
                if(!complianceFlag) {
                    // TODO: Address handling
                    uint256 userStake = csStorage.getStake(address(accountStorage), csHolders[i]);
                    interestExclusions[csHolders[i]][divLen] = userStake;
                    stakedPLG -= userStake;
                }
            }
        }

        require(stakedPLG > 0, "No valid stakes");

        // Special case for posting first dividend
        if(divLen == 0) {
            csStorage.pushInterestInfo(amount, amount, stakedPLG);
        } else {
            // If the stake pool has changed, or gains have been realized, post a new interest payment
            uint256 prevPeriod = divLen - 1;
            uint256 prevDivStakeSnapshot = csStorage.getInterestStakeSnapshot(prevPeriod);
            uint256 prevDivAmount = csStorage.getInterestAmount(prevPeriod);
            uint256 prevDivOriginalAmount = csStorage.getInterestOriginalAmount(prevPeriod);

            if(
                stakedPLG != prevDivStakeSnapshot
                || prevDivAmount != prevDivOriginalAmount
            ) {
                csStorage.pushInterestInfo(amount, amount, stakedPLG);
            // If the stake pool hasn't changed
            } else {
                csStorage.increaseInterestOriginalAmount(prevPeriod, amount);
                csStorage.increaseInterestAmount(prevPeriod, amount);
            }
        }
        token.transferFrom(msg.sender, address(csStorage), amount);

        emit InterestPosted(amount);
    }

    /// @notice User stakes PLG for CS
    /// @param beneficiary Account ID of user
    /// @param amount Amount of PLG to stake
    function stake(uint256 beneficiary, uint256 amount) external correctSender(beneficiary) {
        address backer = msg.sender;
        if(msg.sender == accountStorage.getAccountManagerAddress()) {
            backer = address(accountStorage);
        }

        uint256 allowance = token.allowance(backer, address(this));
        require(allowance >= amount, "Allowance low");

        _validateCommitment(backer, beneficiary);

        uint256 unstakeCount = csStorage.getUnstakeCount(backer, beneficiary);
        if(unstakeCount > 0) {
            uint256 unstakeTime = csStorage.getUnstakedTime(backer, beneficiary, unstakeCount-1);
            uint256 unstakePeriod = csStorage.unstakePeriod();
            require(block.timestamp > unstakeTime + unstakePeriod, "Unstake wait period has not ended");
        }

        uint256 userStake = csStorage.getStake(backer, beneficiary);
        if(userStake > 0) {
            // If there is an existing stake, we need to ensure there are no unrealized gains
            _reinvest(beneficiary);
        } else {
            csHolders.push(beneficiary);
        }

        uint256 interestCount = csStorage.getInterestCount();
        csStorage.increaseStakeAmount(backer, beneficiary, amount);
        csStorage.setStakeInterestIndex(backer, beneficiary, interestCount);
        csStorage.increaseTotalCS(amount);

        token.transferFrom(backer, address(csStorage), amount);
        emit StakedPLG(amount, beneficiary, backer);
    }

    /// @notice User unstakes CS for PLG
    /// @param beneficiary Account ID of user
    /// @return Returns total staked tokens and unrealized gains
    function unstake(uint256 beneficiary) external correctSender(beneficiary) returns(uint256) {
        address backer = msg.sender;
        if(msg.sender == accountStorage.getAccountManagerAddress()) {
            backer = address(accountStorage);
        }

        uint256 userStake = csStorage.getStake(backer, beneficiary);
        require(userStake > 0, "No stake");

        uint256 gains = _updateInterest(beneficiary);
        uint256 total = userStake + gains;

        csStorage.decreaseStakeAmount(backer, beneficiary, userStake);
        csStorage.setStakeInterestIndex(backer, beneficiary, 0);
        csStorage.decreaseTotalCS(userStake);

        csStorage.pushUnstakedCSInfo(backer, beneficiary, userStake, block.timestamp);
        csStorage.sendFunds(backer, total);

        for(uint256 i = 0; i < csHolders.length; i += 1) {
            if(csHolders[i] == beneficiary) {
                delete csHolders[i];
            }
        }
        emit UnstakeCS(total, beneficiary, backer);
        return total;
    }

    /// @notice Private function to update calculation of gains
    /// @param beneficiary Account ID of user
    /// @return Returns gains from accrued interest payments
    function _updateInterest(uint256 beneficiary) private returns(uint256) {
        address backer = msg.sender;
        if(msg.sender == accountStorage.getAccountManagerAddress()) {
            backer = address(accountStorage);
        }

        uint256 userStake = csStorage.getStake(backer, beneficiary);
        uint256 interestIndex = csStorage.getStakeInterestIndex(backer, beneficiary);
        uint256 interestCount = csStorage.getInterestCount();
        uint256 gains = 0;

        for(uint256 i = interestIndex; i < interestCount; i += 1) {
            uint256 interestExclusion = interestExclusions[beneficiary][i];
            if(interestExclusion == 0) {
                uint256 totalStakeSnapshot = csStorage.getInterestStakeSnapshot(i);
                uint256 remainingStake = totalStakeSnapshot - userStake;
                // Last withdrawal gets remainder, to avoid rounding issues
                uint256 amount = csStorage.getInterestAmount(i);
                if(remainingStake != 0) {
                    amount = (userStake * amount) / totalStakeSnapshot;
                }
                csStorage.decreaseInterestAmount(i, amount);
                csStorage.decreaseInterestStakeSnapshot(i, userStake);
                gains += amount;
            }
        }
        csStorage.setStakeInterestIndex(backer, beneficiary, interestCount);
        return gains;
    }

    /// @notice Private function to reinvest and stake interest received into CS
    /// @param beneficiary Account ID of user
    /// @return Returns gains from accrued interest payments that will be reinvested
    function _reinvest(uint256 beneficiary) private returns(uint256) {
        address backer = msg.sender;
        if(msg.sender == accountStorage.getAccountManagerAddress()) {
            backer = address(accountStorage);
        }

        uint256 gains = _updateInterest(beneficiary);
        if(gains > 0) {
            csStorage.increaseStakeAmount(backer, beneficiary, gains);
            csStorage.increaseTotalCS(gains);
        }
        return gains;
    }

    /// @notice Revert if the beneficiary's outstanding vote count is under the allowed threshold
    /// @param backer Address of backer
    /// @param beneficiary Account ID of user
    function _validateCommitment(address backer, uint256 beneficiary) private view {
        bool complianceFlag = true;
        uint256 outstandingModeration = csStorage.getOutstandingModeration(backer, beneficiary);
        if(outstandingModeration > 0) {
            complianceFlag = _checkCommitment(beneficiary);
        }
        require(complianceFlag, "Votes exceed allowance");
    }

    /// @notice Check that user's outstanding vote count is under the allowed threshold
    /// @param beneficiary Account ID of user
    /// @return Returns True (meets outstanding vote requirement) / False (over outstanding vote allowance threshold)
    function _checkCommitment(uint256 beneficiary) private view returns(bool) {
        address backer = msg.sender;
        if(msg.sender == accountStorage.getAccountManagerAddress()) {
            backer = address(accountStorage);
        }

        uint256 outstandingModeration = csStorage.getOutstandingModeration(backer, beneficiary);
        if(outstandingModeration == 0) {
            return true;
        }

        uint256 moderationHistoryCount = csStorage.getModerationHistoryCount(backer, beneficiary);
        uint256 outstandingAllowance = csStorage.outstandingAllowance();
        uint256 outstandingPercent = (outstandingModeration * 100) / moderationHistoryCount;

        return outstandingPercent <= outstandingAllowance;
    }

    /// @notice Withdraw interest received into PLG wallet
    /// @param beneficiary Account ID of user
    /// @return Returns gains from accrued interest payments
    function withdrawInterest(uint256 beneficiary) external returns(uint256) {
        address backer = msg.sender;
        if(msg.sender == accountStorage.getAccountManagerAddress()) {
            backer = address(accountStorage);
        }

        uint256 staked = csStorage.getStake(backer, beneficiary);
        require(staked > 0, "No stake");

        uint256 gains = _updateInterest(beneficiary);
        csStorage.sendFunds(backer, gains);

        emit Withdrawal(gains, beneficiary, backer);
        return gains;
    }

    /// @notice External function to reinvest and stake interest received into CS
    /// @param beneficiary Account ID of user
    function reinvest(uint256 beneficiary) external correctSender(beneficiary) {
        address backer = msg.sender;
        if(msg.sender == accountStorage.getAccountManagerAddress()) {
            backer = address(accountStorage);
        }

        uint256 staked = csStorage.getStake(backer, beneficiary);
        require(staked > 0, "No stake");

        _validateCommitment(backer, beneficiary);

        uint256 gains = _reinvest(beneficiary);

        emit Reinvest(gains, beneficiary, backer);
    }

    /// @notice OnlyOwner contract to set the moderator contract
    /// @param moderator The contract address of Moderator.sol
    function setModeratorContract(address moderator) external onlyOwner {
        require(moderator != address(0), "Zero addr");
        moderation = Moderator(moderator);
    }

    /// @notice OnlyOwner contract to allow backend to set the moderators for a project vote
    /// @param project The Address of the project to vote on
    /// @param moderators The account IDs of the selected moderators. For private accounts, this will be uint version of address
    /// @param endTime Timestamp of end of project moderation
    function setProjectModerators(address project, uint256[] memory moderators, uint256 endTime) external onlyOwner {
        uint256 prevEndTime = csStorage.getModerationEndTime(project);
        require(prevEndTime == 0 || block.timestamp > prevEndTime, "Moderation in progress");

        for(uint256 x = 0; x < moderators.length; x++) {
            address adrs = address(uint160(moderators[x]));
            uint256 currentHoldings = csStorage.getStake(adrs, moderators[x]);
            if(currentHoldings == 0) {
                adrs = address(accountStorage);
            }
            currentHoldings = csStorage.getStake(adrs, moderators[x]);
            require(currentHoldings > 0, "Moderator has no CS");
            uint256 moderationCount = csStorage.getProjectModerationCount(project, moderators[x]);
            if(moderationCount == 0) {
                csStorage.increaseOutstandingModeration(1, adrs, moderators[x]);
                csStorage.increaseProjectModerationCount(1, project, moderators[x]);
            } else {
                csStorage.decreaseOutstandingModeration(moderationCount, adrs, moderators[x]);
                csStorage.increaseOutstandingModeration(1, adrs, moderators[x]);
                csStorage.decreaseProjectModerationCount(moderationCount, project, moderators[x]);
                csStorage.increaseProjectModerationCount(1, project, moderators[x]);
            }
            csStorage.increaseModerationHistoryCount(1, adrs, moderators[x]);
        }
        administrator.setProjectModerators(project, moderators);
        csStorage.setModerationEndTime(project, endTime);
    }

    /// @notice External call method to allow a user to submit a vote
    /// @notice Will automatically revert if the user is not a set moderator
    /// @param moderator ID of the moderator
    /// @param project The Address of the project to vote on
    /// @param vote bytes32 representation of the vote
    function submitVote(uint256 moderator, address project, bytes32 vote) external correctSender(moderator) {
        require(administrator.checkVoter(project, moderator), "Invalid voter");

        uint256 accountStorageBalance = csStorage.getStake(address(accountStorage), moderator);
        uint256 senderBalance = csStorage.getStake(msg.sender, moderator);
        require(accountStorageBalance > 0 || senderBalance > 0, "Not a CS holder");

        uint256 endTime = csStorage.getModerationEndTime(project);
        require(endTime > block.timestamp, "Moderation period inactive");
        uint256 projectModerationCount = csStorage.getProjectModerationCount(project, moderator);

        if(projectModerationCount == 1) {
            moderation.submitVote(project, vote, moderator);
            address adrs = address(uint160(moderator));
            uint256 currentHoldings = csStorage.getStake(adrs, moderator);
            if(currentHoldings == 0) {
                adrs = address(accountStorage);
            }
            csStorage.decreaseOutstandingModeration(1, adrs, moderator);
            csStorage.decreaseProjectModerationCount(1, project, moderator);

            emit VoteSubmitted(project, moderator, vote);
        }
    }

    /// @notice Get PLG staked into contract
    /// @param user User wallet address
    /// @param beneficiary Beneficiary user ID
    /// @return Current CS balance
    function getStake(address user, uint256 beneficiary) external view returns(uint256) {
        return csStorage.getStake(user, beneficiary);
    }
}
