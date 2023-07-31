// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

import "./Ownable.sol";
import "./PLGProject.sol";

contract Moderator is Ownable {

    /// @notice The votes converted into readable boolean
    /// @param project The address of the project
    /// @param votes The boolean votes for a project
    event CommitFinalVotes(address project, bool[] votes);

    /// @notice Broadcasts the result of the moderation vote
    /// @param project The address of the project
    /// @param isCancelled Result of moderation vote (True = Cancelled)
    event ModerationVoteResult(address project, bool isCancelled);

    /// @dev Hash of moderator vote to check when they submit their final vote
    mapping(address => mapping(uint256 => bytes32)) public moderatorHash;

    /// @dev Votes to Project stored as bytes32 (used before reveal to count votes)
    mapping(address => bytes32[]) private votingHash;

    /// @dev Votes to Project stored as Bool (converted after backend commits the votes)
    mapping(address => bool[]) public votingFinal;

    /// @dev Project cancellation determined by voting. true = Cancel project
    mapping(address => bool) public projectCancel;

    /// Store project address
    PLGProject public plgProject;

    /// Store CampShareManager address
    address public csManager;

    /// Store vote threshold amount
    uint256 public voteThreshold = 7;

    /// @dev Throws if called by any account other than the owner OR campshareManager
    modifier onlyOwnerOrManager() {
        require(msg.sender == owner || msg.sender == csManager, "Unauthorized access");
        _;
    }

    /// @notice Constructor to set CampShareManager Address
    /// @param newCsManager CampShareManager Address
    constructor(address newCsManager) {
        require(newCsManager != address(0), "Zero addr");
        csManager = newCsManager;
    }

    /// @notice Set the CampShareManager Connection
    /// @param newCsManager CampShareManager address
    function setCampshareManager(address newCsManager) external onlyOwner {
        require(newCsManager != address(0), "Zero addr");
        csManager = newCsManager;
    }

    /// @notice Set the vote threshold for counting moderation votes
    /// @param newVoteThreshold Vote threshold amount
    function setVoteThreshold(uint256 newVoteThreshold) external onlyOwner {
        require(newVoteThreshold >= 3, "Vote threshold must be greater than 3");
        voteThreshold = newVoteThreshold;
    }

    /// @notice Open function that lets anybody check the votes and submit a project cancellation
    /// @notice Project cancellation will only complete if tally (TRUE votes) >= voteThreshold
    /// @param project The address of the project someone is attempting to cancel
    function cancelProject(address project) external {
        require(project != address(0), "Zero addr");
        bool[] memory votes = votingFinal[project];
        require(votes.length >= voteThreshold, "Insufficient number of votes");
        uint8 tallyFalse = 0;
        uint8 tallyTrue = 0;
        for(uint256 i = 0; i < votes.length; i++) {
            if(votes[i]) {
                tallyTrue += 1;
            } else {
                tallyFalse += 1;
            }
        }

        // Mark project as cancelled if tallyTrue > tallyFalse and emit vote result
        bool cancel = (tallyTrue > tallyFalse);
        if(cancel) {
            projectCancel[project] = true;
            plgProject = PLGProject(project);
            plgProject.markCancelled();
        } else {
            projectCancel[project] = false;
        }
        emit ModerationVoteResult(project, cancel);
    }

    /// @notice Connector to submit a vote from CampShare contract
    /// @param project The Address of the project to vote on
    /// @param vote Byte32 representation of vote
    /// @param moderator the ID of the moderator
    function submitVote(address project, bytes32 vote, uint256 moderator) external onlyOwnerOrManager {
        require(project != address(0), "Zero addr");
        require(moderator > 0, "Invalid account value");
        votingHash[project].push(vote);
        moderatorHash[project][moderator] = vote;
    }

    /// @notice Decrypt votes using the pieces used to construct the vote strings used for the original encryption
    /// @param project The project address
    /// @param projectId The ID of the project
    /// @param userIds The array of Ids of the moderators who submitted votes
    /// @param decryptKeys The array of decryption keys associated with each individual vote
    /// @param encodedVotes The array of encoded bool votes
    /// @return The number of votes successfully decrypted
    function decryptVotes(
        address project,
        uint256 projectId,
        uint256[] memory userIds,
        bytes32[] memory decryptKeys,
        bool[] memory encodedVotes
    ) public returns(uint256) {

        require(project != address(0), "Zero addr");
        require(votingHash[project].length >= voteThreshold, "Encrypted votes length");
        require(encodedVotes.length >= voteThreshold, "Votes length");
        require(userIds.length == encodedVotes.length, "User IDs length");
        require(decryptKeys.length == encodedVotes.length, "Decryption keys length");
        bytes32[] memory voteArray = votingHash[project];
        uint successCount = 0;
        bool[] memory votes = new bool[](encodedVotes.length);
        for(uint256 i = 0; i < votes.length; i++) {
            if(voteArray[i] == keccak256(abi.encodePacked(projectId, userIds[i], decryptKeys[i], encodedVotes[i]))) {
                votes[successCount] = encodedVotes[i];
                successCount += 1;
            }
        }
        votingFinal[project] = votes;
        return successCount;
    }

    /// @notice Allow for the Contract Owner to submit the bool votes
    /// @param projectId The ID of the project
    /// @param userIds The array of Ids of the moderators who submitted votes
    /// @param decryptKeys The array of decryption keys associated with each individual vote
    /// @param votes The array of bool votes
    function commitFinalVotes(
        address project,
        uint256 projectId,
        uint256[] memory userIds,
        bytes32[] memory decryptKeys,
        bool[] memory votes
    ) external onlyOwner {
        uint256 votesDecrypted = decryptVotes(project, projectId, userIds, decryptKeys, votes);
        require(votesDecrypted >= voteThreshold, "Insufficient decryptable votes");
        emit CommitFinalVotes(project, votes);
    }

    /// @notice Check how many votes have been submitted for the project
    /// @param project The project Address
    /// @return Number of votes received
    function checkNumberVotes(address project) external view returns(uint256) {
        return votingHash[project].length;
    }
}
